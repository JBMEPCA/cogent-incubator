// A new supplier page's website and logo, found on the company's own site.
//
// JB, 18 Nov 2026: "can you not source a logo when a new page is created?"
// The rule from the backfill still holds: never invent a logo or a website.
// So the website is one we already hold for the company or a link to it in
// the article, never a guess (see findWebsite); and
// the logo is an image that site itself marks as its logo, checked by eye
// (a vision call) before it is used. Anything unconfirmed is left blank and
// the page shows initials, which is what it did before.
//
// Never throws. Called only when a page is created, so the cost is per new
// company, not per article.

import Anthropic from "@anthropic-ai/sdk";
import { SKIP_HOST, fetchText } from "./subject-image";

const UA = "Mozilla/5.0 (compatible; CogentBot/1.0)";
// Some company sites turn away anything that is not a browser ("site did not
// load" on 13 of 66 new pages by 20 Nov), so their home pages are asked for
// the way a browser would. Images still go with UA.
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const VISION_MODEL = "claude-haiku-4-5";
const MAX_BYTES = 3_000_000;
const MAX_TRIES = 4;

const SLD = new Set(["co", "com", "org", "net", "ac", "gov", "ltd", "plc", "me"]);
/** The brand part of a host: fanuc in fanuc.co.uk, fanuc.eu and uk.fanuc.com. */
export function brandLabel(u) {
  let host;
  try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
  const p = host.split(".");
  if (p.length >= 3 && SLD.has(p[p.length - 2])) return p[p.length - 3];
  return p[p.length - 2] || p[0] || "";
}

const squash = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const LEGAL = /\b(ltd|limited|plc|llp|llc|inc|incorporated|corp|corporation|gmbh|uk|group|holdings)\b\.?/gi;
const core = (name) => squash(String(name).replace(LEGAL, " "));

/** Does this host plausibly belong to this company? "webfleet.com" for Webfleet. */
function hostFits(url, name) {
  const label = squash(brandLabel(url));
  const c = core(name);
  if (label.length < 3 || c.length < 3) return false;
  return label === c || label.startsWith(c) || c.startsWith(label);
}

/** A link in the article whose domain is the company's name, or null. */
export function websiteFromLinks(name, body) {
  for (const m of String(body || "").matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    let u;
    try { u = new URL(m[1]); } catch { continue; }
    if (SKIP_HOST.test(u.hostname)) continue;
    if (hostFits(u.href, name)) return `${u.protocol}//${u.hostname}/`;
  }
  return null;
}

/**
 * The company's own site: one we hold for it, or one the article links to.
 *
 * Never a guessed domain. Tried on 18 Nov 2026 and dropped the same hour:
 * INFINITUM, a golf resort on the Costa Dorada, guessed to infinitum.co.uk,
 * a rock-band merchandise shop whose page does say "Infinitum", and whose
 * logo the vision check then passed, because it is an Infinitum logo. The
 * article itself linked infinitumliving.com.
 */
async function findWebsite({ name, website, body, headline }) {
  if (website) return website;
  return websiteFromLinks(name, body) || (headline ? websiteByLookup(name, headline) : null);
}

const pageTitle = (html) =>
  [
    (html.match(/<title[^>]*>([^<]*)/i) || [])[1],
    (html.match(/property=["']og:site_name["'][^>]*content=["']([^"']*)/i) || [])[1],
    (html.match(/name=["']description["'][^>]*content=["']([^"']*)/i) || [])[1],
  ]
    .filter(Boolean)
    .join(" | ")
    .replace(/&amp;/g, "&")
    .slice(0, 400);

/**
 * The official site, when we hold none and the article links none.
 *
 * JB, 20 Nov 2026: John Deere's page had no logo because its article linked
 * no website. Not a blind guess (that was INFINITUM): the model names the
 * official site with the headline as context, the page has to name the
 * company in its own title, and a second look at that title and description
 * against the headline has to agree it is the same organisation.
 */
export async function websiteByLookup(name, headline) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15000, maxRetries: 0 });
  const ask = async (system, content) => {
    const res = await ai.messages.create({ model: VISION_MODEL, max_tokens: 120, system, messages: [{ role: "user", content }] });
    return (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  };
  try {
    const t1 = await ask(
      `You give the official website of an organisation named in a trade news headline. Reply ONLY with JSON: {"url":"https://..."} or {"url":null}. The organisation's own main site, not a social profile, directory, marketplace or news page. null if you are not sure which organisation this is or what its site is.`,
      `Organisation: ${name}\nHeadline: ${headline}`
    );
    const url = (t1.match(/"url"\s*:\s*"(https?:\/\/[^"]+)"/i) || [])[1];
    if (!url || SKIP_HOST.test(new URL(url).hostname)) return null;
    const html = await fetchText(url, BROWSER_UA).catch(() => null);
    if (!html) return null;
    const title = pageTitle(html);
    if (!squash(title).includes(core(name).slice(0, 12)) && !hostFits(url, name)) return null;
    const t2 = await ask(
      `You check a website belongs to the organisation in a news headline. Reply ONLY with JSON: {"same":true|false}. false if it could be a different organisation with a similar name, or if unsure.`,
      `Organisation: ${name}\nHeadline: ${headline}\nWebsite: ${url}\nIts page title and description: ${title}`
    );
    if (!/"same"\s*:\s*true/i.test(t2)) return null;
    // A page on a shared host (gov.uk/government/organisations/...) keeps its path.
    const u = new URL(url);
    return /(^|\.)(gov\.uk|nhs\.uk|gov\.scot|gov\.wales)$/i.test(u.hostname) ? u.href : `${u.origin}/`;
  } catch {
    return null;
  }
}

const attr = (tag, a) => (tag.match(new RegExp(`\\s${a}\\s*=\\s*["']([^"']*)["']`, "i")) || [])[1] || "";
const NOT_OURS = /(partner|client|customer|award|badge|accredit|certif|payment|member|sponsor|footer|trustpilot|feefo|cyber-?essentials|iso-?\d|flag|social)/i;

/** Image URLs the site marks as its own logo, best first. */
function logoCandidates(html, pageUrl, name) {
  const out = [];
  const abs = (u) => { try { return new URL(u.trim().split(/\s+/)[0], pageUrl).href; } catch { return null; } };
  const c = core(name);
  // The header, or the nav where a site has no <header> (cellhire.com).
  const header = [...html.matchAll(/<(header|nav)\b[\s\S]*?<\/\1>/gi)].slice(0, 3).map((m) => m[0]).join("");
  const imgs = (h) => [...h.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const src = (t) => attr(t, "src") || attr(t, "data-src") || attr(t, "data-lazy-src") || (attr(t, "srcset") || "").split(",")[0];
  const isLogo = (t) => /logo/i.test(`${attr(t, "class")} ${attr(t, "id")} ${attr(t, "alt")} ${src(t)}`) && !NOT_OURS.test(`${attr(t, "class")} ${attr(t, "alt")} ${src(t)}`);
  const named = (t) => c.length >= 3 && squash(`${attr(t, "alt")} ${src(t)}`).includes(c);

  // WordPress and most builders mark the site logo outright.
  for (const t of imgs(html)) if (/custom-logo|site-logo|navbar-brand|header-logo|brand-logo/i.test(attr(t, "class"))) out.push(abs(src(t)));
  // In the header and called a logo, the company's name first.
  const head = imgs(header).filter(isLogo);
  out.push(...head.filter(named).map((t) => abs(src(t))), ...head.map((t) => abs(src(t))));
  // Structured data: Organization.logo.
  for (const m of html.matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/gi)) out.push(abs(m[1].replace(/\\\//g, "/")));
  // Anywhere on the page, called a logo and carrying the company's name.
  out.push(...imgs(html).filter((t) => isLogo(t) && named(t)).map((t) => abs(src(t))));
  // Last, the first image the page calls a logo by its class.
  out.push(...imgs(html).filter((t) => /logo/i.test(attr(t, "class")) && isLogo(t)).slice(0, 1).map((t) => abs(src(t))));
  return [...new Set(out.filter(Boolean))].filter((u) => !/^data:/i.test(u)).slice(0, MAX_TRIES);
}

/** The image as a PNG on transparent, or null if it is not usable. */
async function fetchLogo(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(type) && !/\.svg(\?|$)/i.test(url)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 300 || buf.byteLength > MAX_BYTES) return null;
  const sharp = (await import("sharp")).default;
  try {
    // SVG is rasterised: WordPress will not take an SVG upload.
    const img = sharp(buf, { density: 300 }).trim().resize({ width: 800, height: 400, fit: "inside", withoutEnlargement: true });
    const png = await img.png().toBuffer();
    const meta = await sharp(png).metadata();
    if (!meta.width || meta.width < 60 || meta.height < 16) return null;
    const ratio = meta.width / meta.height;
    if (ratio < 0.6 || ratio > 10) return null;
    // Every tile is white. A white logo would vanish, so measure it on white.
    // Flattened to a buffer first: sharp's stats() reads the input image and
    // ignores any operation chained before it, so measuring in one chain
    // passed Assaia's and Tarkett's white logos as if they had colour.
    const onWhite = await sharp(png).flatten({ background: "#ffffff" }).png().toBuffer();
    const { channels } = await sharp(onWhite).stats();
    if (Math.max(...channels.slice(0, 3).map((ch) => ch.stdev)) < 14) return null;
    return { png, w: meta.width, h: meta.height };
  } catch {
    return null;
  }
}

/** A last look: is this plainly this company's logo, readable on white? */
async function looksRight(png, name, site) {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const flat = await (await import("sharp")).default(png).flatten({ background: "#ffffff" }).png().toBuffer();
  const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
    model: VISION_MODEL,
    max_tokens: 120,
    system: `You check a logo before it goes on a company's profile page. Reply ONLY with JSON: {"reads":"...","ok":true|false}.
"reads" is the words or letters you can actually see in the image, exactly as shown, or "" if you can see none (a blank or nearly blank image reads "").
ok is true only if the image is a company logo or wordmark (not a photo, banner, award, accreditation, or another organisation's badge) and is clearly visible on this white background.`,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: flat.toString("base64") } },
      { type: "text", text: `Company: ${name}` },
    ] }],
  });
  const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!/"ok"\s*:\s*true/i.test(text)) return false;
  // The name has to be read off the image, not taken on trust: on 18 Nov 2026
  // the check said yes to a blank white tile, and to an awards badge from
  // Assaia's footer. A symbol-only logo fails this and stays on initials.
  const reads = squash((text.match(/"reads"\s*:\s*"([^"]*)"/i) || [])[1]);
  const c = core(name);
  return reads.length >= 2 && c.length >= 2 && (reads.includes(c) || (reads.length >= 4 && c.includes(reads)));
}

/**
 * The logo Wikidata holds for this organisation, only where Wikidata's
 * official website (P856) is the same site as ours: that match, not the
 * name, is what says it is the same organisation. Null otherwise.
 */
async function wikidataLogo(name, site) {
  const want = brandLabel(site);
  if (want.length < 3) return null;
  const get = (u) =>
    fetch(u, { headers: { "user-agent": "CogentBot/1.0 (supplier directory logos)" }, signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const found = await get(
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=" + encodeURIComponent(name)
  );
  for (const hit of found?.search || []) {
    const ent = (await get("https://www.wikidata.org/wiki/Special:EntityData/" + hit.id + ".json"))?.entities?.[hit.id];
    const claims = ent?.claims || {};
    const sites = (claims.P856 || []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
    if (!sites.some((u) => brandLabel(u) === want)) continue;
    const file = (claims.P154 || []).map((c) => c.mainsnak?.datavalue?.value).find(Boolean);
    return file ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file.replace(/ /g, "_")) + "?width=800" : null;
  }
  return null;
}

/**
 * Website and logo for a company. Returns { website, logo: { png } | null,
 * note } and never throws.
 */
export async function sourceSupplierProfile({ name, website, body, headline, deadline = Date.now() + 40000 }) {
  try {
    const site = await findWebsite({ name, website, body, headline });
    if (!site) return { website: null, logo: null, note: "no website found" };
    if (Date.now() > deadline) return { website: site, logo: null, note: "out of time" };
    const html = await fetchText(site, BROWSER_UA).catch(() => null);
    const tries = html ? logoCandidates(html, site, name) : [];
    // Wikidata's logo for the organisation whose official website is this
    // one, after the site's own: deere.com draws its logo with JavaScript, so
    // the page holds none to find.
    const wd = Date.now() < deadline ? await wikidataLogo(name, site) : null;
    if (wd) tries.push(wd);
    for (const u of tries) {
      if (Date.now() > deadline) break;
      const img = await fetchLogo(u);
      if (!img) continue;
      if (await looksRight(img.png, name, site).catch(() => false)) return { website: site, logo: img, note: `logo from ${u}` };
    }
    return { website: site, logo: null, note: html ? "no logo that passed the checks" : "site did not load" };
  } catch (e) {
    return { website: null, logo: null, note: `failed: ${String(e.message || e).slice(0, 120)}` };
  }
}
