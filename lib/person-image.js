// A story about a person leads with that person. Never scenery, never stock.
//
// JB's rule, 22 Sep 2026, after three Golf Resort appointment stories went out
// under a driving range, a Pexels fairway and Toptracer's site banner. The
// engine had the word "person" in its classifier all along and threw it away:
// lib/subject-image.js did no own-site lookup for people, took one og:image per
// page, and then fell to a stock search that is explicitly told to AVOID
// recognisable people. For an appointment that guarantees scenery.
//
// WHAT THE HAND TEST ON THOSE THREE TAUGHT (scripts/_person-img-apply.mjs)
//
//  1. The picture is almost always ON the page the story came from. It is the
//     article's lead photo, not necessarily the og:image, and on a WordPress
//     trade site it is served resized ("-1024x683"), so the original is tried
//     first.
//  2. Trade sites burn their own banner into press photos. golfmanagement.online
//     puts a navy GOLF MANAGEMENT strip along the bottom of every one. The photo
//     under it is the company's handout, so the strip is cut off and the result
//     is checked again. A mark INSIDE the frame is still an outright reject.
//  3. Nothing here can recognise a face, so the name is matched on evidence:
//     another outlet's copy of the release names its file JustinHonea.png; a
//     team page puts the name in the alt text. Without a name, only the lead
//     photo of the source page is trusted, because that page is about them.
//  4. A person's own site can carry a rival's badge: Dan Grieve's headshot has a
//     golf magazine's "Top 50 Coaches" graphic on it. Same rule as a watermark.
//
// When nothing passes, the fallback is a name card in the title's colours
// (app/api/card/person), and lib/headshots.js writes to the company for a real
// photo and swaps it in when one arrives. The article is never held for it.
import Anthropic from "@anthropic-ai/sdk";
import {
  SKIP_HOST,
  hostOf,
  fetchText,
  metaImage,
  fetchImage,
  resolveOwnSite,
} from "./subject-image";

const EXTRACT_MODEL = "claude-haiku-4-5";
const VISION_MODEL = "claude-haiku-4-5";

// Headshots are often portrait and smaller than a landscape hero. 560 wide is
// the smallest that still fills a card slot without looking upscaled; the hero
// is cropped by the theme with object-fit: cover.
const MIN_WIDTH = 560;
const MIN_HEIGHT = 500;
const BUDGET_MS = 45000;
const MAX_CHECKS = 5;

// Filenames that are never a portrait. Ad slots ("970x250", "300x600") are the
// ones that matter on trade sites, where the sidebar is wall-to-wall suppliers.
const NOT_A_PORTRAIT =
  /(logo|icon|favicon|sprite|avatar|badge|button|spacer|pixel|placeholder|banner|advert|[-_]ad[-_]|\b(970|728|468|300|160|320)x(250|90|60|600|50)\b|subscribe|newsletter|premium|\.svg|\.gif)/i;

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function textOf(res) {
  let t = "";
  for (const b of res.content || []) if (b.type === "text") t += b.text;
  return t;
}

const squash = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/* ------------------------------------------------------------- classify */

/**
 * Who or what the story is about, stored on the article so no later stage has
 * to ask again.
 *
 * "person" is deliberately broad: an appointment, a promotion, a pro's win, a
 * coach's new school, an award, an obituary, an interview. Two people in one
 * announcement is still a person story, led by whoever the headline leads with.
 */
export async function classifySubject(title, body) {
  const res = await client().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 200,
    system: `You decide what a trade news story is about, for the picture desk.

Reply ONLY with JSON: {"kind":"person|venue|company|none","name":"...","role":"...","org":"..."}

"person": the story is chiefly about one or two named individuals - an appointment, promotion, departure, a player's or coach's news, an award, an interview, a profile, an obituary. An appointment, hire, promotion or departure is ALWAYS "person", even when the headline names only the company and the job ("Toptracer Names COO"): the person is in the article text. Give the LEAD person's full name as written (the one the headline is about; if the headline names only a role, the person who holds it). "role" is their job title or what they do, short, as the story states it. "org" is the organisation they work for or are joining, as written.
"venue": a named course, resort, club or hotel. "company": a single named business, with no individual at the centre. "none": a study, trend, market report, or three or more organisations equally.

For anything but a person, leave role empty and put the organisation in "org" only if there is one. Never invent a name that is not in the text.`,
    messages: [{
      role: "user",
      content: `Headline: ${title}\n\nFirst part of the article:\n${String(body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1200)}`,
    }],
  });
  const text = textOf(res);
  const str = (k) => ((text.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`, "i")) || [])[1] || "").trim();
  const kind = str("kind").toLowerCase() || "none";
  return {
    kind: ["person", "venue", "company", "none"].includes(kind) ? kind : "none",
    name: str("name"),
    role: str("role"),
    org: str("org"),
  };
}

/* ------------------------------------------------------------ candidates */

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : "";
}

function largestFromSrcset(srcset) {
  let best = null;
  for (const part of String(srcset || "").split(",")) {
    const [u, w] = part.trim().split(/\s+/);
    const n = parseInt(w, 10) || 0;
    if (u && (!best || n > best.n)) best = { u, n };
  }
  return best?.u || null;
}

/** "photo-1024x683.jpg" -> "photo.jpg"; WordPress keeps the original beside it. */
function originalOf(url) {
  return url.replace(/-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp)(\?|$))/i, "").replace(/-e\d{10,}(?=\.(jpe?g|png|webp)(\?|$))/i, "");
}

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;/g, "'").replace(/&quot;/g, '"');

/**
 * Every plausible photo on a page, with the words around it.
 *
 * `lead` marks the page's own lead picture: its og:image, and the first image
 * after the headline. That is the only picture trusted without the name in it,
 * and only on a page that is about this story.
 */
function photosOn(html, pageUrl) {
  const out = [];
  const h1 = html.search(/<h1[\s>]/i);
  let firstAfterH1 = true;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    let src =
      largestFromSrcset(attr(tag, "srcset") || attr(tag, "data-srcset") || attr(tag, "data-lazy-srcset")) ||
      attr(tag, "data-lazy-src") || attr(tag, "data-src") || attr(tag, "src");
    if (!src || src.startsWith("data:")) continue;
    try { src = new URL(decode(src), pageUrl).href; } catch { continue; }
    if (NOT_A_PORTRAIT.test(src)) continue;
    const after = html.slice(m.index, m.index + 900);
    const caption = (after.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || "";
    const lead = h1 >= 0 && m.index > h1 && firstAfterH1;
    if (lead) firstAfterH1 = false;
    out.push({
      url: src,
      alt: decode(attr(tag, "alt") || attr(tag, "title")),
      caption: decode(caption.replace(/<[^>]+>/g, " ")).trim(),
      lead,
      page: pageUrl,
    });
  }
  const og = metaImage(html, pageUrl);
  if (og && !NOT_A_PORTRAIT.test(og)) out.unshift({ url: decode(og), alt: "", caption: "", lead: true, page: pageUrl });
  return out;
}

/** Does this picture carry the person's name anywhere we can read it? */
function namedIn(c, name) {
  const parts = String(name).split(/\s+/).map(squash).filter((p) => p.length >= 3);
  if (!parts.length) return false;
  const surname = parts[parts.length - 1];
  let file = "";
  try { file = decodeURIComponent(new URL(c.url).pathname.split("/").pop() || ""); } catch {}
  const hay = squash(`${file} ${c.alt} ${c.caption}`);
  return hay.includes(surname);
}

/** Links on the organisation's site that lead to a team, leadership or press page. */
function peoplePages(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const label = `${m[1]} ${m[2].replace(/<[^>]+>/g, " ")}`;
    if (!/(team|leadership|people|management|board|about|who-we-are|our-story|press|media|news)/i.test(label)) continue;
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") !== new URL(base).hostname.replace(/^www\./, "")) continue;
      out.push(u.href);
    } catch {}
  }
  // Team and leadership pages before news: that is where a headshot carries the name.
  const rank = (u) => (/(team|leadership|people|management|board)/i.test(u) ? 0 : /(about|who-we-are)/i.test(u) ? 1 : 2);
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}

/** Wikimedia Commons, for players and well-known figures. Licensed, credited. */
async function commonsCandidates(name, ua) {
  const surname = squash(String(name).split(/\s+/).pop());
  if (surname.length < 3) return [];
  const q = new URL("https://commons.wikimedia.org/w/api.php");
  q.search = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrlimit: "6",
    gsrsearch: `"${name}" filetype:bitmap`, prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1600",
  }).toString();
  const res = await fetch(q, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const pages = Object.values((await res.json())?.query?.pages || {});
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !squash(p.title).includes(surname)) continue;
    const meta = info.extmetadata || {};
    const artist = String(meta.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 60);
    const licence = String(meta.LicenseShortName?.value || "").trim();
    out.push({
      url: info.thumburl || info.url,
      alt: String(p.title).replace(/^File:/, "").replace(/\.\w+$/, ""),
      caption: "",
      lead: false,
      named: true,
      page: info.descriptionurl,
      credit: `Photo: ${[artist, licence].filter(Boolean).join(", ")} via Wikimedia Commons`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ gate */

/**
 * Is this the person, and is it clean?
 *
 * Exported for lib/headshots.js, which runs the same check on a photo that
 * arrives by email.
 */
export async function verifyPerson(site, { title, name, image, evidence }) {
  const res = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: 400,
    system: `You are the picture editor of ${site?.name || "a trade magazine"}, checking ONE photograph for a story about a named person.

The story is about a person, so the picture MUST show a person. Scenery, a course, a building, a product, a logo or a graphic is a reject however good it looks.

1. PERSON. Is the clear main subject one person, or a small group where one person is evidently the focus? A crowd, a distant figure, or people as incidental detail is false.
2. WHO. You cannot recognise faces and must not try. Judge only whether anything CONTRADICTS the evidence you are given (a caption or filename naming someone else, a woman where the text says "he", a child where the story is about an executive). No contradiction is a pass.
3. MARK. Does the picture carry a watermark, masthead, byline bar, award badge or logo belonging to a publication, agency or stock library? Answer "none", "edge" when the mark sits ONLY on a solid strip running the full width of the top or bottom edge (a burnt-in banner), or "frame" when it is on the photograph itself. The person's own employer's logo on clothing or signage is "none".
4. USABLE. A real photograph of adequate quality, not a collage, poster, screenshot or composite with text.

Reply ONLY with JSON:
{"person":true|false,"contradicts":true|false,"mark":"none|edge|frame","edge":"top|bottom|none","usable":true|false,"alt":"under 120 chars, plain description naming the person","note":"a few words"}`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
        { type: "text", text: `Headline: "${title}"\nThe person: ${name}\nEvidence: ${evidence}\nDimensions: ${image.size.w}x${image.size.h}\n\nJudge the photograph.` },
      ],
    }],
  });
  const text = textOf(res);
  const bool = (k) => new RegExp(`"${k}"\\s*:\\s*true`, "i").test(text);
  const str = (k) => (text.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`, "i")) || [])[1] || "";
  return {
    person: bool("person"),
    contradicts: bool("contradicts"),
    usable: bool("usable"),
    mark: (str("mark") || "frame").toLowerCase(),
    edge: (str("edge") || "none").toLowerCase(),
    alt: str("alt"),
    note: str("note"),
  };
}

/* ------------------------------------------------------------------ crop */

/**
 * Cut a burnt-in banner off the top or bottom edge.
 *
 * Found by colour, not by guessing a height: rows are read inward from the
 * edge while most of each row matches the edge's own colour. A banner's text
 * lowers that share but never below half; the photograph drops it at once.
 * Anything under 2% or over 22% of the height is not a banner and is refused.
 */
export async function cropEdgeBand(buffer, edge) {
  let sharp;
  try { ({ default: sharp } = await import("sharp")); } catch { return null; }
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const W = 240;
  const H = Math.max(40, Math.round((meta.height / meta.width) * W));
  const { data } = await sharp(buffer).rotate().resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const rows = edge === "top" ? [...Array(H).keys()] : [...Array(H).keys()].reverse();

  // The edge colour: the median of the outermost row.
  const outer = [...Array(W).keys()].map((x) => px(x, rows[0]));
  const med = [0, 1, 2].map((c) => outer.map((p) => p[c]).sort((a, b) => a - b)[W >> 1]);
  const share = (y) => {
    let n = 0;
    for (let x = 0; x < W; x++) {
      const p = px(x, y);
      if (Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]) < 60) n++;
    }
    return n / W;
  };
  if (share(rows[0]) < 0.8) return null;

  let band = 0;
  let misses = 0;
  for (const y of rows) {
    if (share(y) >= 0.5) { band += 1 + misses; misses = 0; }
    else if (++misses >= 2) break;
  }
  const frac = band / H;
  if (frac < 0.02 || frac > 0.22) return null;

  const cut = Math.ceil((frac + 0.006) * meta.height);
  const keep = meta.height - cut;
  const out = await sharp(buffer).rotate()
    .extract({ left: 0, top: edge === "top" ? cut : 0, width: meta.width, height: keep })
    .jpeg({ quality: 86 }).toBuffer();
  return { buffer: out, type: "image/jpeg", size: { w: meta.width, h: keep } };
}

/* ------------------------------------------------------------------ main */

/**
 * A real photograph of the person, or null.
 *
 * `upload(buffer, contentType, filename)` puts a cropped photo in the title's
 * media library and returns { url }. Without it a photo that needs its banner
 * cut is skipped rather than used as is.
 */
export async function personImage(site, { title, body, sourceUrl, subject, upload = null }) {
  if (!process.env.ANTHROPIC_API_KEY || !subject?.name) return null;
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
  const deadline = Date.now() + BUDGET_MS;
  const log = (m) => console.log(`[person-image] ${site.slug}: ${m}`);
  const own = String(site.domain || "").replace(/^www\./, "");
  const name = subject.name;

  // Pages, best first: the story's own source, anything the article links, then
  // the organisation's own site and its team pages.
  const pages = [];
  const seen = new Set();
  const add = (u, why) => {
    const h = hostOf(u);
    if (!h || SKIP_HOST.test(h) || (own && h.endsWith(own)) || seen.has(u)) return;
    seen.add(u);
    pages.push({ url: u, why });
  };
  if (sourceUrl) add(sourceUrl, "source");
  for (const m of String(body || "").matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    if (pages.length < 4) add(m[1], "linked");
  }

  const candidates = [];
  const take = (list, page) => {
    for (const c of list) {
      const named = c.named || namedIn(c, name);
      // Unnamed pictures are only trusted as the lead of the story's own source.
      // A page the article links to is usually about something else, and its
      // lead photo of a different person would pass: the gate cannot tell faces.
      if (!named && !(c.lead && page.why === "source")) continue;
      candidates.push({ ...c, named, why: page.why });
    }
  };

  for (const page of pages) {
    if (Date.now() > deadline) break;
    try {
      const html = await fetchText(page.url, ua);
      if (html) take(photosOn(html, page.url), page);
      else log(`${hostOf(page.url)}: page not readable`);
    } catch (e) {
      log(`${hostOf(page.url)}: ${String(e.message).slice(0, 60)}`);
    }
  }

  if (subject.org && Date.now() < deadline) {
    try {
      const site0 = await resolveOwnSite(subject.org, ua, log, deadline);
      if (site0) {
        take(photosOn(site0.html, site0.url), { why: "org" });
        for (const u of peoplePages(site0.html, site0.url)) {
          if (Date.now() > deadline) break;
          const html = await fetchText(u, ua).catch(() => null);
          if (html) take(photosOn(html, u), { why: "org" });
        }
      }
    } catch { /* keep going */ }
  }

  // Commons only for people the public photographs: players, coaches, course
  // designers. For an executive it finds namesakes: "Stephen Brown" returned a
  // portrait of a man who died in 1902. A namesake the gate cannot rule out is the worst
  // possible result, far worse than the card.
  const PUBLIC_ROLE = /(golfer|player|\bpro\b|professional|champion|coach|captain|athlete|designer|architect|ambassador|tour)/i;
  if (Date.now() < deadline && PUBLIC_ROLE.test(`${subject.role} ${title}`)) {
    try { candidates.push(...(await commonsCandidates(name, ua)).map((c) => ({ ...c, why: "commons" }))); } catch {}
  }

  // Named first, then leads; the source's own lead before anything linked.
  const score = (c) => (c.named ? 4 : 0) + (c.lead ? 2 : 0) + (c.why === "source" ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  const unique = [];
  const files = new Set();
  for (const c of candidates) {
    const key = originalOf(c.url).split("?")[0].split("/").pop();
    if (files.has(key)) {
      // The same file seen twice: keep the stronger evidence on the first copy.
      const first = unique.find((u) => originalOf(u.url).split("?")[0].split("/").pop() === key);
      if (first && c.named) first.named = true;
      continue;
    }
    files.add(key);
    unique.push(c);
  }
  log(`${name}: ${unique.length} candidate photo(s) from ${pages.length} page(s)`);

  let checks = 0;
  for (const c of unique) {
    if (checks >= MAX_CHECKS || Date.now() > deadline) break;
    const host = hostOf(c.page || c.url) || "the web";

    // The full-size original first, then the size the page actually served.
    let image = null;
    let url = c.url;
    for (const u of [...new Set([originalOf(c.url), c.url])]) {
      const got = await fetchImage(u, ua, { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT }).catch((e) => ({ reject: e.message }));
      if (!got.reject) { image = got; url = u; break; }
      log(`${host}: ${got.reject}`);
    }
    if (!image) continue;

    checks++;
    const evidence = [
      c.named ? `the name appears in its filename, alt text or caption ("${[image.filename, c.alt, c.caption].filter(Boolean).join(" | ").slice(0, 160)}")` : null,
      c.lead && c.why === "source" ? `it is the lead picture of ${c.page}, the page this story was written from` : null,
      c.why === "org" ? `it is on the website of ${subject.org}` : null,
      c.why === "commons" ? "it is a Wikimedia Commons file titled with the name" : null,
    ].filter(Boolean).join("; ");

    const v = await verifyPerson(site, { title, name, image, evidence }).catch((e) => {
      log(`${host}: gate failed, ${String(e.message).slice(0, 60)}`);
      return null;
    });
    if (!v) continue;
    if (!v.person) { log(`${host}: rejected, not a picture of a person (${v.note})`); continue; }
    if (v.contradicts) { log(`${host}: rejected, evidence says it is someone else (${v.note})`); continue; }
    if (!v.usable) { log(`${host}: rejected, not usable (${v.note})`); continue; }
    if (v.mark === "frame") { log(`${host}: rejected, a mark inside the frame (${v.note})`); continue; }

    const credit = c.credit || `Photo: ${subject.org || host}`;
    const alt = v.alt || `${name}${subject.role ? `, ${subject.role}` : ""}`;

    if (v.mark === "edge") {
      if (!upload || !["top", "bottom"].includes(v.edge)) { log(`${host}: banner on the ${v.edge} edge and no way to host a crop`); continue; }
      const cropped = await cropEdgeBand(image.buffer, v.edge).catch(() => null);
      if (!cropped) { log(`${host}: could not find the banner's edge to cut`); continue; }
      const again = await verifyPerson(site, {
        title, name, evidence,
        image: { base64: cropped.buffer.toString("base64"), type: cropped.type, size: cropped.size },
      }).catch(() => null);
      if (!again || again.mark !== "none" || !again.person) { log(`${host}: still marked after the cut`); continue; }
      const slug = squash(name).slice(0, 40) || "person";
      const hosted = await upload(cropped.buffer, cropped.type, `${slug}-${Date.now().toString(36)}`).catch((e) => {
        log(`${host}: upload of the crop failed, ${String(e.message).slice(0, 80)}`);
        return null;
      });
      if (!hosted?.url) continue;
      log(`${host}: ACCEPTED ${name}, ${v.edge} banner cut, ${cropped.size.w}x${cropped.size.h}`);
      return { url: hosted.url, alt, credit, source: `person:${host}`, width: cropped.size.w, height: cropped.size.h };
    }

    log(`${host}: ACCEPTED ${name}, ${image.size.w}x${image.size.h}${c.named ? ", named" : ", lead photo"}`);
    return { url, alt, credit, source: `person:${host}`, width: image.size.w, height: image.size.h };
  }

  log(`no usable photo of ${name}`);
  return null;
}

/* ------------------------------------------------------------------ card */

/**
 * The app's public address, for the card route. A localhost APP_URL (the dev
 * .env has one) would put an unreachable link on a live article, so it falls
 * back to production: the first backfill run failed every card that way.
 */
export function appUrl() {
  const u = String(process.env.APP_URL || "");
  if (!u || /localhost|127\.0\.0\.1/.test(u)) return "https://cogent-incubator.vercel.app";
  return u.replace(/\/$/, "");
}

// Verbs a person story's headline carries when the person is the news.
const PERSON_NEWS = /\b(names?|named|appoints?|appointed|hires?|hired|promotes?|promoted|joins?|steps? down|retires?|departs?|wins?|won|earns?|awarded|honou?red|inducted|profile|interview|leader|meet)\b/i;

/**
 * Is the headline actually about the person? The classifier will call a trend
 * piece a person story because it quotes one superintendent; on Golf's backfill
 * "Turfgrass Programmes Are Quietly Building the Next Superintendent Hiring"
 * would have gone out under a name card. The person must be in the headline, or
 * the headline must be the kind of news that is about whoever holds the job.
 */
export function isAboutPerson(title, s) {
  if (s?.kind !== "person" || !s.name) return false;
  const surname = squash(String(s.name).split(/\s+/).pop());
  return (surname.length >= 3 && squash(title).includes(surname)) || PERSON_NEWS.test(String(title));
}

/**
 * The fallback: a typographic card in the title's colours with the name and
 * role. It says plainly who the story is about, which a stock fairway never
 * did, and lib/headshots.js replaces it once the company sends a photo.
 */
export function nameCard(site, subject) {
  const q = new URLSearchParams({ site: site.slug, name: subject.name || "", role: subject.role || "", org: subject.org || "" });
  return {
    url: `${appUrl()}/api/card/person?${q}`,
    alt: [subject.name, [subject.role, subject.org].filter(Boolean).join(", ")].filter(Boolean).join(", "),
    credit: null,
    source: "card:person",
  };
}

/**
 * Everything the picture desk needs for one article: classify (unless the
 * article already knows), then a photo of the person, else the card.
 *
 * Returns { subject, image } where image is null for anything that is not a
 * person story, so the caller carries on down its usual path.
 */
export async function pictureForPerson(site, { title, body, sourceUrl, subject = null, upload = null }) {
  const s = subject?.kind ? subject : await classifySubject(title, body);
  if (!isAboutPerson(title, s)) return { subject: s, image: null };
  const photo = await personImage(site, { title, body, sourceUrl, subject: s, upload }).catch((e) => {
    console.warn(`[person-image] ${site.slug}: ${String(e.message).slice(0, 120)}`);
    return null;
  });
  return { subject: s, image: photo || nameCard(site, s) };
}

/** The article columns a subject is stored in. */
export function subjectFields(s) {
  if (!s?.kind) return {};
  return {
    subjectKind: s.kind,
    subjectName: s.name || null,
    subjectRole: s.role || null,
    subjectOrg: s.org || null,
  };
}
