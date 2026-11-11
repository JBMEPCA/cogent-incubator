# Picture strips in an article

**The rule, JB, 11 November 2026: three or more usable pictures means strips of
three, each strip directly above a heading. Every title.**

Set after the Stephen Chick interview on Golf Resort Magazine, where GMS sent a
25-picture media kit. One gallery at the foot of the piece wastes the
photography; pictures dropped one at a time between paragraphs break the read.
Strips of three above the section headings do neither.

## When it applies

| Pictures | What to do |
|---|---|
| 1 | Lead image only. |
| 2 | Lead image, and the second inline where it belongs. No gallery. |
| 3 or more | Lead image, then the rest as strips of three above headings. |

The lead image is separate and always comes first. A strip never goes above the
first `h2`, because that heading follows the standfirst and the intro and a
strip there pushes the reader out of the opening.

## How to build it

`lib/gallery.js` does all of it:

```js
import { withGalleries } from "./gallery";

const body = withGalleries(articleHtml, pictures, { credit: "Images: Laguna Golf Phuket" });
```

where `pictures` is `[{ id, url, alt, caption }]` of media already imported into
that title's library. `withGalleries` chunks them into threes, folds a lone
leftover back into the strip before it, spreads the strips evenly across the
headings from the second one onwards, and puts a single credit line under the
last strip.

`galleryStrip()` is there if a build needs to place a strip by hand.

## What the markup has to carry

A core gallery block with the class `cogent-gallery`, aligned wide, each image
with the lightbox switched on:

```html
<!-- wp:gallery {"align":"wide","linkTo":"none","className":"cogent-gallery"} -->
<figure class="wp-block-gallery alignwide has-nested-images columns-default cogent-gallery">
  <!-- wp:image {"id":1528,"sizeSlug":"large","linkDestination":"none","lightbox":{"enabled":true}} -->
  <figure class="wp-block-image size-large"><img src="…" alt="…" class="wp-image-1528" sizes="(max-width: 781px) 60vw, 800px"/><figcaption class="wp-element-caption">…</figcaption></figure>
  <!-- /wp:image -->
  …
</figure>
<!-- /wp:gallery -->
```

Three details are load-bearing, each one from a bug:

- **`lightbox: {enabled: true}`** on every image, or the pictures do not open.
- **An explicit `sizes`**, or the browser can pull a small file from the srcset
  and the strip looks soft on a retina screen.
- **No `is-cropped`.** Core's cropped variant stretches each picture to fill its
  cell and fights the theme's grid.

## What the theme does with it

`cogent-base` 1.36.1 and up, deployed on all ten titles:

- `.cogent-gallery` is a grid of fixed-height cells, 220px on desktop and 150px
  below 781px, so a strip is one clean line at any width.
- Captions are present in the markup but hidden in the grid. The lightbox and
  screen readers still read them.
- Core's caption scrim is switched off. It hangs a `backdrop-filter: blur(3px)`
  along the bottom of any captioned gallery picture, which on a page of good
  photography is the first thing a reader notices. JB: do not blur the bottoms
  of images.

## Pictures and rights

Unchanged by this: a supplied media kit is credited to the subject, one credit
line for the set. A rival publisher's photograph may be used, but never one
carrying their watermark ([[lib/qa.js]] picture gate, rule 1).

Related: `docs/interview-format.md`.
