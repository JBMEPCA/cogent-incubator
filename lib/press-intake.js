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
import { inflateRawSync } from "node:zlib";
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
// The guide lane, added 23 September 2026. JB, on a checklist the desk had
// refused as "a tips article promoting Enki Towels": "practical guides, real
// content like that is great". So a pitch with no news in it can still earn a
// piece when what it teaches is genuinely useful to the trade. It is written
// as OUR guide from that material, never as the sender's promotion, and the
// bar is higher than for news because there is no event to justify it.
const MIN_GUIDE_RELEVANCE = 7;
const MIN_GUIDE_USEFULNESS = 7;
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

/** "pdf", "docx" or null for one MIME part. */
function docKind(p) {
  const name = String(p.filename || "").toLowerCase();
  if (p.mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (p.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return "docx";
  return null;
}

/**
 * The files inside a .docx, without a zip library. A Word file is a zip, and
 * all this needs is the central directory, each entry's local header and
 * zlib's raw inflate, which Node ships. Returns name -> Buffer.
 */
function unzip(buf, want = () => true) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
  }
  return out;
}

/** A Word release: its exact text, and any photos embedded in it. */
export function readDocx(buf) {
  const files = unzip(buf, (n) => n === "word/document.xml" || n.startsWith("word/media/"));
  const xml = files.get("word/document.xml")?.toString("utf8") || "";
  const text = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  const images = [...files]
    .filter(([n]) => /\.(jpe?g|png|webp)$/i.test(n))
    .map(([n, data]) => ({ data, filename: n.split("/").pop(), from: "Word file" }));
  return { text, images };
}

/**
 * A PDF release, read by Haiku. Claude takes a PDF natively, which keeps a
 * parsing library out of the build and copes with scanned releases too. About
 * 1p for a two-page release. What it returns is what the quote check tests
 * against, so the instruction is word for word, never a summary.
 */
export async function readPdf(client, buf) {
  const res = await client.messages.create({
    model: SORT_MODEL,
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } },
          {
            type: "text",
            text: "Copy out the full text of this press release exactly as written, word for word, keeping quotes, figures and punctuation unchanged. Separate paragraphs with a blank line. Leave out page numbers and headers or footers repeated on every page. Output the text only, nothing else.",
          },
        ],
      },
    ],
  });
  recordUsage(res.model || SORT_MODEL, res.usage);
  return (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

/**
 * The release out of any attached PDF or Word file. Up to two documents of
 * 10MB each. Photos embedded in a Word file come back too, to join the
 * picture candidates.
 */
async function readAttachedDocs(token, client, msg) {
  const texts = [];
  const images = [];
  for (const part of msg.pdfs.filter((p) => (p.body.size || 0) <= 10000000).slice(0, 2)) {
    try {
      const a = await gmail(token, `/messages/${msg.id}/attachments/${part.body.attachmentId}`);
      const buf = b64(a.data);
      if (docKind(part) === "docx") {
        const d = readDocx(buf);
        if (d.text) texts.push(d.text);
        images.push(...d.images);
      } else {
        const t = await readPdf(client, buf);
        if (t) texts.push(t);
      }
    } catch (e) {
      console.warn(`[press] could not read ${part.filename}: ${e.message}`);
    }
  }
  return { text: texts.join("\n\n"), images };
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
    // Releases mostly arrive as a PDF or Word file under a one-line covering
    // note, and some senders label both as application/octet-stream.
    if (p.body?.attachmentId && docKind(p)) pdfs.push(p);
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
  "guide": true|false,            // not a release, but practical know-how a working reader could act on: a how-to, a checklist, a buyer's guide, costs, rules, staffing, fit-out or compliance advice. A bare product pitch, a discount, an event invitation or a survey request is NOT a guide
  "usefulness": 0-10,             // guides only: how much of this could a ${site.name} reader actually use on Monday morning? 8+ = they would keep it
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

/** Is this release the same story as any of these headlines? Haiku, ~0.1p. */
export async function alreadyCovered(client, msg, headlines) {
  const res = await client.messages.create({
    model: SORT_MODEL,
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `A press release has arrived. Is it the SAME news story as any headline we have already published? A different announcement by the same company is not the same story; the same research, launch, deal or appointment written from another angle IS.

Headlines already published:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

${untrustedBlock(`Subject: ${msg.subject}\n\n${msg.text.slice(0, 2500)}`, "NEW RELEASE")}

Reply ONLY with JSON: {"same": true|false}`,
      },
    ],
  });
  recordUsage(res.model || SORT_MODEL, res.usage);
  return parseJson(res.content?.find((b) => b.type === "text")?.text)?.same === true;
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
async function candidateImages(token, msg, extra = []) {
  // Photos embedded in an attached Word file go in first: a sender who put a
  // picture in the release itself meant it for the story.
  const raw = extra.filter((c) => c.data?.length >= 60000 && !LOGO_NAME.test(c.filename || "")).slice(0, 3);
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
    const size = imageSize(c.data);
    if (!size) continue;
    if (size.width < MIN_IMAGE_WIDTH) continue;
    if (size.width < size.height * 0.6) continue; // tall posters and flyers
    // sharp only ever makes things smaller. It is NOT needed to use a photo:
    // the original bytes are measured above, shown to vision when small
    // enough, and uploaded as they are. On 21 Sep 2026 the first press photo
    // (Troon's Terre Blanche release) was lost to stock because every step
    // here ran through sharp, which fails to load on Vercel from time to time
    // (20 and 28 Aug too), and the catch dropped the photo in silence.
    let upload = c.data;
    let preview = size.type !== "image/webp" && c.data.length <= VISION_MAX_BYTES ? c.data : null;
    let previewType = size.type;
    try {
      const { default: sharp } = await import("sharp");
      if (c.data.length > 5000000) upload = await sharp(c.data).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      preview = await sharp(c.data).rotate().resize({ width: 800 }).jpeg({ quality: 70 }).toBuffer();
      previewType = "image/jpeg";
    } catch (e) {
      console.warn(`[press] sharp unavailable, using the original photo bytes: ${e.message?.slice(0, 120)}`);
    }
    out.push({ ...c, width: size.width, height: size.height, upload, type: upload === c.data ? size.type : "image/jpeg", preview, previewType });
  }
  return out;
}

// What vision will take as a base64 image, with headroom under the 5MB limit.
const VISION_MAX_BYTES = 3700000;

/**
 * Pixel size and type from the file header, no library. JPEG (the SOF marker),
 * PNG (IHDR) and WebP (VP8, VP8L, VP8X) cover every press photo seen so far.
 */
export function imageSize(buf) {
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        // SOF0-SOF15, excluding DHT (C4), JPG (C8) and DAC (CC).
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { type: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
      return null;
    }
    if (buf.readUInt32BE(0) === 0x89504e47) return { type: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8 ") return { type: "image/webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (kind === "VP8L") {
        const b = buf.readUInt32LE(21);
        return { type: "image/webp", width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (kind === "VP8X") return { type: "image/webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch {}
  return null;
}

/**
 * The email's photo, every time there is one. JB, 22 Sep 2026: using the
 * sender's own picture is essential. So vision only chooses BETWEEN candidates
 * and vetoes a logo or text graphic; it is never allowed to fall back to stock
 * when a real photo is there, and if it cannot run at all the largest
 * candidate is used rather than none.
 */
async function choosePicture(client, site, sorted, msg, candidates) {
  if (!candidates.length) return null;
  const largest = () => [...candidates].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const viewable = candidates.filter((c) => c.preview);
  if (!viewable.length) return { ...largest(), alt: `Photo supplied by ${sorted.company || "the company"}`, how: "largest (none viewable)" };
  try {
    const res = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            ...viewable.flatMap((c, i) => [
              { type: "text", text: `Image ${i + 1}:` },
              { type: "image", source: { type: "base64", media_type: c.previewType, data: c.preview.toString("base64") } },
            ]),
            {
              type: "text",
              text: `These came with a press release from ${sorted.company || "a company"} titled "${msg.subject}", to be the header photo of a news story on ${site.name}.

Using the sender's own photograph is required. Pick the best one. Reply 0 ONLY if every image is a logo, a graphic made of text, a flyer or poster, or a screenshot of a document or slide. A portrait suits an appointment story; a place, product, building or people at work suits anything else.

Reply ONLY with JSON: {"pick": <image number, or 0>, "alt": "plain description of what the photo shows, under 120 characters"}`,
            },
          ],
        },
      ],
    });
    recordUsage(res.model || VISION_MODEL, res.usage);
    const out = parseJson(res.content?.find((b) => b.type === "text")?.text);
    const n = Number(out?.pick || 0);
    if (!n || !viewable[n - 1]) return null;
    return { ...viewable[n - 1], alt: stripEmDashes(String(out.alt || "").slice(0, 150)), how: "chosen by vision" };
  } catch (e) {
    return { ...largest(), alt: `Photo supplied by ${sorted.company || "the company"}`, how: `largest (vision failed: ${e.message?.slice(0, 80)})` };
  }
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

/**
 * How the link ask behaves, fleet-wide. Read fresh on every release so it can
 * be changed without a redeploy. A Vercel env var would not take effect until
 * the next one, which is the wrong shape for a switch you want to flip the
 * moment a batch reads badly.
 *
 *   draft - write the reply into the press@ Drafts folder and send nothing.
 *           The default, and where this starts: a link ask that reads as
 *           payment-for-coverage would cost more goodwill than any link is
 *           worth, so the first batch gets read by a human before any of it
 *           leaves the building.
 *   send  - send it, the way the old thank-you always went.
 *   off   - no reply at all.
 */
const LINK_ASK_KEY = "press_link_ask";
const LINK_ASK_MODES = new Set(["draft", "send", "off"]);

export async function linkAskMode() {
  try {
    const row = await fleetRead().globalSetting.findUnique({ where: { key: LINK_ASK_KEY } });
    const v = String(row?.value || "").trim().toLowerCase();
    return LINK_ASK_MODES.has(v) ? v : "draft";
  } catch {
    // A database we cannot read is not a reason to start sending. Fail closed.
    return "draft";
  }
}

/** The host of a URL or an address, for the agency test below. */
function hostOf(raw) {
  if (!raw) return "";
  const s = String(raw).includes("@") ? String(raw).split("@")[1] : String(raw);
  try {
    return new URL(/^https?:\/\//.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(s).replace(/^www\./, "").toLowerCase();
  }
}

/**
 * The sender is an agency when they write from a different domain to the
 * company the release is about. It matters because the link we want sits on
 * the CLIENT's site, not the agency's: a PR firm's coverage page lists
 * everyone they have ever placed and is worth close to nothing, whereas the
 * client's own newsroom is a referring domain in the trade we publish in.
 *
 * Unknown counts as "not an agency". Asking a brand to pass it to their client
 * reads as a mistake, and that is the worse way to be wrong.
 */
function looksLikeAgency(to, sorted) {
  const from = hostOf(to?.email);
  const brand = hostOf(sorted?.companyWebsite);
  if (!from || !brand) return false;
  return from !== brand && !from.endsWith(`.${brand}`) && !brand.endsWith(`.${from}`);
}

/**
 * The reply, and the only place the titles ever ask for a link.
 *
 * Deliberately direct. The old copy said "please do share it" and asked for
 * nothing, which is why fifty-odd published releases produced no links at all.
 * This names what we gave (the coverage, in full, free, usually within the
 * hour) and names what we want back, because a request nobody can identify as
 * a request never gets actioned.
 *
 * What it must never become is a condition. The release is published and live
 * before this is written, and nothing here is contingent on the answer: the
 * moment coverage depends on a link, the titles are selling editorial instead
 * of earning it.
 */
export function replyLines({ site, to, url, sorted }) {
  const first = String(to.name || "").split(/\s+/)[0];
  const hello = first && !first.includes("@") && /^[A-Z][a-z'-]+$/.test(first) ? `Hello ${first},` : "Hello,";
  const company = sorted?.company || "the release";
  const agency = looksLikeAgency(to, sorted);

  return [
    hello,
    "",
    `Thanks for sending this to ${site.name}. We have written it up and it is live here:`,
    "",
    url,
    "",
    "We publish releases like this in full, usually within the hour, and we never charge for it. We are glad to keep doing that.",
    "",
    "In return we ask for one thing, and we would rather say it plainly than hint at it: please link to us.",
    "",
    agency
      ? `If you send ${company} a coverage round-up, that is the link to include. One from their own site is worth far more to us than one from anywhere else.`
      : "If you keep a news, press or coverage page, a link to that article is all we are after.",
    "",
    `It takes a minute, and it is what pays for the next piece of coverage, for ${company} and for everyone else who sends us something. A mention on LinkedIn is welcome too, though a link on the site is the part that lasts.`,
    "",
    "Either way the article stays up, and future releases to this address come straight to our news desk.",
    "",
    "Many thanks,",
    deskName(site.name),
  ];
}

function replyMime({ site, press, msg, to, url, sorted }) {
  const lines = replyLines({ site, to, url, sorted });
  const text = lines.join("\n");
  const html = lines
    .map((l) => {
      if (l === url) return `<a href="${url}">${url}</a>`;
      return l;
    })
    .join("<br>\n");
  const boundary = `press-${msg.id}`;
  const subject = /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`;
  return [
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
}

async function sendReply(token, { site, press, msg, to, url, sorted, mode }) {
  const raw = Buffer.from(replyMime({ site, press, msg, to, url, sorted })).toString("base64url");
  // A draft lands in the same thread in the press@ mailbox, so reading the
  // batch is opening Drafts and sending one is pressing send.
  if (mode === "draft") {
    await gmail(token, "/drafts", { method: "POST", body: { message: { raw, threadId: msg.threadId } } });
    return "drafted";
  }
  await gmail(token, "/messages/send", { method: "POST", body: { raw, threadId: msg.threadId } });
  return "sent";
}


// ---------------------------------------------------------------------------
// One release
// ---------------------------------------------------------------------------

// Must match the send-as display name in scripts/press-inbox-setup.mjs.
const deskName = (name) => (/\bnews$/i.test(name) ? `${name} Desk` : `${name} News Desk`);

export const cleanSubject = (s) =>
  String(s || "")
    .replace(/^((re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\b(press release|news release|for immediate release|embargoed?[^:|-]*)\s*[:|-]\s*/gi, "")
    // A resend is the same release. BDP sent theirs at 13:14 and again as
    // "(Final)" at 13:21 on 21 Sep 2026, and the two did not match.
    .replace(/^\s*(update[d]?|correction|revised|amended)\s*[:|-]\s*/i, "")
    .replace(/\s*[([]?\b(final|updated?|revised|amended|corrected|correction|v\d+)\b[)\]]?\s*$/i, "")
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

  // The release is usually IN the attachment, under a one-line covering note.
  // Its text joins the email's, so sorting, writing and the quote check all
  // work from the whole release.
  let docImages = [];
  if (msg.pdfs.length) {
    const docs = await readAttachedDocs(token, client, msg);
    if (docs.text) msg = { ...msg, text: `${msg.text}\n\n${docs.text}`.slice(0, 20000) };
    docImages = docs.images;
    await db.feedItem.update({ where: { id: item.id }, data: { summary: msg.text } });
  }
  if (msg.text.split(/\s+/).length < 80) {
    return skip(msg.pdfs.length ? "attached document could not be read" : "too little text to be a release");
  }

  // The same release again: sent to several titles, or resent to this one.
  // First copy to reach the desk keeps it; publishing it twice would make our
  // own titles compete for the same search, and thank the sender twice.
  // "shortlisted" counts: that copy is being written, or is held for review.
  const dup = await fleetRead().feedItem.findFirst({
    where: {
      id: { not: item.id },
      link: { startsWith: "gmail:" },
      title: { equals: title, mode: "insensitive" },
      status: { in: ["drafted", "shortlisted"] },
      discoveredAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { siteId: true, site: { select: { name: true } } },
  });
  if (dup) return skip(dup.siteId === site.id ? "an earlier copy of this release was already handled" : `already covered by ${dup.site.name}`);

  const sorted = await sortRelease(client, site, msg);
  // Two lanes: a release with news in it, or material useful enough to become
  // one of our own practical guides (see MIN_GUIDE_* above).
  const asGuide = !sorted.isPressRelease && sorted.guide === true;
  if (!sorted.isPressRelease && !asGuide) return skip(`not a release: ${sorted.reason || ""}`.slice(0, 200));
  if (asGuide) {
    if ((sorted.relevance || 0) < MIN_GUIDE_RELEVANCE)
      return skip(`guide too far off-topic (${sorted.relevance}/10): ${sorted.reason || ""}`.slice(0, 200));
    if ((sorted.usefulness || 0) < MIN_GUIDE_USEFULNESS)
      return skip(`guide not useful enough (${sorted.usefulness}/10): ${sorted.reason || ""}`.slice(0, 200));
  } else {
    if ((sorted.relevance || 0) < MIN_RELEVANCE) return skip(`off-topic (${sorted.relevance}/10): ${sorted.reason || ""}`.slice(0, 200));
    if ((sorted.newsValue || 0) < MIN_NEWS_VALUE) return skip(`no news in it (${sorted.newsValue}/10): ${sorted.reason || ""}`.slice(0, 200));
  }

  // Already covered on this title, by anyone. On 21 Sep 2026 BDP's release
  // was written up by hand at 13:35 and thanked from jb@; the desk published a
  // second article on it at 14:01 and thanked Adam again. The subject check
  // cannot see a piece nobody filed through the desk, so this reads the
  // title's own recent articles about the same company and asks the sorter
  // whether any is this story. Big companies are in the news for many things,
  // hence a judgement rather than a name match.
  if (sorted.company) {
    const recent = await db.article.findMany({
      where: {
        status: { in: ["published", "review", "approved", "drafting"] },
        createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
        sourceItemId: { not: item.id },
        OR: [
          { title: { contains: sorted.company, mode: "insensitive" } },
          { body: { contains: sorted.company, mode: "insensitive" } },
        ],
      },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    if (recent.length && (await alreadyCovered(client, msg, recent.map((r) => r.title)))) {
      return skip(`already covered on ${site.name}: ${recent[0].title}`.slice(0, 200));
    }
  }

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
  // `photo` says where the picture came from, and travels into the run's
  // summary: a stock fallback must be visible, never silent.
  let picture = null;
  let photo = "none in the email";
  try {
    const candidates = await candidateImages(token, msg, docImages);
    picture = await choosePicture(client, site, sorted, msg, candidates);
    photo = picture
      ? `email ${picture.from} ${picture.width}x${picture.height}, ${picture.how}`
      : candidates.length
        ? `email had ${candidates.length} image(s), all refused as logos or graphics`
        : `none usable in the email (${msg.images.length} image part(s), ${docImages.length} in documents)`;
  } catch (e) {
    photo = `picture step failed: ${e.message?.slice(0, 120)}`;
    console.warn(`[press] ${site.slug}: ${photo}`);
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
      brief: asGuide
        ? `PRACTICAL GUIDE, written by us from material sent to ${press} on ${msg.date.toISOString()} by ${company || "the sender"}. It is the only source, and it is a pitch: treat it as raw material, never as copy to reprint.

Write the guide this title's reader needs on this subject. Our own structure, our own order, our own words. Lead with what the reader has to decide or do. Keep every practical specific: steps, costs, figures, rules, timings, what to check.

${company ? `${company} is the sender, not the subject. Name them only where they are genuinely the source of a figure, a piece of expertise or a quote, at most once or twice, and never recommend them, their product or their range. No "partner", no "leading provider", no call to buy. Where they name their own product as the answer, write the generic advice instead: what to look for, what it should cost, what the options are.` : "Do not promote the sender or any product."}

Source material follows.

${msg.text.slice(0, 12000)}`
        : `Press release from ${company || "the sender"}, received by email at ${press} on ${msg.date.toISOString()}. Full text follows; it is the only source.\n\n${msg.text.slice(0, 12000)}`,
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
  // "-photo" so the picture never holds the article's own slug. On 21 Sep 2026
  // the BDP duplicate's photo did, and when that article came down its URL
  // redirected to the image file instead of the surviving article.
  const slug = `${a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/-+$/, "")}-photo`;
  if (picture) {
    const media = await uploadMedia(wp, { data: picture.upload, contentType: picture.type, alt: a.imageAlt || picture.alt, filename: slug });
    featuredMediaId = media.id;
    imageUrl = media.url;
  } else if (a.imageUrl) {
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
    return { scheduled: post.link, goLive: goLive.toISOString(), photo, subject: title.slice(0, 80), article: a.id };
  }
  await setLabels(token, msg.id, [L("Press/Published")]);
  const replied = await replyOnce({ site, token, labels, press, msg, sorted, url: post.link });
  return { published: post.link, replied, photo, subject: title.slice(0, 80), article: a.id };
}

async function replyOnce({ site, token, labels, press, msg, sorted, url }) {
  const mode = await linkAskMode();
  if (mode === "off") return false;
  const to = replyAddress(msg, sorted);
  if (!to) return false;
  try {
    const how = await sendReply(token, { site, press, msg, to, url, sorted, mode });
    // A drafted ask is not a reply yet, and labelling it as one would hide the
    // thread from the next sweep and from anyone reading the folder.
    if (how === "sent") await setLabels(token, msg.id, [labels.get("Press/Replied")]);
    return how;
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
              summary: `Press desk: ${r.published ? "published" : r.scheduled ? "scheduled" : r.held ? "held" : r.skipped ? "skipped" : "failed"}: ${String(r.subject || "").slice(0, 120)}${r.skipped ? ` (${r.skipped})` : r.held ? ` (${r.held})` : ""}${r.photo ? ` [photo: ${r.photo}]` : ""}`,
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
