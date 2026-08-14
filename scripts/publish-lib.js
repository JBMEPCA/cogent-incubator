// Shared helpers for the editorial scripts: Anthropic access, WordPress REST,
// high-resolution image sourcing, and the visual picture gate.
// Used by enrich-articles.js. (batch-publish.js carries its own copy for now.)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
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
const UA = { "user-agent": "SmartSMEBot/1.0 (smartsme.co.uk editorial)" };
// This host 403s bot-shaped agents on plain reads; authenticated reads are fine.
const BROWSER_UA = { "user-agent": "Mozilla/5.0" };

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

const headerLine = (text, key) => text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || null;

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

async function ask({ system, user, maxTokens = 16000, images = [] }) {
  const content = images.length
    ? [
        ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })),
        { type: "text", text: user },
      ]
    : user;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("model refused");
  return textOf(res);
}

/* -------------------------------------------------------------- wordpress */

const wpBase = () => `${process.env.WP_URL.replace(/\/$/, "")}/wp-json/wp/v2`;
const wpAuth = () => Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const wpHeaders = () => ({ authorization: `Basic ${wpAuth()}`, ...BROWSER_UA });

async function livePosts(limit = 100) {
  const res = await fetch(
    `${wpBase()}/posts?per_page=${limit}&orderby=date&order=desc&status=publish&_fields=id,link,title,content,excerpt,featured_media,categories,date`,
    { headers: wpHeaders() }
  );
  if (!res.ok) throw new Error(`WP posts ${res.status}`);
  return res.json();
}

const clean = (s) =>
  (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function linkBlock(posts, excludeId) {
  return posts
    .filter((p) => p.id !== excludeId)
    .map((p) => `- ${p.link}\n  "${clean(p.title?.rendered)}" (${clean(p.excerpt?.rendered).slice(0, 150)})`)
    .join("\n");
}

function knownUrlSet(posts) {
  const s = new Set();
  for (const p of posts) {
    s.add(p.link);
    s.add(p.link.replace(/\/$/, ""));
  }
  return s;
}

async function uploadMedia({ file, alt, filename }) {
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
      ...BROWSER_UA,
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`WP media ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const media = await res.json();
  if (alt) {
    await fetch(`${wpBase()}/media/${media.id}`, {
      method: "POST",
      headers: { ...wpHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ alt_text: alt }),
    });
  }
  return { id: media.id, url: media.source_url, width: meta.width, height: meta.height };
}

// Update an existing post. Deliberately never sends `slug` or `date`: the
// permalink and publish date must survive an enrichment pass untouched.
async function updatePost(id, { content, excerpt, keyphrase, metaDesc, featuredMediaId }) {
  const res = await fetch(`${wpBase()}/posts/${id}`, {
    method: "POST",
    headers: { ...wpHeaders(), "content-type": "application/json" },
    body: JSON.stringify({
      ...(content ? { content } : {}),
      ...(excerpt ? { excerpt } : {}),
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      meta: {
        ...(keyphrase ? { _yoast_wpseo_focuskw: keyphrase } : {}),
        ...(metaDesc ? { _yoast_wpseo_metadesc: metaDesc } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`WP update ${id} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/* ------------------------------------------------------------------ imagery */

const MIN_WIDTH = 1400;

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
  // Downscale for the gate: relevance is judgeable at 900px and full-resolution
  // images cost several thousand vision tokens each.
  const data = await sharp(file.bytes)
    .resize(900, 900, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer();

  const out = await ask({
    maxTokens: 900,
    system: `You are the picture editor for Smart SME Magazine, a UK business publication. You are shown a candidate header image and the article it would illustrate. Catch mistakes before publication.

REJECT (verdict "no") if ANY of these are true:
- The image does not clearly relate to the article's subject.
- The article names specific brands or products and the image shows a DIFFERENT brand, or a logo that is not the one named. Wrong logos are the most serious failure possible.
- The image contains text, watermarks or logos that would confuse or mislead a reader.
- It looks like a meme, clipart, a random webpage screenshot, a map, an unreadable chart, or an obviously staged 2000s stock photo.
- The subject is a recognisable named individual (we do not have permission).
- Quality is poor: blurry, distorted, badly cropped, over-processed, or too dark to read at a glance.

ACCEPT (verdict "yes") only if a professional editor would be comfortable seeing this at the top of the article.

Reply ONLY with JSON:
{"verdict":"yes"|"no","score":<0-100 relevance>,"reason":"<one sentence>","alt":"<SEO alt text under 120 chars describing what is actually visible, including the keyphrase if it fits naturally>"}`,
    user: `Article headline: "${title}"\nTarget keyphrase: ${keyphrase || "n/a"}\n\nIs this image safe and appropriate to publish as this article's header?`,
    images: [{ type: "image/jpeg", data: data.toString("base64") }],
  });
  const verdict = (field(out, "verdict") || "").toLowerCase();
  const score = parseInt(field(out, "score") || "0", 10) || 0;
  return { ok: verdict === "yes" && score >= 65, score, reason: field(out, "reason"), alt: field(out, "alt") };
}

async function chooseImage({ title, keyphrase, brief, used, usedShoots = new Set(), nearby = [] }) {
  let queries = [];
  try {
    queries = JSON.parse(
      (
        await ask({
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
    for (const q of queries) candidates = candidates.concat(await openverse(q, "license=cc0,pdm"));
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

module.exports = {
  prisma, client, MODEL, log, ask, field, headerLine, textOf, stripDashes, clean,
  wpBase, wpAuth, wpHeaders, livePosts, linkBlock, knownUrlSet, uploadMedia, updatePost,
  chooseImage, grab, MIN_WIDTH, shootKey,
};
