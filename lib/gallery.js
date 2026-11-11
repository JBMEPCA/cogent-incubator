// Picture strips inside an article.
//
// THE RULE, set by JB on 11 November 2026 after the Stephen Chick interview at
// Laguna Golf Phuket: when a piece comes with three or more usable pictures,
// they do not go in one block at the bottom and they do not go one at a time
// between paragraphs. They run as strips of THREE, each strip sitting directly
// above an h2 heading, spread through the piece. Any title, any format.
//
// Why three: four left the row looking crowded on a 1,200px wide block, and an
// odd one out of four wrapped onto a line of its own and stretched across the
// full width. Three fills the row, keeps every picture big enough to be worth
// looking at, and reads as a considered photo strip rather than a dump.
//
// The markup is a core gallery block carrying the class `cogent-gallery`, which
// the shared theme styles as a fixed-height grid (cogent-base 1.36.1 and up).
// Core's own lightbox stays switched on, so every picture opens full screen.
// Three details in here exist because of specific bugs, and all three are
// load-bearing:
//
//   1. `lightbox: {enabled: true}` on each image, or the pictures are dead.
//   2. An explicit `sizes` attribute, so the browser fetches a sharp file for
//      the slot rather than the smallest one in the srcset.
//   3. NO `is-cropped` class on the gallery. Core's cropped variant forces
//      every image to fill its cell by stretching, which fights the theme's
//      own grid.
//
// Captions are written but hidden in the grid by the theme; they are read by
// the lightbox and by screen readers. One credit line goes under the last
// strip, not under every one.

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** How many pictures before the rule kicks in. Two pictures are two pictures. */
export const GALLERY_MIN = 3;

/** Pictures per strip. */
export const GALLERY_PER_STRIP = 3;

/**
 * One image inside a strip.
 * @param {{id:number,url:string,alt?:string,caption?:string}} m
 */
function galleryFigure(m) {
  return (
    `<!-- wp:image {"id":${m.id},"sizeSlug":"large","linkDestination":"none","lightbox":{"enabled":true}} -->\n` +
    `<figure class="wp-block-image size-large"><img src="${esc(m.url)}" alt="${esc(m.alt)}" class="wp-image-${m.id}" sizes="(max-width: 781px) 60vw, 800px"/>` +
    (m.caption ? `<figcaption class="wp-element-caption">${esc(m.caption)}</figcaption>` : "") +
    `</figure>\n<!-- /wp:image -->`
  );
}

/**
 * One strip of pictures as a core gallery block.
 * @param {Array} images  three of them, normally
 * @param {{credit?: string}} opts  credit line under this strip, if it is the last
 */
export function galleryStrip(images, { credit = null } = {}) {
  if (!images?.length) return "";
  return (
    `<!-- wp:gallery {"align":"wide","linkTo":"none","className":"cogent-gallery"} -->\n` +
    `<figure class="wp-block-gallery alignwide has-nested-images columns-default cogent-gallery">\n` +
    images.map(galleryFigure).join("\n") +
    `\n</figure>\n<!-- /wp:gallery -->` +
    (credit ? `\n\n<p class="gallery-credit">${esc(credit)}</p>` : "")
  );
}

/** Split a set of pictures into strips of three, dropping any remainder of one. */
export function intoStrips(images, per = GALLERY_PER_STRIP) {
  const strips = [];
  for (let i = 0; i < images.length; i += per) strips.push(images.slice(i, i + per));
  // A strip of one stretches across the row and looks like a mistake, and a
  // strip of four was the first thing JB rejected. So a lone leftover borrows
  // a picture from the strip before it and the two run as pairs: four becomes
  // 2 and 2, seven becomes 3, 2 and 2. Nothing is dropped.
  if (strips.length > 1 && strips[strips.length - 1].length === 1) {
    strips[strips.length - 1].unshift(strips[strips.length - 2].pop());
  }
  return strips;
}

/**
 * Put the strips into a finished body, each one directly above an h2.
 *
 * Headings are chosen evenly from the second one onwards: the first h2 follows
 * the standfirst and intro, and a strip above it pushes the reader away from
 * the opening. Returns the body unchanged when there are too few pictures or
 * nowhere to put them.
 *
 * @param {string} body      article HTML, with h2 section headings
 * @param {Array}  images    [{id, url, alt, caption}]
 * @param {{credit?: string}} opts
 */
export function withGalleries(body, images, { credit = null } = {}) {
  if (!Array.isArray(images) || images.length < GALLERY_MIN) return body;

  const headings = [...body.matchAll(/<h2[ >]/g)].map((m) => m.index);
  const usable = headings.slice(1); // never above the first section
  if (!usable.length) return body;

  const strips = intoStrips(images).slice(0, usable.length);
  if (!strips.length) return body;

  // Spread them: with three strips and six headings, use the 2nd, 4th and 6th.
  const step = usable.length / strips.length;
  const slots = strips.map((_, i) => usable[Math.min(usable.length - 1, Math.round(i * step))]);

  let out = body;
  for (let i = strips.length - 1; i >= 0; i--) {
    const isLast = i === strips.length - 1;
    const markup = galleryStrip(strips[i], { credit: isLast ? credit : null });
    out = out.slice(0, slots[i]) + markup + "\n\n" + out.slice(slots[i]);
  }
  return out;
}
