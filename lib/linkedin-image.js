// Every LinkedIn post carries an image. The picture goes out as the picture.
//
// It used to carry a wordmark in the corner on a faded white scrim. JB dropped
// that on 2 Sep 2026: the photograph is the whole card and the page's own name
// and avatar already sit directly above it in the feed, so the mark was saying
// a second time what LinkedIn says for free.
//
// Worth knowing before anyone adds it back: the mark it composited came from
// lib/brand/logo.js, which is built from smartsme.co.uk and is fleet-wide, and
// this function takes no site argument. Every title's card would have gone out
// branded Smart SME. Per-title marks live in lib/brand/wordmarks.js and are
// keyed by slug, so a future version needs the slug passed in.
//
// Nothing here draws text, which is deliberate: the serverless runtime has no
// fonts installed, so anything font-dependent would render as empty boxes in
// production while looking perfect locally.
import sharp from "sharp";

// LinkedIn's landscape slot. Anything else gets letterboxed in the feed.
const CARD_W = 1200;
const CARD_H = 627;

// Used when a post has no article behind it, so a hand-written draft still gets
// a card rather than failing for want of a picture.
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

  const buffer = await sharp(canvas).jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  // A fallback card means the picture could not be fetched this time, which may
  // well be temporary, so only real cards are worth remembering.
  return usedFallback ? { buffer, usedFallback } : remember(key, { buffer, usedFallback });
}

export { CARD_W, CARD_H };
