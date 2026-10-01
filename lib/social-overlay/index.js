/**
 * Branded overlays on interview photos, for LinkedIn and Instagram only.
 *
 * JB decided on 1 Oct 2026 that every interview goes to social with the
 * series name, the company, a name tag on each person and the title's logo
 * drawn over the photo. ONLY social: the article page, its featured image,
 * the link preview and the newsletter all keep the clean photo, so nothing
 * here writes to WordPress.
 *
 * An interview is a post whose WordPress title carries the franchise-eyebrow
 * span (lib/interviews.js). Every other post goes out exactly as before.
 *
 * There is no human approval step, by JB's standing rule. The risk is handled
 * by refusing to guess instead: a name is pinned to a face only when the
 * caption makes it certain (names.js), anything less gets the series name,
 * names and logo with no tags, and if the overlay cannot be drawn at all the
 * post goes out with its original photo. Nothing here may stop a post.
 *
 * Make fetches pictures by URL, so the overlay is served from this app at a
 * signed address (app/api/overlay) and drawn when Make asks for it. The
 * posting job draws it once first, so a picture that cannot be drawn is
 * caught here and the post falls back to the plain photo before Make ever
 * sees the address.
 *
 * Switched on fleet-wide by GlobalSetting interview_overlays = "on", and off
 * for one title by its EngineSetting interview_overlays = "off".
 */
import crypto from "node:crypto";
import { prisma, forSite } from "../prisma.js";
import { socialImage } from "../social-bridge.js";
import { detectFaces } from "./faces.js";
import { subjectsFor, assignNames } from "./names.js";
import { renderOverlay, plain, FORMATS } from "./render.js";

const SWITCH_KEY = "interview_overlays";
const FRANCHISE_KEY = "interview_franchise";

// Bump when the drawing changes, so Make and the CDN never serve an old cut.
const VERSION = 1;

// The brand colour each title's overlay is drawn in, from the brand kit
// (cogent-base-theme/scripts/brand/specs.mjs) and each site's accentHex,
// which agreed on every title when this was written.
const BRAND = {
  "smart-sme": "#2E3EEE",
  "fleet-magazine": "#1D5FAA",
  "golf-resort-magazine": "#15694A",
  "barbering-business": "#6E2B2B",
  "airport-business-magazine": "#123B66",
  "gym-business-news": "#D62828",
  "nursery-daily": "#D6336C",
  "senior-lifestyle-business": "#7A1F3D",
  "dental-business-news": "#0B5E63",
  "smart-farming-news": "#2F6B2F",
};

const WP_AGENT = "CogentBot/1.0";

// ---------------------------------------------------------------------------
// Switch and address
// ---------------------------------------------------------------------------

export async function overlaysOn(site) {
  const global = await prisma.globalSetting.findUnique({ where: { key: SWITCH_KEY } });
  if (String(global?.value || "").trim().toLowerCase() !== "on") return false;
  const own = await forSite(site.id).engineSetting.findUnique({ where: { key: SWITCH_KEY } });
  return String(own?.value || "").trim().toLowerCase() !== "off";
}

const sign = (slug, wpPostId, format) =>
  crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "")
    .update(`overlay:${VERSION}:${slug}:${wpPostId}:${format}`)
    .digest("hex")
    .slice(0, 20);

/** The public address Make downloads the overlay from, or null with no public origin. */
export function overlayUrl(site, wpPostId, format) {
  const base = String(process.env.APP_URL || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(base) || !process.env.AUTH_SECRET) return null;
  return `${base}/api/overlay/${site.slug}/${wpPostId}-${format}-${sign(site.slug, wpPostId, format)}.jpg`;
}

/** Parse and verify an overlay file name. Null for anything not signed by us. */
export function readOverlayName(slug, file) {
  const m = /^(\d+)-(linkedin|instagram)-([a-f0-9]{20})\.jpg$/.exec(String(file || ""));
  if (!m || !process.env.AUTH_SECRET) return null;
  const [, id, format, sig] = m;
  const want = sign(slug, Number(id), format);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  return { wpPostId: Number(id), format };
}

// ---------------------------------------------------------------------------
// Reading the interview
// ---------------------------------------------------------------------------

async function wpGet(wp, pathAndQuery) {
  const base = `${String(wp.url).replace(/\/$/, "")}/wp-json/wp/v2`;
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`${base}${pathAndQuery}`, {
      headers: { authorization: `Basic ${auth}`, "user-agent": WP_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    const ct = res.headers.get("content-type") || "";
    // SiteGround answers a bot challenge with 202 and an HTML page.
    if (res.ok && ct.includes("json")) return res.json();
    if (attempt === 1 && (res.status === 202 || res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    throw new Error(`WordPress ${pathAndQuery.split("?")[0]} answered ${res.status}`);
  }
}

/**
 * Everything the overlay needs about one published post, or null when the
 * post is not an interview.
 */
export async function loadInterview(site, wp, wpPostId) {
  const post = await wpGet(wp, `/posts/${wpPostId}?_fields=id,link,title,featured_media`);
  const rawTitle = post?.title?.rendered || "";
  if (!/franchise-eyebrow/.test(rawTitle)) return null;
  if (!post.featured_media) throw new Error("interview has no featured image");
  const media = await wpGet(wp, `/media/${post.featured_media}?_fields=id,source_url,alt_text,caption`);

  const db = forSite(site.id);
  const eyebrow = plain(rawTitle.match(/<span[^>]*franchise-eyebrow[^>]*>(.*?)<\/span>/i)?.[1] || "").replace(/:$/, "");
  const headline = plain(rawTitle.replace(/<span[^>]*franchise-eyebrow[^>]*>.*?<\/span>/i, ""));
  const setting = await db.engineSetting.findUnique({ where: { key: FRANCHISE_KEY } });
  // The series as the title runs it today. "Airside with" reads on as a
  // headline ("Airside with Jo Bloggs") but not as a label on its own.
  const series = plain(setting?.value || eyebrow).replace(/\s+with$/i, "");

  const bare = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const articles = await db.article.findMany({ where: { wpPostId: Number(wpPostId) }, select: { id: true } });
  // Interviews built by hand have a record with the live URL but no article
  // row, so either link will do.
  const targets = await db.interviewTarget.findMany({
    where: { OR: [{ articleId: { in: articles.map((a) => a.id) } }, { publishedUrl: { not: null } }] },
    select: { personName: true, company: true, publishedUrl: true, articleId: true },
  });
  const ids = new Set(articles.map((a) => a.id));
  const target =
    targets.find((t) => t.publishedUrl && bare(t.publishedUrl) === bare(post.link)) ||
    targets.find((t) => t.articleId && ids.has(t.articleId)) ||
    null;

  return {
    wpPostId: Number(wpPostId),
    link: post.link,
    headline,
    series,
    imageUrl: media.source_url,
    alt: media.alt_text || "",
    caption: plain(media.caption?.rendered || ""),
    personName: target?.personName || "",
    company: plain(target?.company || ""),
  };
}

/**
 * The original photo, at full size, as JPEG.
 *
 * Through the same image proxy the posts already use: the title hosts answer a
 * laptop and refuse datacentre traffic, so a direct fetch from Vercel cannot
 * be relied on. Direct is the second try.
 */
async function fetchPhoto(url) {
  const bare = String(url).replace(/^https?:\/\//, "");
  const tries = [
    `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=2400&we&output=jpg&q=95`,
    url,
  ];
  let last = "";
  for (const u of tries) {
    try {
      const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
      if (res.ok && /image\//.test(res.headers.get("content-type") || "")) return Buffer.from(await res.arrayBuffer());
      last = `${res.status}`;
    } catch (e) {
      last = e.message;
    }
  }
  throw new Error(`could not fetch the photo (${last})`);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw the overlay for one interview. Throws when it cannot; callers fall
 * back to the plain photo.
 */
export async function drawInterview(site, interview, format, { photo } = {}) {
  if (!FORMATS[format]) throw new Error(`unknown format ${format}`);
  const picture = photo || (await fetchPhoto(interview.imageUrl));

  // Faces much smaller than the main one are the background: a gym-goer
  // across the room, a face on a magazine cover. They still count as faces
  // for keeping clear of, but not as people in the shot.
  const all = await detectFaces(picture);
  const biggest = Math.max(0, ...all.map((f) => f.w));
  const faces = all.filter((f) => f.w >= biggest * 0.3);

  const subjects = subjectsFor({ headline: interview.headline, personName: interview.personName });
  const names = assignNames({ faces, subjects, caption: interview.caption, alt: interview.alt, company: interview.company });

  const out = await renderOverlay(picture, {
    slug: site.slug,
    colour: BRAND[site.slug] || (/^#[0-9a-f]{6}$/i.test(site.accentHex || "") ? site.accentHex : "#1A1712"),
    series: interview.series,
    company: interview.company,
    names: subjects,
    faces: all,
    tags: names.tags,
    format,
  });
  return { ...out, report: { ...out.report, faces: faces.length, background: all.length - faces.length, people: subjects, reason: names.reason } };
}

/**
 * The picture address a social post should carry.
 *
 * For an interview, with overlays switched on, the signed overlay address
 * once a test draw has succeeded. For everything else, and for any failure,
 * the plain photo through the resizing proxy, exactly as before. Never throws.
 */
export async function socialPictureFor(site, { wp, wpPostId, imageUrl, format }) {
  const dims = format === "instagram" ? { width: 1080, height: 1350 } : { width: 1200, height: 628 };
  const plainUrl = () => socialImage(imageUrl, dims);
  if (!wpPostId || !wp?.url) return { url: plainUrl(), overlay: false };
  try {
    if (!(await overlaysOn(site))) return { url: plainUrl(), overlay: false };
    const address = overlayUrl(site, wpPostId, format);
    if (!address) return { url: plainUrl(), overlay: false, note: "APP_URL or AUTH_SECRET not set" };
    const interview = await loadInterview(site, wp, wpPostId);
    if (!interview) return { url: plainUrl(), overlay: false };
    const drawn = await drawInterview(site, interview, format);
    // buffer is for a direct LinkedIn post, which uploads the picture itself.
    return { url: address, buffer: drawn.buffer, overlay: true, report: drawn.report };
  } catch (e) {
    console.warn(`[social-overlay] ${site.slug} post ${wpPostId} ${format}: ${e.message}; posting the plain photo`);
    return { url: plainUrl(), overlay: false, note: e.message };
  }
}
