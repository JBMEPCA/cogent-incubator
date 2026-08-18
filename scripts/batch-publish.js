// Batch article publisher, per title (--site=<slug>). Drafts long-form pieces against the live site's
// link map, sources a high-resolution header photo, runs the copy and picture
// QA gates, revises once if the gates complain, then publishes to WordPress and
// records the article in the app database.
//
// Articles are defined in batch-plan.json. Resumable: keys that reached
// "published" are recorded in .batch-state.json and skipped on re-run, so an
// interrupted batch continues with: node scripts/batch-publish.js
// Pass keys as arguments to run only those.
const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("node:async_hooks");

const ROOT = path.join(__dirname, "..");
// Load .env without adding a dotenv dependency.
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(String.fromCharCode(10))) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  const q = v[0];
  if ((q === String.fromCharCode(34) || q === String.fromCharCode(39)) && v.endsWith(q)) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const AnthropicPkg = require("@anthropic-ai/sdk");
const Anthropic = AnthropicPkg.default || AnthropicPkg;
const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");

const prisma = new PrismaClient();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-8";
// Mechanical routing work only: search queries and candidate picking.
const ROUTING_MODEL = "claude-haiku-4-5";
// Set per title in the runner: a SmartSMEBot user-agent crawling on behalf of
// the fleet magazine is the kind of small dishonesty that gets a publisher blocked.
let UA = { "user-agent": "CogentBot/1.0" };
const RESULTS = path.join(__dirname, ".batch-state.json");

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ------------------------------------------------------------------ helpers */

function stripDashes(text) {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*\)/g, ")");
}

function headerLine(text, key) {
  return text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || null;
}

function textOf(res) {
  let out = "";
  for (const b of res.content) if (b.type === "text") out += b.text;
  return out.trim();
}

function field(text, key) {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*(?:"([^"]*)"|(-?\\d+)|(true|false))`, "i"));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

// Token meter. Every call in this script goes through ask(), so accumulating
// here captures the whole cost of an article: draft, both QA gates, the
// revision pass and every vision check. Without it the script reported nothing
// at all, and neither the state file nor the Finance Manager could say what an
// article actually cost.
//
// Claude Opus 4.8: $5.00 per million input tokens, $25.00 per million output.
// Cache reads bill at about a tenth of the input rate and writes at 1.25x for
// the 5 minute TTL.
// Per million tokens. Opus 4.8 is $5 in / $25 out; Haiku 4.5 is $1 / $5. Cache
// reads bill at about a tenth of the input rate, writes at 1.25x. Priced per
// model because the routing calls run on Haiku — a single blended rate would
// overstate them fivefold and hide whether the split is working.
const RATES = {
  [MODEL]: { in: 5.0 / 1e6, out: 25.0 / 1e6, cacheRead: 0.5 / 1e6, cacheWrite: 6.25 / 1e6 },
  [ROUTING_MODEL]: { in: 1.0 / 1e6, out: 5.0 / 1e6, cacheRead: 0.1 / 1e6, cacheWrite: 1.25 / 1e6 },
};
// Held per-article in AsyncLocalStorage rather than a module variable: a wave
// runs its articles concurrently through Promise.allSettled, so one shared
// counter would bill the whole wave to whichever article read it last.
const meters = new AsyncLocalStorage();

const newMeter = () => ({ calls: 0, in: 0, out: 0, usd: 0, byModel: {} });

// Match on family, not the exact string: the API echoes back a dated id
// ("claude-haiku-4-5-20251001"), which misses an alias-keyed lookup and would
// silently fall through to Opus rates, overstating every routing call fivefold.
function rateFor(model) {
  return String(model || "").includes("haiku") ? RATES[ROUTING_MODEL] : RATES[MODEL];
}

function meterAdd(m, model, usage) {
  const r = rateFor(model);
  const cost =
    (usage.input_tokens || 0) * r.in +
    (usage.output_tokens || 0) * r.out +
    (usage.cache_read_input_tokens || 0) * r.cacheRead +
    (usage.cache_creation_input_tokens || 0) * r.cacheWrite;
  m.calls += 1;
  m.in += usage.input_tokens || 0;
  m.out += usage.output_tokens || 0;
  m.usd += cost;
  const b = (m.byModel[model] = m.byModel[model] || { calls: 0, in: 0, out: 0, usd: 0 });
  b.calls += 1;
  b.in += usage.input_tokens || 0;
  b.out += usage.output_tokens || 0;
  b.usd += cost;
}

function meterTotal(m) {
  const round = (o) => ({ ...o, usd: Number(o.usd.toFixed(4)) });
  return { ...round(m), byModel: Object.fromEntries(Object.entries(m.byModel).map(([k, v]) => [k, round(v)])) };
}

// `routing: true` sends a call to Haiku at low effort. Writing a stock-photo
// search query or picking one of three candidates is mechanical work, not
// editorial judgement, and lib/images.js has routed exactly these calls through
// Haiku since the cost pass; this script never got the same treatment and had
// been doing them on Opus at five times the rate, thinking at the default high
// effort. The draft, the editorial gate and the vision check stay on Opus.
async function ask({ system, user, maxTokens = 16000, images = [], routing = false }) {
  const content = images.length
    ? [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })), { type: "text", text: user }]
    : user;
  const res = await client.messages.create({
    model: routing ? ROUTING_MODEL : MODEL,
    max_tokens: maxTokens,
    // Haiku 4.5 predates adaptive thinking and the effort parameter: sending
    // either returns 400 "adaptive thinking is not supported on this model".
    // Routing calls need neither, which is why lib/images.js sends a bare
    // request too.
    ...(routing ? {} : { thinking: { type: "adaptive" } }),
    system,
    messages: [{ role: "user", content }],
  });
  const m = meters.getStore();
  // Price against what actually served the request, not what was asked for.
  if (m && res.usage) meterAdd(m, res.model || (routing ? ROUTING_MODEL : MODEL), res.usage);
  if (res.stop_reason === "refusal") throw new Error("model refused");
  return textOf(res);
}

function wpBase() {
  return `${process.env.WP_URL.replace(/\/$/, "")}/wp-json/wp/v2`;
}
function wpAuth() {
  return Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");
}

/* -------------------------------------------------------------- source text */

async function fetchSourceText(url) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 16000) || null;
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- link map */

async function liveLinks() {
  const res = await fetch(
    `${wpBase()}/posts?per_page=100&orderby=date&order=desc&status=publish&_fields=id,link,title,excerpt`,
    { headers: { authorization: `Basic ${wpAuth()}`, ...UA } }
  );
  if (!res.ok) throw new Error(`WP posts ${res.status}`);
  const posts = await res.json();
  const clean = (s) =>
    (s || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  return posts.map((p) => ({
    url: p.link,
    title: clean(p.title?.rendered),
    summary: clean(p.excerpt?.rendered).slice(0, 160),
  }));
}

function linkBlock(links) {
  return links.map((l) => `- ${l.url}\n  "${l.title}" (${l.summary})`).join("\n");
}

/* ------------------------------------------------------------------ imagery */

/*
 * A shoot key names the photo SET a candidate came from, not the file.
 *
 * Stock libraries sell shoots: search Pexels for anything AI-flavoured and the
 * top results are six frames of the same man at the same laptop with the same
 * glasses on the same fabric, each under its own URL. Deduping on the URL alone
 * counted all six as different pictures, and three of them ran together in the
 * AI & Automation section. Keying on the photographer collapses a shoot to one
 * entry, which is the unit a reader actually notices.
 */
function shootKey(c) {
  const who = String(c.creatorId || c.creator || "").trim().toLowerCase();
  return who ? `${c.source.toLowerCase()}:${who}` : null;
}

// Deterministic per-title seed for rotating result lists. Two articles on
// near-identical subjects write near-identical queries and get back the same
// ranked page; without this they keep meeting at the top of it.
function seed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function rotate(list, n) {
  if (list.length < 2) return list;
  const at = n % list.length;
  return list.slice(at).concat(list.slice(0, at));
}

// 30 results rather than 12: a short page is mostly one or two shoots, so once
// those are excluded there is nothing left to choose from.
async function pexels(q, rot = 0) {
  if (!process.env.PEXELS_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=30&orientation=landscape&size=large`,
      { headers: { authorization: process.env.PEXELS_API_KEY, ...UA } }
    );
    if (!res.ok) return [];
    return rotate(
      ((await res.json()).photos || []).map((p) => ({
        source: "Pexels",
        title: p.alt || "",
        tags: "",
        url: p.src?.original ? `${p.src.original}?auto=compress&cs=tinysrgb&w=2000` : p.src?.large2x,
        thumb: p.src?.large2x || p.src?.large,
        width: p.width || 0,
        creator: p.photographer,
        creatorId: p.photographer_id,
        license: "Pexels",
        needsCredit: false,
      })),
      rot
    );
  } catch {
    return [];
  }
}

async function openverse(q, params) {
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&per_page=10&filter_dead=true&${params}`,
      { headers: UA, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    return ((await res.json()).results || []).map((r) => ({
      source: "Openverse",
      title: r.title || "",
      tags: (r.tags || []).map((t) => t.name).slice(0, 8).join(", "),
      url: r.url,
      thumb: r.thumbnail,
      width: r.width || 0,
      creator: r.creator,
      license: r.license,
      needsCredit: !["cc0", "pdm"].includes(r.license),
    }));
  } catch {
    return [];
  }
}

// Download and report real pixel dimensions: the API's width field lies often
// enough that "high resolution" has to be measured, not trusted.
async function grab(url) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!ct.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength < 40000) return null;
    const meta = await sharp(bytes).metadata();
    return { bytes, type: ct, width: meta.width || 0, height: meta.height || 0 };
  } catch {
    return null;
  }
}

async function verifyImage({ file, title, keyphrase }) {
  let data = file.bytes;
  let type = file.type;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) || data.byteLength > 4_500_000) {
    data = await sharp(data, { density: 200 })
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    type = "image/jpeg";
  }
  const out = await ask({
    maxTokens: 900,
    system: `You are the picture editor for ${siteName()}, a UK trade publication. You are shown a candidate header image and the article it would illustrate. Catch mistakes before publication.

REJECT (verdict "no") if ANY of these are true:
- The image does not clearly relate to the article's subject.
- The article names specific brands or products and the image shows a DIFFERENT brand, or a logo that is not the one named. Wrong logos are the most serious failure possible.
- The image contains text, watermarks or logos that would confuse or mislead a reader.
- It looks like a meme, clipart, a random webpage screenshot, a map, an unreadable chart, or an obviously staged 2000s stock photo.
- The subject is a recognisable named individual (we do not have permission).
- Quality is poor: blurry, distorted, badly cropped, over-processed, or too dark to read at a glance.

ACCEPT (verdict "yes") only if a professional editor would be comfortable seeing this at the top of the article in print quality.

Reply ONLY with JSON:
{"verdict":"yes"|"no","score":<0-100 relevance>,"reason":"<one sentence>","alt":"<SEO alt text under 120 chars describing what is actually visible, including the keyphrase if it fits naturally>"}`,
    user: `Article headline: "${title}"\nTarget keyphrase: ${keyphrase || "n/a"}\n\nIs this image safe and appropriate to publish as this article's header?`,
    images: [{ type, data: data.toString("base64") }],
    // Picture gate on the cheap tier. Judging whether a photo shows the right
    // subject is mechanical, not editorial, and every rejection re-sends a full
    // image: one article in the first fleet batch spent $0.80 over 12 Opus
    // vision calls and still published nothing.
    routing: true,
  });
  const verdict = (field(out, "verdict") || "").toLowerCase();
  const score = parseInt(field(out, "score") || "0", 10) || 0;
  return { ok: verdict === "yes" && score >= 65, score, reason: field(out, "reason"), alt: field(out, "alt") };
}

const MIN_WIDTH = 1400; // header images must be genuinely high resolution

async function chooseImage({ title, keyphrase, brief, used, usedShoots = new Set(), nearby = [] }) {
  let queries = [];
  try {
    queries = JSON.parse(
      (
        await ask({
          routing: true,
          maxTokens: 600,
          system:
            "You choose stock photo search queries for the header image of a UK business magazine article. Reply with ONLY a JSON array of 4 strings, most specific first. Describe the VISUAL subject wanted (real objects, people at work, screens, places), never abstract concepts. Avoid queries that would return logos, memes or charts.",
          user:
            `Article: "${title}"\nKeyphrase: ${keyphrase || "n/a"}\nWhat it covers: ${(brief || "").slice(0, 400)}\n` +
            (nearby.length
              ? `\nRecent header images in this section, which you must NOT restate — pick visibly different subjects, settings and framing:\n${nearby
                  .map((a) => `- ${a}`)
                  .join("\n")}\n`
              : "") +
            `\nFour search queries for the header photo.`,
        })
      ).replace(/^```json?\s*|\s*```$/g, "")
    );
  } catch {
    queries = [keyphrase || title];
  }

  const rot = seed(title);
  let candidates = [];
  for (const q of queries) {
    candidates = candidates.concat(await pexels(q, rot));
    if (candidates.length >= 20) break;
  }
  if (candidates.length < 10) {
    for (const q of queries) {
      candidates = candidates.concat(await openverse(q, "license=cc0,pdm"));
    }
  }
  candidates = candidates.filter((c) => c.url && !used.has(c.url) && (c.width || 0) >= MIN_WIDTH);
  // One entry per URL, one entry per shoot, and nothing from a shoot the
  // archive has run recently. Without the shoot rules the shortlist below can
  // be six views of a single desk wearing six different hats.
  const seen = new Set();
  const offered = new Set();
  candidates = candidates.filter((c) => {
    if (seen.has(c.url)) return false;
    const key = shootKey(c);
    if (key && (usedShoots.has(key) || offered.has(key))) return false;
    seen.add(c.url);
    if (key) offered.add(key);
    return true;
  });
  if (!candidates.length) return null;
  candidates = candidates.slice(0, 20);

  const pickRaw = await ask({
    routing: true,
    maxTokens: 600,
    system:
      'You pick the most RELEVANT header image for a UK business magazine article from candidate metadata. Prefer clearly on-topic, professional, modern, uncluttered photographs. Avoid memes, maps, diagrams, identifiable individuals and anything off-topic. Reply ONLY with JSON: {"pick": <index>, "second": <index>, "third": <index>}',
    user: `Article: "${title}"\nWhat it covers: ${(brief || "").slice(0, 300)}\n\nCandidates:\n${candidates
      .map((c, i) => `${i}. [${c.source}] "${c.title}" ${c.tags ? `tags: ${c.tags}` : ""} (${c.width}px wide)`)
      .join("\n")}`,
  });
  const order = ["pick", "second", "third"]
    .map((k) => parseInt(field(pickRaw, k) ?? "-1", 10))
    .concat(candidates.map((_, i) => i))
    .filter((i, n, arr) => Number.isInteger(i) && i >= 0 && i < candidates.length && arr.indexOf(i) === n);

  for (const idx of order.slice(0, 6)) {
    const cand = candidates[idx];
    const file = (await grab(cand.url)) || (await grab(cand.thumb));
    if (!file || file.width < MIN_WIDTH) continue;
    const check = await verifyImage({ file, title, keyphrase });
    if (!check.ok) {
      log(`   image rejected (${check.score}): ${check.reason}`);
      continue;
    }
    return {
      url: cand.url,
      file,
      alt: check.alt,
      score: check.score,
      source: shootKey(cand),
      credit: cand.needsCredit && cand.creator ? `Image: ${cand.creator} (${cand.license}) via ${cand.source}` : null,
    };
  }
  return null;
}

/* ----------------------------------------------------------------- drafting */

// Identity comes from the Site row, not from this file. Hardcoded, it told the
// model it wrote for Smart SME whatever title the run was actually publishing
// to — so a fleet article would be drafted for SME owner-managers, in an SME
// voice, and only the topic would give it away. A function rather than a const
// because the site is resolved in the runner, after this module is evaluated.
const siteName = () => global.__BATCH_SITE?.name || "this publication";
const siteAudience = () => global.__BATCH_SITE?.audience || "UK business decision-makers";

const houseStyle = () => `You write for ${global.__BATCH_SITE?.name || "this publication"}${
  global.__BATCH_SITE?.strapline ? `, "${global.__BATCH_SITE.strapline}"` : ""
}.
Audience: ${global.__BATCH_SITE?.audience || "UK business decision-makers"}.
Voice: plain English, specific, practical, confident without hype. UK spelling and UK context throughout.
Short paragraphs of two to four sentences. Explain jargon on first use. Every section must answer
"what does this mean for my business, and what do I do about it?".

HARD RULES
1. NEVER use em dashes or en dashes anywhere: not in the headline, body, or metadata. Use commas,
   full stops, colons, semicolons or brackets. Hyphens inside compound words are fine.
2. NEVER invent statistics, survey findings, prices you cannot stand behind, quotes, or named case
   studies. If a number would strengthen a point but you do not have a verifiable one, make the point
   qualitatively instead. Describe pricing as approximate and note it can change.
3. Do not pad. Every paragraph must carry information a reader could act on.
4. No first-person plural marketing voice ("we believe"), no "In today's fast-paced world" openings,
   no "delve", "landscape", "leverage", "robust", "seamless", "game-changer", "unlock", "elevate".
5. Do not repeat the headline as an H1. The page template already prints the title.

LINKING (mandatory, and links must be exact URLs from the list supplied)
- Internal links: weave links to other articles on this site into sentences using descriptive anchor
  text that reads naturally. Never "click here", never a bare URL, never a "related reading" dump.
- Outbound links: link authoritative primary sources (gov.uk, hmrc, ico.org.uk, ncsc.gov.uk, the
  vendor's own page, the original announcement). Never link a source you are not certain exists.
- Name the providers. Where the topic touches software, tools, suppliers or services, name the
  real companies rather than writing around them. "Accounting software" is a wasted sentence;
  "Xero, QuickBooks, FreeAgent and Sage" tells the reader where to look. Four or more named
  providers wherever they are genuinely relevant, each linked to its own site on first mention,
  covering the UK options a reader would actually shortlist rather than only the biggest American
  names. A comparison table should carry real product names in its rows.
- The line you must not cross: name real companies and describe what they are generally known to
  do. Never invent a product, feature, price, customer or statistic to make a brand fit. If you
  are unsure whether a company offers something, say what it is known for and leave the specifics
  out, or write the paragraph without that fact. A named company with nothing invented about it
  is what is wanted; a plausible fabrication about a real company is the worst possible outcome.

OUTPUT
Return the eight header lines below, then the article as clean WordPress-ready HTML using
<h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <strong> and <a href>. No markdown, no code fences,
no <html>/<head>/<body> wrapper, no H1.
TITLE: <the headline, 55-70 characters, keyword-bearing, no clickbait>
SCORE: <0-100 estimate of this article's value to this publication: search demand, evergreen life, internal linking value, audience fit>
SCORE_WHY: <one sentence>
CATEGORY: <exactly one of: ${(global.__BATCH_SITE?.sections || []).map((s) => s.name).join(" | ") || "News"}>
KEYPHRASE: <Yoast focus keyphrase, 2-5 words, present in the headline and in the first paragraph>
META_DESC: <meta description, 120-155 characters, contains the keyphrase, reads like a promise>
IMAGE_QUERY: <2-4 words describing the ideal header photograph>
IMAGE_ALT: <alt text under 120 chars>`;

function draftPrompt(spec, sourceText, links) {
  const shared = `
Existing ${siteName()} articles you may link to (use these EXACT URLs, nothing else, and only where the link genuinely helps the reader):
${linkBlock(links)}
`;

  if (spec.type === "pr_rewrite") {
    return `Write an in-depth news analysis for ${siteName()}: 700 to 1,000 words. This is not a press release rewrite and not a squib. It is the piece one of your readers (${siteAudience()}) reads to understand what just happened and what to do about it.

Working headline: ${spec.title}
Source: ${spec.brandName}
Original URL: ${spec.sourceUrl}

Editorial brief:
${spec.brief}

Structure:
- Open with the development itself and why it matters to a UK small business, in the first two sentences. No throat-clearing.
- An <h2> section giving the substance of the announcement, attributed clearly to ${spec.brandName}, with one link to the original at ${spec.sourceUrl}.
- An <h2> section on the context: what changed, what it replaces, who is affected.
- An <h2> "What this means for your business" section with concrete implications.
- An <h2> closing section of 3 or 4 practical steps as a numbered list.
Include 2 to 4 internal links from the list below, and 1 to 2 outbound links to primary sources.
Stay strictly within what the source supports. Do not attribute claims to ${spec.brandName} that it did not make, and do not invent figures.

Source material:
${sourceText || "(The source page could not be fetched. Write only from the brief and widely established public facts, stay general, and do not invent specifics, figures or quotes.)"}
${shared}`;
  }

  return `Write a definitive, original SEO guide for ${siteName()}: 1,800 to 2,400 words. Depth is the point. This should be the most useful page on the UK internet for this query, and a reader should be able to act on it without reading anything else.

Working title: ${spec.title}
Target keywords: ${spec.keywords}
Editorial brief (cover all of this, in a sensible order of your own choosing):
${spec.brief}

Requirements:
- First two paragraphs must directly answer the question implied by the title. No preamble.
- Then <h2> sections. Use <h3> inside them where a section has distinct parts.
- At least one real <table> comparing options, with a header row and a "best for" column. Keep it to five columns or fewer so it reads on a phone.
- Concrete UK detail: pounds, HMRC, Companies House, the ICO, UK providers. Approximate prices only, flagged as approximate and subject to change.
- A short section on the mistakes people actually make.
- An FAQ of 5 genuine questions people ask, each as an <h3> with a two to four sentence answer.
- Close with an <h2> "What to do next" of 3 or 4 numbered, specific steps.
- 4 to 6 internal links from the list below, woven into sentences. 2 to 3 outbound links to authoritative primary sources.
${shared}`;
}

/* ----------------------------------------------------------------------- QA */

function knownUrlSet(links) {
  const s = new Set();
  for (const l of links) {
    s.add(l.url);
    s.add(l.url.replace(/\/$/, ""));
  }
  return s;
}

function mechanicalIssues({ title, body, type, keyphrase, metaDesc }, links) {
  const issues = [];
  const plain = (body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(" ").filter(Boolean).length;
  const minWords = type === "pr_rewrite" ? 650 : 1600;
  if (words < minWords) issues.push(`Too short: ${words} words, minimum ${minWords} for ${type}`);
  if (/[—–]/.test(title + body + (metaDesc || ""))) issues.push("Contains em or en dashes (house rule)");
  if (/<h1[\s>]/i.test(body)) issues.push("Contains an H1; the template prints the title");
  if (!keyphrase) issues.push("Missing focus keyphrase");
  if (!metaDesc) issues.push("Missing meta description");
  else if (metaDesc.length < 115 || metaDesc.length > 158) issues.push(`Meta description is ${metaDesc.length} chars, want 120-155`);
  // "N/A" is legitimate in a comparison table, so it is not a placeholder tell.
  if (/lorem ipsum|\bTODO\b|\[insert|\[placeholder|XX%|your company name here/i.test(body))
    issues.push("Contains placeholder text");

  const known = knownUrlSet(links);
  const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  // The host was hardcoded to smartsme.co.uk. On any other title that
  // misclassifies every internal link as outbound, so the internal-link gate
  // can never be satisfied and the outbound count is inflated by the site's own
  // links. Derive it from the credential the run is actually publishing with.
  const host = String(process.env.WP_URL || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const isInternal = (h) => host && h.toLowerCase().includes(host.toLowerCase());
  const internal = hrefs.filter(isInternal);
  const bad = internal.filter((h) => !known.has(h) && !known.has(h.replace(/\/$/, "")));
  if (bad.length) issues.push(`Invented internal URLs (not on the site): ${bad.slice(0, 4).join(", ")}`);
  // Never ask for more internal links than the site can actually supply. A new
  // title has no published posts, so a fixed floor of four is unsatisfiable and
  // holds every article forever — which is exactly what the seed_content
  // provisioning step exists to work around, by hand. Scale to what exists.
  const minInternal = Math.min(type === "pr_rewrite" ? 2 : 4, links.length);
  if (minInternal > 0 && internal.length - bad.length < minInternal)
    issues.push(`Only ${internal.length - bad.length} valid internal links, want at least ${minInternal}`);
  // Outbound citations are an authority signal, so one is not enough.
  const outbound = [...new Set(hrefs.filter((h) => /^https?:\/\//i.test(h) && !isInternal(h)))];
  if (outbound.length < 2) issues.push(`Only ${outbound.length} outbound link(s) to primary sources, want at least 2`);
  if (/>click here</i.test(body)) issues.push('Uses "click here" anchor text');
  if (type !== "pr_rewrite" && !/<table[\s>]/i.test(body)) issues.push("No comparison table");
  if (type !== "pr_rewrite" && (body.match(/<h2[\s>]/gi) || []).length < 4) issues.push("Fewer than four H2 sections");
  if (keyphrase) {
    const head = plain.slice(0, 800).toLowerCase();
    const stem = keyphrase.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
    if (!head.includes(stem)) issues.push("Keyphrase not present near the top");
  }
  return { issues, words };
}

async function editorialReview({ title, body, type, keyphrase }) {
  const out = await ask({
    maxTokens: 1600,
    system: `You are the editor of ${siteName()}. Your readers: ${siteAudience()}. Review this article as if it publishes in ten minutes under your name and your reputation is on the line.

Flag ONLY genuine problems:
- Factual claims that look invented or unverifiable: specific statistics, prices, dates, quotes, named customers.
- Claims about named companies or public bodies that the source would not support.
- Advice that could harm a small business if wrong: tax, employment law, data protection, security.
- Anything legally risky or defamatory.
- Contradictions, repetition, padding, robotic phrasing, broken or invalid HTML.
- Sections that promise something the article never delivers.

Do not invent problems, do not ask for more length, do not comment on style preferences you cannot justify.

Reply ONLY with JSON:
{"verdict":"publish"|"fix","score":<0-100 editorial quality>,"issues":["specific, actionable"],"summary":"<one sentence>"}`,
    user: `Type: ${type}\nHeadline: ${title}\nKeyphrase: ${keyphrase || "n/a"}\n\n${body.slice(0, 40000)}`,
  });
  const summary = field(out, "summary") || "";
  const score = parseInt(field(out, "score") || "0", 10) || 0;
  const verdict = (field(out, "verdict") || "").toLowerCase();
  const issues = [...out.matchAll(/"([^"]{20,300})"/g)]
    .map((m) => m[1])
    .filter((s) => s !== summary && !/^(publish|fix)$/i.test(s));
  return { verdict, score, issues, summary };
}

/* ------------------------------------------------------------------ parsing */

function parseDraft(raw, spec) {
  let body = raw.trim();
  const out = {
    title: stripDashes(headerLine(body, "TITLE") || spec.title),
    score: parseInt(headerLine(body, "SCORE") || "", 10),
    scoreRationale: headerLine(body, "SCORE_WHY"),
    // The plan wins, and the model's header is the fallback rather than the
    // other way round. The brief chose the section deliberately against the
    // demand map; the model only ever guesses. Whichever it is, it must be one
    // of THIS title's sections — the prompt used to offer Smart SME's five to
    // every title, so ten fleet articles were filed under Finance and
    // Operations, matched no category on the site, and landed in Uncategorized.
    category: (() => {
      const sections = (global.__BATCH_SITE?.sections || []).map((s) => s.name);
      const norm = (s) => String(s || "").trim().toLowerCase();
      for (const candidate of [spec.category, headerLine(body, "CATEGORY")]) {
        const hit = sections.find((s) => norm(s) === norm(candidate));
        if (hit) return hit;
      }
      return sections.includes("News") ? "News" : sections[0] || null;
    })(),
    keyphrase: headerLine(body, "KEYPHRASE"),
    metaDesc: stripDashes(headerLine(body, "META_DESC")),
    // A plan entry may override the drafted image query with `imageQuery`.
    //
    // The drafting prompt asks for "2-4 words describing the ideal header
    // photograph" and the model always derives them from the subject, which is
    // right almost always and catastrophic for a few topics. Golf Resort
    // Magazine's construction-cost piece failed the picture gate eighteen times
    // across three runs: every query containing "construction" returns
    // excavators, quarries and road rollers, and the gate correctly rejects all
    // of them for having no golf in the frame. Its consolidation piece pulled
    // stock boardroom handshakes for the same reason. Instructing the model in
    // the brief does not work — the header line is regenerated from the article
    // each time and the instruction is ignored.
    //
    // Opt-in and absent from every existing plan, so no other title changes.
    imageQuery: spec?.imageQuery || headerLine(body, "IMAGE_QUERY"),
    imageAlt: stripDashes(headerLine(body, "IMAGE_ALT")),
  };
  const start = body.indexOf("<");
  if (start > 0) body = body.slice(start).trim();
  out.body = stripDashes(body).replace(/```html?|```/g, "").trim();
  return out;
}

/* --------------------------------------------------------------- publishing */

async function uploadMedia({ file, alt, filename }) {
  // Normalise to a sensibly sized, sharp JPEG: full-bleed headers need width,
  // not a 6MB original.
  const buf = await sharp(file.bytes)
    .rotate()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(buf).metadata();

  const res = await fetch(`${wpBase()}/media`, {
    method: "POST",
    headers: {
      authorization: `Basic ${wpAuth()}`,
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="${filename}.jpg"`,
      ...UA,
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`WP media ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const media = await res.json();
  if (alt) {
    await fetch(`${wpBase()}/media/${media.id}`, {
      method: "POST",
      headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json", ...UA },
      body: JSON.stringify({ alt_text: alt }),
    });
  }
  return { id: media.id, url: media.source_url, width: meta.width, height: meta.height };
}

let categoryCache = null;
async function resolveCategory(name) {
  if (!name) return null;
  if (!categoryCache) {
    const res = await fetch(`${wpBase()}/categories?per_page=100&_fields=id,name`, {
      headers: { authorization: `Basic ${wpAuth()}`, ...UA },
    });
    categoryCache = res.ok ? await res.json() : [];
  }
  const clean = (s) => s.replace(/&amp;/g, "&").trim().toLowerCase();
  return categoryCache.find((c) => clean(c.name) === clean(name))?.id || null;
}

async function publish({ title, body, mediaId, categoryId, keyphrase, metaDesc }) {
  const res = await fetch(`${wpBase()}/posts`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json", ...UA },
    body: JSON.stringify({
      title,
      content: body,
      status: "publish",
      ...(mediaId ? { featured_media: mediaId } : {}),
      ...(global.__BATCH_AUTHOR_ID ? { author: global.__BATCH_AUTHOR_ID } : {}),
      ...(categoryId ? { categories: [categoryId] } : {}),
      ...(metaDesc ? { excerpt: metaDesc } : {}),
      meta: {
        ...(keyphrase ? { _yoast_wpseo_focuskw: keyphrase } : {}),
        ...(metaDesc ? { _yoast_wpseo_metadesc: metaDesc } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`WP post ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const post = await res.json();
  return { id: post.id, link: post.link };
}

/* ------------------------------------------------------------------ one job */

// Every article runs inside its own meter, and whatever it produced (published,
// held, or thrown) carries the measured cost back out.
async function runOne(spec, links, usedImages, archive) {
  const m = newMeter();
  return meters.run(m, async () => {
    try {
      const out = await runOneMetered(spec, links, usedImages, archive);
      const cost = meterTotal(m);
      const split = Object.entries(cost.byModel)
        .map(([k, v]) => `${k.includes("haiku") ? "haiku" : "opus"} $${v.usd.toFixed(4)}`)
        .join(", ");
      log(`[${spec.key}] cost $${cost.usd.toFixed(4)} over ${cost.calls} calls (${split})`);
      // Persist against the article so the Finance Manager can see spend it did
      // not make itself. Without it, cost per article divides agent-only spend
      // by a count that includes every batch article, and reports near zero.
      if (out.articleId) {
        await prisma.article
          .update({ where: { id: out.articleId }, data: { costUsd: cost.usd } })
          .catch((e) => log(`[${spec.key}] could not record cost: ${e.message}`));
      }
      return { ...out, cost };
    } catch (err) {
      err.cost = meterTotal(m);
      throw err;
    }
  });
}

async function runOneMetered(spec, links, usedImages, archive) {
  log(`[${spec.key}] drafting (${spec.type})`);
  const sourceText = spec.sourceUrl ? await fetchSourceText(spec.sourceUrl) : null;
  if (spec.sourceUrl) log(`[${spec.key}] source text: ${sourceText ? `${sourceText.length} chars` : "UNAVAILABLE"}`);

  let draft = parseDraft(await ask({ system: houseStyle(), user: draftPrompt(spec, sourceText, links) }), spec);
  log(`[${spec.key}] drafted "${draft.title}"`);

  // Two QA gates, with one revision pass if either complains.
  let mech = mechanicalIssues({ ...draft, type: spec.type }, links);
  let review = await editorialReview({ ...draft, type: spec.type });
  let issues = [...mech.issues, ...(review.verdict === "publish" && review.score >= 75 ? [] : review.issues)];

  if (issues.length) {
    log(`[${spec.key}] QA round 1: ${mech.words} words, ${issues.length} issue(s)`);
    issues.forEach((i) => log(`   - ${i}`));
    const revised = await ask({
      system: houseStyle(),
      user: `Below is a draft article for this publication and the editor's fix list. Rewrite the article so every point is resolved. Keep everything that already works: do not restructure for its own sake, do not shorten, and do not drop valid internal links. Return the full corrected article in the standard output format (the eight header lines then the HTML).

EDITOR'S FIX LIST:
${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}

${spec.type === "pr_rewrite" ? `The source is ${spec.brandName} at ${spec.sourceUrl}. Do not add claims the source does not support.` : ""}
Internal links must come from this exact list only:
${linkBlock(links)}

CURRENT DRAFT
TITLE: ${draft.title}
KEYPHRASE: ${draft.keyphrase}
META_DESC: ${draft.metaDesc}

${draft.body}`,
    });
    const next = parseDraft(revised, spec);
    const nextMech = mechanicalIssues({ ...next, type: spec.type }, links);
    const nextReview = await editorialReview({ ...next, type: spec.type });
    const nextIssues = [
      ...nextMech.issues,
      ...(nextReview.verdict === "publish" && nextReview.score >= 75 ? [] : nextReview.issues),
    ];
    log(`[${spec.key}] QA round 2: ${nextMech.words} words, ${nextIssues.length} issue(s)`);
    nextIssues.forEach((i) => log(`   - ${i}`));
    // Take the revision when it is genuinely better.
    if (nextIssues.length <= issues.length) {
      draft = next;
      mech = nextMech;
      review = nextReview;
      issues = nextIssues;
    }
  }

  const blocking = issues.filter((i) => !/^Meta description is/.test(i));
  if (blocking.length) {
    log(`[${spec.key}] HELD BACK, unresolved: ${blocking.length}`);
    return { key: spec.key, status: "held", issues: blocking, words: mech.words, draft };
  }

  log(`[${spec.key}] sourcing image`);
  const image = await chooseImage({
    title: draft.title,
    keyphrase: draft.keyphrase,
    brief: spec.brief,
    used: usedImages,
    usedShoots: archive.shoots,
    nearby: archive.alts.get(draft.category) || [],
  });
  if (!image) {
    log(`[${spec.key}] HELD BACK: no image passed the picture gate`);
    return { key: spec.key, status: "held", issues: ["no usable header image"], words: mech.words, draft };
  }
  usedImages.add(image.url);
  // Claim the shoot immediately: a wave runs its articles in parallel, so
  // without this two of them can pick different frames of one shoot at once.
  if (image.source) archive.shoots.add(image.source);
  log(`[${spec.key}] image ${image.file.width}x${image.file.height} (score ${image.score})`);

  let body = draft.body;
  if (image.credit) body += `\n<p class="image-credit"><em>${image.credit}</em></p>`;

  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const media = await uploadMedia({ file: image.file, alt: image.alt || draft.imageAlt, filename: slug });
  log(`[${spec.key}] media #${media.id} at ${media.width}x${media.height}`);

  const categoryId = await resolveCategory(draft.category);
  const post = await publish({
    title: draft.title,
    body,
    mediaId: media.id,
    categoryId,
    keyphrase: draft.keyphrase,
    metaDesc: draft.metaDesc,
  });
  log(`[${spec.key}] PUBLISHED #${post.id} ${post.link}`);

  const article = await prisma.article.create({
    data: {
      siteId: global.__BATCH_SITE.id,
      title: draft.title,
      type: spec.type,
      status: "published",
      sourceItemId: spec.sourceItemId || null,
      sourceUrl: spec.sourceUrl || null,
      keywords: spec.keywords || null,
      body,
      wpPostId: post.id,
      seoScore: Number.isFinite(draft.score) ? Math.min(100, Math.max(0, draft.score)) : null,
      scoreRationale: draft.scoreRationale,
      imageUrl: image.url,
      imageAlt: image.alt || draft.imageAlt,
      imageCredit: image.credit,
      imageSource: image.source,
      category: draft.category,
      keyphrase: draft.keyphrase,
      metaDesc: draft.metaDesc,
      qaPassed: true,
      qaReport: JSON.stringify(
        { words: mech.words, editorial: review.score, summary: review.summary, imageScore: image.score },
        null,
        1
      ),
      publishedAt: new Date(),
    },
  });
  if (spec.sourceItemId) {
    await prisma.feedItem.update({ where: { id: spec.sourceItemId }, data: { status: "drafted" } }).catch(() => {});
  }

  return {
    key: spec.key,
    status: "published",
    wpPostId: post.id,
    link: post.link,
    title: draft.title,
    words: mech.words,
    category: draft.category,
    keyphrase: draft.keyphrase,
    metaDesc: draft.metaDesc,
    seoScore: draft.score,
    editorialScore: review.score,
    image: { url: image.url, width: media.width, height: media.height, alt: image.alt },
    articleId: article.id,
  };
}

/* -------------------------------------------------------------------- runner */

(async () => {
  // --- tenancy -----------------------------------------------------------
  //
  // This script predated the multi-title rebuild: it read WP_URL, WP_USERNAME
  // and WP_APP_PASSWORD straight from the environment and wrote Article rows
  // with no siteId. Those env vars no longer exist, because credentials moved
  // into SiteCredential encrypted per title — so it would have crashed, and if
  // the vars HAD still been set it would have published one title's articles
  // onto another's WordPress. Resolve the title first, then hand the rest of
  // the script the same env vars it always expected.
  const slug = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1];
  if (!slug) {
    console.error("Refusing to run without --site=<slug>.");
    process.exit(1);
  }
  const SITE = await prisma.site.findUnique({ where: { slug } });
  if (!SITE) {
    console.error(`No title with slug "${slug}".`);
    process.exit(1);
  }
  const { siteCredentials } = await import("../lib/site.js");
  const { creds } = await siteCredentials(SITE.id);
  const wp = creds.wordpress;
  if (!wp?.url) {
    console.error(`${SITE.name} has no WordPress credential stored.`);
    process.exit(1);
  }
  process.env.WP_URL = wp.url;
  process.env.WP_USERNAME = wp.username;
  process.env.WP_APP_PASSWORD = wp.appPassword;
  UA = {
    "user-agent": `${String(SITE.name).replace(/[^A-Za-z0-9]/g, "")}Bot/1.0 (${String(wp.url).replace(/^https?:\/\//, "")} editorial)`,
  };

  // Byline, honouring the title's bylineMode. Null falls back to the account
  // holding the application password, exactly as publishing does elsewhere.
  const { authorForSite } = await import("../lib/wordpress.js");
  global.__BATCH_SITE = SITE;
  global.__BATCH_AUTHOR_ID = await authorForSite(wp, SITE);

  const planPath = (process.argv.find((a) => a.startsWith("--plan=")) || "").split("=")[1]
    || path.join(__dirname, `batch-plan-${slug}.json`);
  if (!fs.existsSync(planPath)) {
    console.error(`No plan file at ${planPath}`);
    process.exit(1);
  }
  log(`${SITE.name} — ${wp.url} — plan ${path.basename(planPath)} — byline ${global.__BATCH_AUTHOR_ID ?? "(engine account)"}`);

  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const resultsFile = RESULTS.replace(/\.json$/, `-${slug}.json`);
  const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, "utf8")) : {};

  const history = await prisma.article.findMany({
    where: { siteId: SITE.id, imageUrl: { not: null } },
    select: { imageUrl: true, imageSource: true, imageAlt: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  const usedImages = new Set(history.map((a) => a.imageUrl));
  // Shoots expire from the exclusion list after forty articles; URLs never do.
  // `alts` is art direction rather than exclusion: the query writer is shown
  // what its own section has been running and told to go elsewhere.
  const archive = {
    shoots: new Set(history.slice(0, 40).map((a) => a.imageSource).filter(Boolean)),
    alts: history.reduce((map, a) => {
      if (!a.imageAlt) return map;
      const list = map.get(a.category) || [];
      if (list.length < 5) map.set(a.category, list.concat(a.imageAlt));
      return map;
    }, new Map()),
  };
  log(`${usedImages.size} images and ${archive.shoots.size} recent shoots already used across the archive`);

  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

  for (const [n, wave] of plan.waves.entries()) {
    const todo = wave.filter((s) => results[s.key]?.status !== "published" && (!only.length || only.includes(s.key)));
    if (!todo.length) continue;

    const links = await liveLinks();
    log(`\n=== WAVE ${n + 1}: ${todo.map((s) => s.key).join(", ")} (${links.length} live posts to link to) ===`);

    const settled = await Promise.allSettled(todo.map((s) => runOne(s, links, usedImages, archive)));
    settled.forEach((r, i) => {
      const key = todo[i].key;
      results[key] =
        r.status === "fulfilled"
          ? { ...r.value, draft: undefined }
          : // A failed article still burned tokens; record what it spent rather
            // than losing it, or the batch total under-reports every retry.
            { key, status: "error", error: r.reason?.message || String(r.reason), cost: r.reason?.cost };
      if (r.status === "rejected") log(`[${key}] ERROR ${results[key].error}`);
      if (r.status === "fulfilled" && r.value.status === "held") {
        fs.writeFileSync(path.join(__dirname, `held-${key}.html`), r.value.draft?.body || "");
      }
    });
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  }

  log("\n=== SUMMARY ===");
  Object.values(results).forEach((r) =>
    log(`${r.status.toUpperCase().padEnd(9)} ${r.key.padEnd(20)} ${r.words ? `${r.words}w` : ""} ${r.cost ? `$${r.cost.usd.toFixed(4)}` : ""} ${r.link || (r.issues || r.error || []).toString().slice(0, 160)}`)
  );

  // What this run cost, separately from the accumulated state file, so a resumed
  // batch reports its own spend rather than the whole archive's.
  const ran = only.length ? only : Object.keys(results);
  const spent = ran.map((k) => results[k]?.cost).filter(Boolean);
  if (spent.length) {
    const usd = spent.reduce((s, c) => s + c.usd, 0);
    log(
      `\nTHIS RUN: $${usd.toFixed(4)} across ${spent.length} article(s) = $${(usd / spent.length).toFixed(4)} each ` +
        `(${spent.reduce((s, c) => s + c.calls, 0)} model calls, ` +
        `${spent.reduce((s, c) => s + c.in, 0).toLocaleString()} in / ${spent.reduce((s, c) => s + c.out, 0).toLocaleString()} out tokens)`
    );
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
