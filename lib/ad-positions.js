// The positions a title sells, and what each needs from the client.
//
// One list for the incubator and the ad plugin on the sites: the plugin asks
// for a position by its key, the theme's slots carry the same key, and the
// Advertiser Pack (Nov 2026) sells exactly these. Sizes are the IAB ones the
// pack quotes. `served` positions are put on the page by the plugin; the rest
// are delivered by hand or by the newsletter run and only tracked here.
//
// maxKb is the file-weight ceiling for what the sites serve, not for what the
// client sends: an oversized original is resized and re-encoded on upload, and
// only a served copy still over the limit is flagged.

export const POSITIONS = [
  {
    key: "leaderboard",
    label: "Leaderboard",
    size: [728, 90],
    served: true,
    where: "Across the site: top of the homepage, sections and every article",
    maxKb: 150,
  },
  {
    key: "billboard",
    label: "Billboard",
    size: [970, 250],
    served: true,
    where: "Homepage, below the latest stories, and under every article",
    maxKb: 200,
  },
  {
    key: "mpu",
    label: "MPU",
    size: [300, 250],
    served: true,
    where: "Sidebar, upper: homepage and the article rail",
    maxKb: 150,
  },
  {
    key: "mpu_lower",
    label: "MPU, lower",
    size: [300, 250],
    served: true,
    where: "Sidebar, lower: homepage and the article rail",
    maxKb: 150,
  },
  {
    key: "popup",
    label: "Homescreen pop-up",
    // Not an IAB size; the pack sells it without one. 600x500 is what the
    // popup frame is built around, and a 300x250 (same shape) is accepted and
    // shown at its own size.
    size: [600, 500],
    accepts: [[300, 250]],
    served: true,
    where: "Homepage, after 6 seconds, once a day per reader",
    maxKb: 250,
  },
  {
    key: "newsletter_banner",
    label: "Newsletter banner",
    size: [600, 150],
    accepts: [[728, 90]],
    served: false,
    email: true,
    where: "The weekly newsletter, under the lead story, in the week booked",
    maxKb: 200,
  },
  {
    key: "solus",
    label: "Solus e-shot",
    size: null,
    served: false,
    email: true,
    where: "Its own email to the title's list; stats from Mailchimp",
  },
  {
    key: "sponsored_article",
    label: "Sponsored article",
    size: null,
    served: false,
    where: "On the website and in the newsletter, labelled as sponsored",
  },
];

export const positionInfo = (key) => POSITIONS.find((p) => p.key === key) || null;
export const SERVED_KEYS = POSITIONS.filter((p) => p.served).map((p) => p.key);

/** The AdProduct a position files under, so the old product column stays meaningful. */
export function productFor(position) {
  if (["leaderboard", "billboard", "mpu", "mpu_lower", "popup"].includes(position)) return "banner";
  if (position === "newsletter_banner") return "newsletter";
  if (position === "solus") return "solus";
  if (position === "sponsored_article") return "web_story";
  return "other";
}

/** Sizes a creative may be for this position: its own, then any it also accepts. */
export function sizesFor(position) {
  const p = positionInfo(position);
  if (!p?.size) return [];
  return [p.size, ...(p.accepts || [])];
}

/**
 * Check one creative against a position. Returns { ok, problems[], fits } where
 * fits is the accepted size it matches. Same aspect ratio at a larger size
 * passes (a 1200x1000 for a 300x250 is a sharper original, and the served copy
 * is resized); a different shape does not.
 */
export function checkCreative(position, { width, height, mimeType, bytes, webBytes }) {
  const p = positionInfo(position);
  const problems = [];
  if (!p?.size) return { ok: true, problems, fits: null };
  if (!width || !height) {
    return { ok: false, problems: ["Not an image the sites can show (PDFs are converted on upload)"], fits: null };
  }
  const fits = sizesFor(position).find(([w, h]) => Math.abs(width / height - w / h) < 0.02 && width >= w && height >= h);
  if (!fits) {
    const want = sizesFor(position).map(([w, h]) => `${w}×${h}`).join(" or ");
    problems.push(`Is ${width}×${height}; ${p.label} needs ${want}`);
  }
  if (mimeType && !/^image\/(png|jpe?g|gif|webp)$/.test(mimeType)) problems.push(`${mimeType} cannot be served; send PNG, JPG or GIF`);
  const served = webBytes ?? bytes;
  if (p.maxKb && served && served > p.maxKb * 1024) {
    problems.push(`${Math.round(served / 1024)} KB once optimised; the limit is ${p.maxKb} KB`);
  }
  return { ok: problems.length === 0, problems, fits };
}
