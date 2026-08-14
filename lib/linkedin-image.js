// Every LinkedIn post carries an image, and every image carries the wordmark.
//
// The mark is the real logo from smartsme.co.uk rather than a redrawn one, so
// it cannot drift from the brand. It sits on a white scrim that fades out
// towards the middle of the picture: the logo's own background is white and the
// letters inside the SME block are white knockouts, so keying it transparent
// would punch holes straight through the name. Scrim plus untouched logo keeps
// the brand colours exact and stays legible on any photograph.
//
// Nothing here draws text, which is deliberate: the serverless runtime has no
// fonts installed, so anything font-dependent would render as empty boxes in
// production while looking perfect locally.
import sharp from "sharp";
import { LOGO_PNG, LOGO_WIDTH, LOGO_HEIGHT } from "./brand/logo.js";

// LinkedIn's landscape slot. Anything else gets letterboxed in the feed.
const CARD_W = 1200;
const CARD_H = 627;

const LOGO_ON_CARD = 200; // tiny corner mark, a sixth of the width
const PAD_R = 25;
const PAD_B = 22;
const BADGE_W = LOGO_ON_CARD + PAD_R + 25;
const BADGE_H = Math.round((LOGO_ON_CARD * LOGO_HEIGHT) / LOGO_WIDTH) + PAD_B + 21;

// Built once per process: identical on every post, and compositing it is far
// cheaper than rebuilding the scrim each time.
let badgePromise;

function buildBadge() {
  // Opaque under the logo, fading to nothing towards the top left so the mark
  // melts into the picture instead of sitting on a pasted-on white box.
  const scrim = Buffer.from(
    `<svg width="${BADGE_W}" height="${BADGE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/>
          <stop offset="0.42" stop-color="#fff" stop-opacity="0.93"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0.93"/>
        </linearGradient>
      </defs>
      <rect width="${BADGE_W}" height="${BADGE_H}" fill="url(#fade)"/>
    </svg>`
  );

  const logoH = Math.round((LOGO_ON_CARD * LOGO_HEIGHT) / LOGO_WIDTH);

  // The stored mark is several times larger than it is ever drawn, so it gets
  // shrunk to size here: compositing it at full width would overflow the badge.
  return sharp(LOGO_PNG)
    .resize(LOGO_ON_CARD, logoH)
    .png()
    .toBuffer()
    .then((logo) =>
      sharp({ create: { width: BADGE_W, height: BADGE_H, channels: 4, background: "#ffffff" } })
        .composite([
          { input: logo, left: BADGE_W - PAD_R - LOGO_ON_CARD, top: BADGE_H - PAD_B - logoH },
          // dest-in keeps the white plate only where the gradient is opaque, so
          // plate and logo fade together as one piece with no seam between them.
          { input: scrim, blend: "dest-in" },
        ])
        .png()
        .toBuffer()
    );
}

function badge() {
  badgePromise ||= buildBadge();
  return badgePromise;
}

// Used when a post has no article behind it, so a hand-written draft still gets
// a branded card rather than going out bare.
function fallbackBackground() {
  return sharp(
    Buffer.from(
      `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#05070f"/>
            <stop offset="0.55" stop-color="#2e3eee"/>
            <stop offset="1" stop-color="#5a6aff"/>
          </linearGradient>
        </defs>
        <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>
      </svg>`
    )
  )
    .png()
    .toBuffer();
}

// Composing is dominated by downloading the source photograph, which does not
// change, so finished cards are kept for the life of the process. The queue
// re-renders on every approve and would otherwise redo all of that work.
const cache = new Map();
const CACHE_MAX = 24;

function remember(key, value) {
  cache.set(key, value);
  // Plain insertion-order eviction. A single-user queue never holds enough
  // cards for anything cleverer to earn its keep.
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

// A scaled copy for list views. Encoding a small JPEG is far cheaper than
// re-fetching and re-compositing the original.
export async function thumbnail(buffer, width) {
  const key = `thumb:${width}:${buffer.length}`;
  if (cache.has(key)) return cache.get(key);
  const out = await sharp(buffer).resize({ width }).jpeg({ quality: 80 }).toBuffer();
  return remember(key, out);
}

async function fetchImage(url) {
  // The WordPress host rejects fetches with no user-agent, and the image URLs
  // often point straight at it.
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`image fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Returns a JPEG ready to hand to LinkedIn. Falls back to the branded card if
// the source image is missing or unreadable, so this never throws for want of a
// picture and never returns an unbranded one.
export async function composeLinkedInImage(imageUrl) {
  const key = `card:${imageUrl || "fallback"}`;
  if (cache.has(key)) return cache.get(key);

  let base;
  let usedFallback = false;

  if (imageUrl) {
    try {
      base = await fetchImage(imageUrl);
    } catch {
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  let canvas;
  try {
    canvas = await sharp(usedFallback ? await fallbackBackground() : base)
      .resize(CARD_W, CARD_H, { fit: "cover", position: "attention" })
      .toBuffer();
  } catch {
    // An unreadable or corrupt source image lands here rather than failing the
    // whole post.
    usedFallback = true;
    canvas = await sharp(await fallbackBackground()).resize(CARD_W, CARD_H).toBuffer();
  }

  const buffer = await sharp(canvas)
    .composite([{ input: await badge(), left: CARD_W - BADGE_W, top: CARD_H - BADGE_H }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  // A fallback card means the picture could not be fetched this time, which may
  // well be temporary, so only real cards are worth remembering.
  return usedFallback ? { buffer, usedFallback } : remember(key, { buffer, usedFallback });
}

export { CARD_W, CARD_H };
