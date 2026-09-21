// The press desk: releases sent to press@<title> become published news, within
// the hour, with nobody in the loop.
//
// Decided with JB on 21 Sep 2026. Lucas subscribes every title to PR lists, so
// the volume is high and most of it is noise. The shape follows from that:
//
//   1. SORT every release with Haiku for a fraction of a penny. Most stop here.
//   2. WRITE the survivors fresh with Sonnet. The same text goes to dozens of
//      outlets, so a copy never ranks and a site full of copies is judged thin
//      as a whole. A rewrite is the only version worth publishing.
//   3. CHECK in code what a model must never be trusted with: every quote is
//      copied from the release character for character, and every number in
//      the piece appears in the release. Then the usual Opus QA gate.
//   4. PUBLISH straight to WordPress, not into the slot calendar, because being
//      early is the point. An embargo becomes a WordPress scheduled post, so
//      the site itself holds it until the minute and nothing here has to wake.
//   5. REPLY to the sender with the link once it is live. Agencies share
//      coverage, and that is the backlink.
//
// Gmail labels are the state a human reads: Press/Published, Press/Scheduled,
// Press/Needs review (with the reason in the Article's qaReport), Press/Skipped
// and Press/Replied. The database is the state the code trusts: one FeedItem
// per email, keyed gmail:<message id>, which is also what stops two overlapping
// ticks writing the same release twice.
//
// Articles are kept at status "idea" until this module publishes them. Nothing
// else in the engine picks "idea" up, so fill-schedule, publish-due and the
// Designer never see a press piece, and a held one simply stays parked.
import Anthropic from "@anthropic-ai/sdk";
import { fleetRead } from "./prisma";
import { getGoogleAccessToken } from "./google";
import { TITLE_LABEL } from "./inbox-labels";
import { titleBrief, untrustedBlock } from "./voice";
import { normaliseSections } from "./site";
import { draftArticle, repairArticle, stripEmDashes } from "./drafting";
import { publishToWordPress, uploadMedia, resolveCategory, authorForSite, isWordPressConfigured } from "./wordpress";
import { meteringBuffer, runMetered, recordUsage } from "./agents/meter";
import { ensureAgents } from "./agents/runtime";
import { spendStatus } from "./spend";
import { parseAddress, isMachineSender } from "./mail-triage";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const SORT_MODEL = "claude-haiku-4-5";
const VISION_MODEL = "claude-haiku-4-5";
// The Opus gate stays: it is the one judgement call in the pipeline. Medium
// effort, because quotes and figures are proven by code before it looks.
const GATE_EFFORT = "medium";

// Anything older than this is not news we can be early on, and re-reading a
// week of mailbox every quarter hour costs Gmail quota for nothing.
const FRESH_HOURS = 72;
// Sorting thresholds, out of 10. Relevance is "would this title's reader care",
// news value is "is anything actually happening". A product award for a
// supplier nobody in the sector buys from scores low on the first; a "top tips"
// pitch dressed as a release scores low on the second.
const MIN_RELEVANCE = 6;
const MIN_NEWS_VALUE = 5;
// A header image has to fill the slot. The engine takes a company photo from
// 700px (lib/subject-image.js); a release photo is held to a little more.
const MIN_IMAGE_WIDTH = 800;
// Every title's mail domain, filled in by runPressIntake. We never thank ourselves.
const OUR_DOMAINS = new Set();
const STATE_LABELS = ["Press/Published", "Press/Scheduled", "Press/Needs review", "Press/Skipped", "Press/Replied"];

// ---------------------------------------------------------------------------
// Gmail plumbing
// ---------------------------------------------------------------------------

async function gmail(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Gmail ${method} ${path.split("?")[0]} ${res.status}: ${json?.error?.message || text.slice(0, 160)}`);
  return json;
}

async function labelIds(token) {
  const live = (await gmail(token, "/labels")).labels || [];
  const byName = new Map(live.map((l) => [l.name, l.id]));
  // scripts/press-inbox-setup.mjs makes these, but a title added later must not
  // stall on a missing label: every labelling call would 400 and the release
  // would be processed again on every tick.
  for (const name of ["Topics/Press", ...STATE_LABELS]) {
    if (byName.has(name)) continue;
    const made = await gmail(token, "/labels", {
      method: "POST",
      body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
    });
    byName.set(name, made.id);
  }
  return byName;
}

// A dry run (scripts/press-dry-run.mjs) does everything up to publishing and
// then stops: no labels, no post, no reply. Module-level because it has to
// reach every labelling call, and one process only ever runs one mode.
let DRY = false;

const setLabels = (token, id, add = [], remove = []) =>
  DRY
    ? Promise.resolve({ dry: true })
    : gmail(token, `/messages/${id}/modify`, { method: "POST", body: { addLabelIds: add, removeLabelIds: remove } });

const b64 = (data) => Buffer.from(String(data || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");

function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** One message, flattened into what the desk needs. */
function readMessage(m) {
  const headers = m.payload?.headers || [];
  const h = (name) => headers.find((x) => x.name.toLowerCase() === name)?.value || "";
  const all = (name) => headers.filter((x) => x.name.toLowerCase() === name).map((x) => x.value);
  let plain = "";
  let html = "";
  const images = [];
  const pdfs = [];
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data && !p.filename) plain += b64(p.body.data).toString("utf-8");
    if (p.mimeType === "text/html" && p.body?.data && !p.filename) html += b64(p.body.data).toString("utf-8");
    if (p.mimeType?.startsWith("image/") && p.body?.attachmentId) images.push(p);
    if (p.mimeType === "application/pdf" && p.body?.attachmentId) pdfs.push(p);
    for (const c of p.parts || []) walk(c);
  })(m.payload);
  // The HTML part is usually the complete one: many senders put a stub or a
  // "view in browser" line in text/plain.
  const fromHtml = htmlToText(html);
  const text = fromHtml.length > plain.length * 1.2 ? fromHtml : plain.trim() || fromHtml;
  return {
    id: m.id,
    threadId: m.threadId,
    messageId: h("message-id"),
    from: h("from"),
    replyTo: h("reply-to"),
    to: h("to"),
    cc: h("cc"),
    deliveredTo: all("delivered-to"),
    subject: h("subject").replace(/\s+/g, " ").trim(),
    date: new Date(Number(m.internalDate) || Date.now()),
    listUnsubscribe: Boolean(h("list-unsubscribe")),
    text: text.slice(0, 20000),
    html,
    images,
    pdfs,
  };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function parseJson(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function sortRelease(client, site, msg) {
  const sections = normaliseSections(site.sections).map((s) => s.name);
  const res = await client.messages.create({
    model: SORT_MODEL,
    max_tokens: 700,
    system: `You sort email arriving at the press desk of ${site.name}.

${titleBrief(site)}

Reply ONLY with JSON:
{
  "isPressRelease": true|false,   // a company announcing something that happened or will happen. NOT newsletters, event marketing, sales pitches, "top tips", survey invitations, requests for coverage without news, or follow-up chasers
  "relevance": 0-10,              // would ${site.name}'s reader care? 8+ = squarely our sector
  "newsValue": 0-10,              // is something concrete actually happening: a deal, launch, opening, closure, appointment, result, figure
  "company": "the announcing organisation's name",
  "companyWebsite": "https://... ONLY if the address appears in the email, else null",
  "embargo": { "present": true|false, "untilIso": "UTC ISO 8601 or null", "clear": true|false },
  "category": "exactly one of: ${sections.join(" | ") || "News"}",
  "reason": "one short line: why skip, or what the story is"
}

Embargo: only when the email itself says embargoed / not for publication until.
Convert its time to UTC; assume UK time (Europe/London) if no zone is stated.
"clear" is false when you cannot pin the date and time down unambiguously.`,
    messages: [
      {
        role: "user",
        content: `From: ${msg.from}\nSubject: ${msg.subject}\nReceived: ${msg.date.toISOString()}\n\n${untrustedBlock(
          msg.text.slice(0, 7000),
          "EMAIL"
        )}`,
      },
    ],
  });
  recordUsage(res.model || SORT_MODEL, res.usage);
  const out = parseJson(res.content?.find((b) => b.type === "text")?.text);
  if (!out) throw new Error("sorting reply was not JSON");
  return out;
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

const LOGO_NAME = /logo|icon|signature|sig[_-]|banner|header|footer|social|facebook|twitter|linkedin|instagram|youtube|spacer|pixel|badge|button/i;

async function inlineImageUrls(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src || !/^https:\/\//i.test(src) || LOGO_NAME.test(src)) continue;
    const w = Number(tag.match(/width=["']?(\d+)/i)?.[1] || 0);
    if (w && w < 300) continue;
    out.push(src);
  }
  return [...new Set(out)].slice(0, 4);
}

/**
 * Every usable photo the email carries, attached or linked, with its pixels
 * measured. Big and not a logo; the model chooses between the survivors.
 */
async function candidateImages(token, msg) {
  const { default: sharp } = await import("sharp");
  const raw = [];
  const attached = msg.images
    .filter((p) => (p.body.size || 0) >= 60000 && (p.body.size || 0) <= 15000000)
    .filter((p) => !/^image[0-9]+[.]/i.test(p.filename || "") && !LOGO_NAME.test(p.filename || ""))
    .sort((a, b) => (b.body.size || 0) - (a.body.size || 0))
    .slice(0, 4);
  for (const p of attached) {
    try {
      const a = await gmail(token, `/messages/${msg.id}/attachments/${p.body.attachmentId}`);
      raw.push({ data: b64(a.data), filename: p.filename, from: "attachment" });
    } catch {}
  }
  for (const url of await inlineImageUrls(msg.html)) {
    if (raw.length >= 6) break;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const data = Buffer.from(await r.arrayBuffer());
      if (data.length < 60000) continue;
      raw.push({ data, filename: url.split("/").pop()?.split("?")[0] || "image", from: "linked" });
    } catch {}
  }
  const out = [];
  for (const c of raw) {
    try {
      const meta = await sharp(c.data).metadata();
      if ((meta.width || 0) < MIN_IMAGE_WIDTH) continue;
      if ((meta.width || 0) < (meta.height || 0) * 0.6) continue; // tall posters and flyers
      // A JPEG copy under the API's image limit, for looking at and for upload.
      // Print-size originals of 10MB+ are common in press packs.
      const jpeg = await sharp(c.data).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      const preview = await sharp(jpeg).resize({ width: 800 }).jpeg({ quality: 70 }).toBuffer();
      out.push({ ...c, width: meta.width, height: meta.height, jpeg, preview });
    } catch {}
  }
  return out;
}

async function choosePicture(client, site, sorted, msg, candidates) {
  if (!candidates.length) return null;
  const res = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          ...candidates.flatMap((c, i) => [
            { type: "text", text: `Image ${i + 1}:` },
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: c.preview.toString("base64") } },
          ]),
          {
            type: "text",
            text: `These came with a press release from ${sorted.company || "a company"} titled "${msg.subject}", to be the header photo of a news story on ${site.name}.

Pick the best editorial photograph. Refuse logos, graphics made of text, flyers, document or slide screenshots, and anything blurred. A portrait is right for an appointment story; a product, building or people at work is right otherwise.

Reply ONLY with JSON: {"pick": <image number, or 0 if none is usable>, "alt": "plain description of what the photo shows, under 120 characters"}`,
          },
        ],
      },
    ],
  });
  recordUsage(res.model || VISION_MODEL, res.usage);
  const out = parseJson(res.content?.find((b) => b.type === "text")?.text);
  const n = Number(out?.pick || 0);
  if (!n || !candidates[n - 1]) return null;
  return { ...candidates[n - 1], alt: stripEmDashes(String(out.alt || "").slice(0, 150)) };
}

// ---------------------------------------------------------------------------
// The checks a model is not trusted with
// ---------------------------------------------------------------------------

// Both sides go through the house dash rule first. Every article has its em
// and en dashes turned into commas on the way out (stripEmDashes), so a quote
// that carried one in the release could never match word for word: the first
// Toyota test, 21 Sep 2026, was held for two quotes it had copied exactly.
const norm = (s) =>
  stripEmDashes(String(s || ""))
    .replace(/s+-s+/g, ", ")
    .replace(/,s*,/g, ",")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Visible text of the article, minus link text (internal-link anchors quote other headlines). */
function articleText(body) {
  return htmlToText(String(body || "").replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " "));
}

/**
 * Faults in a draft that code can prove. Returned as QA-style issue strings so
 * repairArticle can act on them exactly like the gate's own.
 */
export function pressFaults(body, source) {
  const faults = [];
  const text = articleText(body);
  const src = norm(source);

  // Quotes: every stretch in quotation marks must be in the release verbatim.
  // An ellipsis inside a quote means we cut it; each piece must still match.
  for (const m of norm(text).matchAll(/"([^"]{12,}?)"/g)) {
    const pieces = m[1].split(/\s*(?:\.\.\.|…)\s*/).map((p) => p.replace(/^[\s,.;:]+|[\s,.;:!?]+$/g, "")).filter((p) => p.length >= 8);
    const missing = pieces.filter((p) => !src.includes(p));
    if (missing.length) {
      faults.push(
        `Quote not found word for word in the press release: "${missing[0].slice(0, 140)}". Quote the release exactly, or drop the quotation marks and report it as the company's position.`
      );
    }
  }

  // Numbers: anything with two or more digits must come from the release.
  // Commas are ignored both sides so 1,200 matches 1200. The current and last
  // year are exempt, since "in 2026" is context the writer may add.
  const year = new Date().getUTCFullYear();
  const srcDigits = src.replace(/(\d),(?=\d{3})/g, "$1");
  const seen = new Set();
  for (const m of norm(text).replace(/(\d),(?=\d{3})/g, "$1").matchAll(/\d+(?:\.\d+)?/g)) {
    const n = m[0];
    if (n.replace(".", "").length < 2 || seen.has(n)) continue;
    seen.add(n);
    if (n === String(year) || n === String(year - 1)) continue;
    if (!new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|\\.(?!\\d)|$)`).test(srcDigits)) {
      faults.push(`The figure ${n} does not appear in the press release. Use the release's own figure or remove it.`);
    }
  }
  return faults;
}

// ---------------------------------------------------------------------------
// The reply
// ---------------------------------------------------------------------------

function encodeHeader(v) {
  const s = String(v || "");
  return /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

/** Who to thank: a person who can read it, or nobody. */
function replyAddress(msg, sorted) {
  for (const raw of [msg.replyTo, msg.from]) {
    if (!raw) continue;
    const a = parseAddress(raw.split(",")[0]);
    if (a.email.includes("@") && !isMachineSender(a) && !OUR_DOMAINS.has(a.domain)) return a;
  }
  // A wire service sending from no-reply@ usually prints the media contact in
  // the release. Only an address literally in the text, never a guess.
  const printed = [...String(msg.text).matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase());
  const hit = printed.find((e) => !isMachineSender(parseAddress(e)) && !OUR_DOMAINS.has(e.split("@")[1]));
  return hit && sorted?.company ? parseAddress(hit) : null;
}

async function sendReply(token, { site, press, msg, to, url }) {
  const first = String(to.name || "").split(/\s+/)[0];
  const hello = first && !first.includes("@") && /^[A-Z][a-z'-]+$/.test(first) ? `Hello ${first},` : "Hello,";
  const lines = [
    hello,
    "",
    `Thanks for sending this to ${site.name}. It is live here:`,
    url,
    "",
    "Please do share it. Future releases to this address come straight to our news desk.",
    "",
    deskName(site.name),
  ];
  const text = lines.join("\n");
  const html = lines.map((l) => (l === url ? `<a href="${url}">${url}</a>` : l)).join("<br>\n");
  const boundary = `press-${msg.id}`;
  const subject = /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`;
  const mime = [
    `From: ${encodeHeader(deskName(site.name))} <${press}>`,
    `To: ${to.email}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(msg.messageId ? [`In-Reply-To: ${msg.messageId}`, `References: ${msg.messageId}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf-8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf-8").toString("base64"),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  await gmail(token, "/messages/send", {
    method: "POST",
    body: { raw: Buffer.from(mime).toString("base64url"), threadId: msg.threadId },
  });
}

// ---------------------------------------------------------------------------
// One release
// ---------------------------------------------------------------------------

// Must match the send-as display name in scripts/press-inbox-setup.mjs.
const deskName = (name) => (/\bnews$/i.test(name) ? `${name} Desk` : `${name} News Desk`);

const cleanSubject = (s) =>
  String(s || "")
    .replace(/^((re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\b(press release|news release|for immediate release|embargoed?[^:|-]*)\s*[:|-]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250);

async function processRelease({ site, db, wp, token, labels, press, msg, client, authorId }) {
  const L = (name) => labels.get(name);
  const link = `gmail:${msg.id}`;
  const title = cleanSubject(msg.subject) || "(untitled release)";

  // Claim it first. The unique (siteId, link) key means a second tick that
  // arrives while this one is still writing gets an error here and moves on.
  const brand0 = await db.prBrand.upsert({
    where: { id: `press-desk-${site.id}` },
    update: {},
    create: { id: `press-desk-${site.id}`, name: "Press desk (unsorted)", notes: "Holding brand for press@ releases before the sender is known." },
  });
  let item;
  try {
    item = await db.feedItem.create({
      data: { brandId: brand0.id, title, link, summary: msg.text.slice(0, 20000), publishedAt: msg.date, status: "new" },
    });
  } catch {
    // Claimed before. If that earlier pass sorted it out as noise but never got
    // to label it (a dry run, or a tick killed mid-way), label it now, or it is
    // listed again every quarter hour for three days.
    const prior = await db.feedItem.findUnique({ where: { siteId_link: { siteId: site.id, link } } }).catch(() => null);
    if (prior?.status === "dismissed") await setLabels(token, msg.id, [L("Press/Skipped")]).catch(() => {});
    return { skipped: "already claimed" };
  }

  const skip = async (reason) => {
    await db.feedItem.update({ where: { id: item.id }, data: { status: "dismissed", summary: `[skipped: ${reason}]\n\n${msg.text.slice(0, 19000)}` } });
    await setLabels(token, msg.id, [L("Press/Skipped")]);
    return { skipped: reason, subject: title.slice(0, 80) };
  };

  if (msg.text.split(/\s+/).length < 80) {
    return skip(msg.pdfs.length ? "release is only in a PDF attachment" : "too little text to be a release");
  }

  // The same release, sent to several titles. First title to sort it keeps it;
  // publishing it twice would make our own titles compete for the same search.
  const dup = await fleetRead().feedItem.findFirst({
    where: {
      siteId: { not: site.id },
      link: { startsWith: "gmail:" },
      title: { equals: title, mode: "insensitive" },
      status: "drafted",
      discoveredAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { site: { select: { name: true } } },
  });
  if (dup) return skip(`already covered by ${dup.site.name}`);

  const sorted = await sortRelease(client, site, msg);
  if (!sorted.isPressRelease) return skip(`not a release: ${sorted.reason || ""}`.slice(0, 200));
  if ((sorted.relevance || 0) < MIN_RELEVANCE) return skip(`off-topic (${sorted.relevance}/10): ${sorted.reason || ""}`.slice(0, 200));
  if ((sorted.newsValue || 0) < MIN_NEWS_VALUE) return skip(`no news in it (${sorted.newsValue}/10): ${sorted.reason || ""}`.slice(0, 200));

  // Embargo. Unclear is a hold, never a guess: breaking one gets a title
  // dropped from the list, and missing one by an hour costs nothing.
  let goLive = null;
  if (sorted.embargo?.present) {
    const t = new Date(sorted.embargo.untilIso || "");
    if (!sorted.embargo.clear || Number.isNaN(t.getTime())) {
      await db.feedItem.update({ where: { id: item.id }, data: { status: "shortlisted" } });
      await setLabels(token, msg.id, [L("Press/Needs review")]);
      return { held: "embargo time could not be read with certainty", subject: title.slice(0, 80) };
    }
    if (t > new Date(Date.now() + 5 * 60000)) goLive = t;
  }

  // The announcing company, as a brand of this title. Its press contact is
  // recorded only when it is a real person who wrote to us: the backlink
  // engine refuses guessed addresses, and this is not a guess.
  const company = String(sorted.company || "").trim().slice(0, 120) || null;
  let brandId = brand0.id;
  if (company) {
    const existing = await db.prBrand.findFirst({ where: { name: { equals: company, mode: "insensitive" } } });
    const contact = replyAddress(msg, sorted);
    const brand =
      existing ||
      (await db.prBrand.create({
        data: {
          name: company,
          website: sorted.companyWebsite || null,
          notes: "Sent us a press release via press@.",
          ...(contact ? { prContactName: contact.name, prContactEmail: contact.email, contactConfidence: "found" } : {}),
        },
      }));
    brandId = brand.id;
  }
  await db.feedItem.update({ where: { id: item.id }, data: { brandId, status: "shortlisted" } });

  // The picture, chosen before the draft so the draft never goes looking for
  // stock when the sender gave us a photo. Uploaded only once the piece passes.
  let picture = null;
  try {
    picture = await choosePicture(client, site, sorted, msg, await candidateImages(token, msg));
  } catch (e) {
    console.warn(`[press] ${site.slug}: picture step failed: ${e.message}`);
  }

  const article = await db.article.create({
    data: {
      title,
      type: "pr_rewrite",
      status: "idea",
      sourceItemId: item.id,
      sourceUrl: sorted.companyWebsite || null,
      category: sorted.category || null,
      // The gate treats the brief as publisher-verified, so the release itself
      // goes here: QA checks the article against what the company actually said
      // instead of judging unfamiliar names as invented.
      brief: `Press release from ${company || "the sender"}, received by email at ${press} on ${msg.date.toISOString()}. Full text follows; it is the only source.\n\n${msg.text.slice(0, 12000)}`,
      // The press reply below asks the sender to share it. The backlink engine
      // writing to the same company a day later would be a second ask.
      outreachScannedAt: new Date(),
    },
  });

  const draftOpts = {
    sourceText: msg.text.slice(0, 12000),
    pressRelease: true,
    status: "idea",
    ...(picture
      ? { image: { url: null, alt: picture.alt, credit: company ? `Image: ${company}` : null, source: `press:${company || "sender"}` } }
      : {}),
  };
  await draftArticle(site, article.id, wp, { ...draftOpts, skipQa: true, effort: "low" });

  // Order matters for cost. The code checks are free, so they go first: a
  // draft that misquotes goes straight to one Sonnet repair and then meets the
  // Opus gate ONCE. Gate first would pay for the gate twice on every such draft.
  const get = () => db.article.findUnique({ where: { id: article.id } });
  const recordFaults = (a, faults, report = {}) =>
    db.article.update({
      where: { id: a.id },
      data: { qaPassed: false, qaReport: JSON.stringify({ ...report, mechanical: [...(report.mechanical || []), ...faults] }) },
    });
  const gate = async (a) => {
    const { reviewArticle } = await import("./qa");
    const qa = await reviewArticle({ site, title: a.title, body: a.body, type: a.type, keyphrase: a.keyphrase, metaDesc: a.metaDesc, brief: a.brief, effort: GATE_EFFORT });
    return db.article.update({ where: { id: a.id }, data: { qaPassed: qa.ok, qaReport: qa.report } });
  };
  const repair = async () => {
    try {
      await repairArticle(site, article.id, wp, { status: "idea", effort: "low", gateEffort: GATE_EFFORT }); // re-runs the gate itself
    } catch (e) {
      console.warn(`[press] ${site.slug}: repair failed: ${e.message}`);
    }
    const a = await get();
    const faults = pressFaults(a.body, msg.text);
    if (process.env.PRESS_DEBUG && faults.length) console.log("[press] faults after repair", JSON.stringify(faults));
    return faults.length ? recordFaults(a, faults, JSON.parse(a.qaReport || "{}")) : a;
  };

  let a = await get();
  const faults = pressFaults(a.body, msg.text);
  if (process.env.PRESS_DEBUG && faults.length) console.log("[press] faults", JSON.stringify(faults));
  if (faults.length) {
    await recordFaults(a, faults);
    a = await repair();
  } else {
    a = await gate(a);
    if (process.env.PRESS_DEBUG && !a.qaPassed) console.log("[press] gate held", String(a.qaReport).replace(/s+/g, " "));
    // One repair, never a redraft: a good article with a small fault is the
    // usual hold, and fixing the listed faults is a fraction of the cost.
    if (!a.qaPassed) a = await repair();
  }
  if (!a.qaPassed || !a.body) {
    await db.article.update({ where: { id: a.id }, data: { status: "idea" } });
    await setLabels(token, msg.id, [L("Press/Needs review")]);
    return { held: "failed QA after one repair", subject: title.slice(0, 80), article: a.id };
  }

  if (DRY) {
    return { dryRun: true, wouldPublish: goLive ? `scheduled for ${goLive.toISOString()}` : "now", picture: picture ? `${picture.from} ${picture.width}x${picture.height}` : "none from email", subject: title.slice(0, 80), article: a.id };
  }

  // Publish. Straight to WordPress: the calendar is for our own pieces, and a
  // release is worth most in its first hour.
  if (!a.category) a = await db.article.update({ where: { id: a.id }, data: { category: "News" } });
  let featuredMediaId;
  let imageUrl = a.imageUrl;
  if (picture) {
    const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const media = await uploadMedia(wp, { data: picture.jpeg, contentType: "image/jpeg", alt: a.imageAlt || picture.alt, filename: slug });
    featuredMediaId = media.id;
    imageUrl = media.url;
  } else if (a.imageUrl) {
    const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const media = await uploadMedia(wp, { imageUrl: a.imageUrl, alt: a.imageAlt, filename: slug });
    featuredMediaId = media.id;
  }
  if (!featuredMediaId) {
    await setLabels(token, msg.id, [L("Press/Needs review")]);
    return { held: "no usable picture from the email or elsewhere", subject: title.slice(0, 80), article: a.id };
  }

  let body = stripEmDashes(a.body);
  if (a.imageCredit) body += `\n<p><em style="font-size:0.85em">${a.imageCredit}</em></p>`;
  const post = await publishToWordPress(wp, {
    title: stripEmDashes(a.title),
    body,
    status: goLive ? "future" : "publish",
    dateGmt: goLive ? goLive.toISOString() : undefined,
    featuredMediaId,
    categoryId: await resolveCategory(wp, a.category),
    keyphrase: a.keyphrase,
    metaDesc: a.metaDesc,
    authorId,
  });
  await db.article.update({
    where: { id: a.id },
    data: { status: "published", publishedAt: goLive || new Date(), wpPostId: post.id, imageUrl },
  });
  await db.feedItem.update({ where: { id: item.id }, data: { status: "drafted" } });

  if (goLive) {
    await setLabels(token, msg.id, [L("Press/Scheduled")]);
    return { scheduled: post.link, goLive: goLive.toISOString(), subject: title.slice(0, 80), article: a.id };
  }
  await setLabels(token, msg.id, [L("Press/Published")]);
  const replied = await replyOnce({ site, token, labels, press, msg, sorted, url: post.link });
  return { published: post.link, replied, subject: title.slice(0, 80), article: a.id };
}

async function replyOnce({ site, token, labels, press, msg, sorted, url }) {
  const to = replyAddress(msg, sorted);
  if (!to) return false;
  try {
    await sendReply(token, { site, press, msg, to, url });
    await setLabels(token, msg.id, [labels.get("Press/Replied")]);
    return true;
  } catch (e) {
    console.warn(`[press] ${site.slug}: reply failed: ${e.message}`);
    return false;
  }
}

/**
 * Embargoed pieces WordPress has since put live: thank the sender now. The
 * post went out on its own at the embargo minute, so this only has to notice.
 */
async function sweepScheduled({ site, db, wp, token, labels, press }) {
  const L = (n) => labels.get(n);
  const list = await gmail(token, `/messages?labelIds=${L("Press/Scheduled")}&maxResults=25`);
  const out = [];
  for (const { id } of list.messages || []) {
    const item = await db.feedItem.findFirst({
      where: { link: `gmail:${id}` },
      include: { articles: { where: { status: "published" }, select: { publishedAt: true, wpPostId: true } } },
    });
    const art = item?.articles?.[0];
    if (!art || !art.publishedAt || art.publishedAt > new Date()) continue;
    const msg = readMessage(await gmail(token, `/messages/${id}?format=full`));
    const { fetchPost } = await import("./wordpress");
    const post = await fetchPost(wp, art.wpPostId).catch(() => null);
    if (!post || post.status !== "publish") continue;
    await setLabels(token, id, [L("Press/Published")], [L("Press/Scheduled")]);
    const replied = await replyOnce({ site, token, labels, press, msg, sorted: { company: item.title }, url: post.link });
    out.push({ wentLive: post.link, replied });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

/**
/**
 * Every title at once, each working its own mailbox to the deadline. Titles
 * run in parallel because the promise is an hour from send to live: a busy
 * Fleet morning must not make Dental's one release wait for the next tick.
 *
 * Office hours are deliberately NOT respected. A release sent at 21:00 under
 * an 06:00 embargo is exactly the one to have scheduled before morning.
 */
export async function runPressIntake({ budgetMs = 230000, perTitle = 8, dryRun = false, only = null } = {}) {
  DRY = dryRun;
  const deadline = Date.now() + budgetMs;
  const { activeSites } = await import("./cron");
  const { titleAddresses } = await import("./inbox-labels");
  const sites = (await activeSites())
    .filter((ctx) => TITLE_LABEL[ctx.site.slug] && ctx.creds.outreach?.fromEmail)
    .filter((ctx) => !only || only.includes(ctx.site.slug));

  // Every address that belongs to some title. The hub is Smart SME's own
  // mailbox, so other titles' forwarded press copies sit in it wearing
  // Topics/Press; those belong to their own title's desk, never to Smart SME.
  const everyAddress = new Set();
  for (const email of (await titleAddresses()).keys()) {
    everyAddress.add(email);
    everyAddress.add(`press@${email.split("@")[1]}`);
    OUR_DOMAINS.add(email.split("@")[1]);
  }

  const client = new Anthropic();
  const results = await Promise.all(
    sites.map(async ({ site, db, creds }) => {
      const wp = creds.wordpress;
      const mailbox = creds.outreach.fromEmail.toLowerCase();
      const press = `press@${mailbox.split("@")[1]}`;
      const out = { site: site.slug, done: [] };
      try {
        if (!isWordPressConfigured(wp)) return { ...out, skipped: "WordPress not configured" };
        const token = await getGoogleAccessToken(SCOPES, mailbox);
        const labels = await labelIds(token);

        out.done.push(...(await sweepScheduled({ site, db, wp, token, labels, press })));

        const foreign = [...everyAddress].filter((e) => e.split("@")[1] !== mailbox.split("@")[1]);
        const q = [
          "label:topics-press",
          `newer_than:${Math.ceil(FRESH_HOURS / 24)}d`,
          "-label:press-published -label:press-scheduled -label:press-needs-review -label:press-skipped",
          "-from:me",
          foreign.length ? `-deliveredto:(${foreign.join(" OR ")})` : "",
        ].join(" ");
        const list = await gmail(token, `/messages?q=${encodeURIComponent(q)}&maxResults=${perTitle * 2}`);
        // Oldest first: the one closest to missing its hour goes next.
        const ids = (list.messages || []).map((m) => m.id).reverse();
        if (!ids.length) return out;

        const editor = await db.agent.findUnique({ where: { siteId_key: { siteId: site.id, key: "editor" } } });
        if (!editor) await ensureAgents(site.id);
        const authorId = await authorForSite(wp, site);

        for (const id of ids.slice(0, perTitle)) {
          if (Date.now() > deadline - 75000) {
            out.deferred = "out of time this tick";
            break;
          }
          if ((await spendStatus(site.id)).over) {
            out.deferred = "daily spend cap reached";
            break;
          }
          const msg = readMessage(await gmail(token, `/messages/${id}?format=full`));
          if (msg.date < new Date(Date.now() - FRESH_HOURS * 3600000)) continue;
          // Belt and braces for the hub: a copy addressed to another title.
          const addressed = [msg.to, msg.cc, ...msg.deliveredTo].join(" ").toLowerCase();
          if (foreign.some((e) => addressed.includes(e)) && !addressed.includes(press)) continue;

          const meter = meteringBuffer();
          const startedAt = new Date();
          let r;
          let error = null;
          try {
            r = await runMetered(meter, () => processRelease({ site, db, wp, token, labels, press, msg, client, authorId }));
          } catch (e) {
            error = e.message?.slice(0, 500) || String(e);
            r = { error, subject: msg.subject.slice(0, 80) };
            // Labelled so it is not retried every quarter hour at full cost,
            // and so a human can see it. The FeedItem claim already stops a
            // second attempt.
            await setLabels(token, id, [labels.get("Press/Needs review")]).catch(() => {});
          }
          out.done.push(r);
          if (r?.skipped === "already claimed") continue;
          // Counted as Editor spend, so the title's daily cap, the Finance
          // Manager and cost per article all see the press desk.
          await db.agentRun.create({
            data: {
              agentKey: "editor",
              trigger: "press",
              summary: `Press desk: ${r.published ? "published" : r.scheduled ? "scheduled" : r.held ? "held" : r.skipped ? "skipped" : "failed"}: ${String(r.subject || "").slice(0, 120)}${r.skipped ? ` (${r.skipped})` : r.held ? ` (${r.held})` : ""}`,
              ok: !error,
              error,
              model: meter.model,
              inputTokens: meter.input,
              outputTokens: meter.output,
              costUsd: meter.cost,
              articleId: r.article || null,
              startedAt,
              endedAt: new Date(),
            },
          });
          if (r.article) await db.article.update({ where: { id: r.article }, data: { costUsd: meter.cost } });
          r.costUsd = Number(meter.cost.toFixed(4));
        }
      } catch (e) {
        out.error = e.message?.slice(0, 300);
      }
      return out;
    })
  );
  return { titles: results.length, results };
}

/**
 * Test hook: run one hand-built message through the desk as a dry run. Used by
 * scripts/press-dry-run.mjs --sample to exercise drafting on a real release
 * when nothing relevant has arrived by email yet.
 */
export async function dryRunMessage(slug, msg) {
  DRY = true;
  const { getSiteContext } = await import("./site");
  const { titleAddresses } = await import("./inbox-labels");
  for (const email of (await titleAddresses()).keys()) OUR_DOMAINS.add(email.split("@")[1]);
  const { site, db, creds } = await getSiteContext(slug);
  const meter = meteringBuffer();
  const r = await runMetered(meter, () =>
    processRelease({
      site, db, wp: creds.wordpress, token: null, labels: new Map(),
      press: `press@${creds.outreach.fromEmail.split("@")[1]}`,
      msg: { id: `dry-${Date.now()}`, threadId: null, messageId: "", replyTo: "", to: "", cc: "", deliveredTo: [], images: [], pdfs: [], listUnsubscribe: false, ...msg },
      client: new Anthropic(), authorId: null,
    })
  );
  return { ...r, costUsd: Number(meter.cost.toFixed(4)) };
}
