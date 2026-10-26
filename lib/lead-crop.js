import sharp from "sharp";

/**
 * Keep faces out of the theme's letterbox crop.
 *
 * WHY THIS EXISTS. cogent-base/templates/single.html renders the lead image
 * with aspectRatio 16/9 and object-fit cover, as do the post grids and the
 * homepage hero. So the browser takes the MIDDLE band of whatever it is given.
 * Hand it a tall portrait and the middle band starts below the eyes:
 *   - 20 Oct, Dental: the top of Sheena Tanna's head gone from a 612x918 photo.
 *   - 22 Oct, Dental: Dr George Wright cut off at the mouth on a 2560x2560
 *     press photograph, reported by his own press office.
 *
 * WHAT THIS DELIBERATELY IS NOT. The first version of this file cropped every
 * tall lead picture with sharp.strategy.attention. Tried against the 23 live
 * pictures the fleet audit turned up, that fixed every face and broke other
 * things, because "attention" means saturation and edges, not faces:
 *   - Dental 278, Cosmin Musat: his centre crop was fine; attention moved it
 *     onto the bright turquoise painting behind his head.
 *   - Golf 1139: dropped the golfer mid-swing in favour of the crowd.
 *   - Barbering 98 and 1109: cut the label off the product being written about.
 * A rule that fixes five faces and spoils five other pictures is not a rule.
 *
 * SO THIS ONLY MOVES A CROP WHEN THERE IS A FACE AND THE DEFAULT WOULD CUT IT.
 * It finds skin by colour, in RGB and YCbCr together, builds a per-row profile,
 * takes the topmost substantial run of skin as the head, and asks one question:
 * does the centre band contain that head? If it does, or if there is no skin to
 * speak of, the bytes are returned untouched and the browser crops as before.
 * Only when the head would be cut does it choose a window that holds the head
 * with headroom. Products, buildings and scenery are therefore never recomposed.
 *
 * On any failure it returns the original bytes. A lead picture cropped badly is
 * a bad day; a publish that throws because sharp choked is a worse one.
 */

export const LEAD_RATIO = 16 / 9;

const TOLERANCE = 0.04;   // already-wide images are left alone
const MIN_WIDTH = 640;
const MAX_WIDTH = 2000;
const MAX_RATIO = 3;      // panoramas: a 16:9 box is a sliver, leave them
const PROFILE_W = 160;    // width the skin profile is computed at
const ROW_SKIN = 0.06;    // fraction of a row that must be skin to count
const MIN_MASS = 0.012;   // fraction of the whole frame that must be skin
const HEADROOM = 0.45;    // of head height, kept above the head when possible
const MAX_HEAD_SPAN = 0.6; // a head taller than this is a warm background
const MAX_HEAD_WIDTH = 0.88; // skin filling more of the head rows than this is a backdrop
const GREY_COLOUR = 0.05; // below this share of coloured pixels it is mono
const MIN_BAND = 0.17;   // the band must remove this much off the top to matter

/** Classic RGB rule AND the YCbCr box, which together reject most wood and sand. */
function isSkin(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const rgb = r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b;
  if (!rgb) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

/**
 * Rows of skin, as fractions of the full height.
 * @returns {{top:number, bottom:number, mass:number}|null} the topmost head
 */
async function findHead(buffer) {
  const w = PROFILE_W;
  const { data, info } = await sharp(buffer)
    .resize({ width: w })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const h = info.height;
  const rows = new Array(h).fill(0);
  let total = 0, colourful = 0;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 20) colourful++;
      if (isSkin(r, g, b)) n++;
    }
    rows[y] = n / info.width;
    total += n;
  }
  // A black and white photograph has no skin colour to find. Say so rather
  // than reporting no face, so the caller can fall back.
  if (colourful / (info.width * h) < GREY_COLOUR) return { greyscale: true };
  if (total / (info.width * h) < MIN_MASS) return null;

  // Contiguous runs above the row threshold, allowing a two-row gap so that
  // spectacles or a microphone do not split one head into two.
  const runs = [];
  let start = -1, gap = 0;
  for (let y = 0; y < h; y++) {
    if (rows[y] >= ROW_SKIN) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      if (++gap > 2) { runs.push([start, y - gap]); start = -1; gap = 0; }
    }
  }
  if (start >= 0) runs.push([start, h - 1]);
  if (!runs.length) return null;

  // The head is the topmost run carrying real mass, not a stray hand.
  const withMass = runs.map(([a, b]) => ({
    a, b, mass: rows.slice(a, b + 1).reduce((s, v) => s + v, 0),
  }));
  const best = withMass.reduce((m, r) => (r.mass > m.mass ? r : m), withMass[0]);
  const head = withMass.find((r) => r.mass >= best.mass * 0.4) || best;

  // Two sanity checks that reject a warm background pretending to be a face.
  // A yellow product tube, a wheat field and a beige building all passed the
  // colour test; none of them is shaped like a head.
  const span = (head.b - head.a + 1) / h;
  if (span > MAX_HEAD_SPAN) return null;
  // Columns carrying skin WITHIN the head rows. Measured across the whole
  // frame this rejected real faces, because a hand elsewhere widened it.
  const inRun = new Array(info.width).fill(0);
  for (let y = head.a; y <= head.b; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (isSkin(data[i], data[i + 1], data[i + 2])) inRun[x]++;
    }
  const wide = inRun.filter((c) => c > 0).length / info.width;
  if (wide > MAX_HEAD_WIDTH) return null;

  return { top: head.a / h, bottom: head.b / h, mass: head.mass / h };
}

/**
 * Would the centre band cut the top off a head in this picture?
 *
 * Scale invariant on purpose, so a 300px thumbnail gives the same verdict as
 * the 2560px original: everything it compares is a fraction of the height. The
 * fleet sweep uses this to test eleven hundred pictures from WordPress's own
 * small derivatives, 15KB each instead of several hundred, and only fetches a
 * full-size original for the ones that come back true.
 *
 * The first version of that sweep called cropToLead on the thumbnails and
 * reported zero problems across the whole fleet, which was not a result: every
 * thumbnail was being rejected by the MIN_WIDTH guard before the test ran.
 *
 * @returns {{cut: boolean, reason: string}}
 */
export async function wouldCutFace(buffer) {
  try {
    const m = await sharp(buffer).metadata();
    if (!m.width || !m.height) return { cut: false, reason: "dimensions unreadable" };
    if ((m.pages || 1) > 1) return { cut: false, reason: "animated" };
    if (m.hasAlpha) return { cut: false, reason: "has transparency" };
    const ratio = m.width / m.height;
    if (ratio > MAX_RATIO) return { cut: false, reason: `panorama at ${ratio.toFixed(2)}:1` };
    if (ratio >= LEAD_RATIO - TOLERANCE) return { cut: false, reason: "already 16:9 or wider" };

    const head = await findHead(buffer);
    if (head?.greyscale) {
      return ratio > 1.15
        ? { cut: false, reason: "black and white but not a portrait" }
        : { cut: true, reason: "black and white portrait" };
    }
    if (!head) return { cut: false, reason: "no face found" };

    const cropH = m.width / LEAD_RATIO;
    const centreTopFrac = (m.height - cropH) / 2 / m.height;
    // The band has to take a real slice before any of this is worth acting on.
    // At 4:3 it removes the top 13%, which is ceiling, sky or studio backdrop.
    // Every genuine cut face found on the fleet sat at a band of 22% or more
    // (portrait and square pictures); every false positive sat at 13-15%.
    // Sweeping the fleet without this gate flagged 122 pictures, 106 of them
    // reporting a face starting at 0-2%: warm ceilings and wood passing the
    // colour test, on photographs nothing was wrong with.
    if (centreTopFrac < MIN_BAND) return { cut: false, reason: `band only takes ${Math.round(centreTopFrac * 100)}% off the top` };
    return head.top < centreTopFrac
      ? { cut: true, reason: `face starts at ${Math.round(head.top * 100)}%, band starts at ${Math.round(centreTopFrac * 100)}%` }
      : { cut: false, reason: `face starts at ${Math.round(head.top * 100)}%, inside the band` };
  } catch (e) {
    return { cut: false, reason: `probe failed: ${String(e.message).slice(0, 80)}` };
  }
}

/**
 * @returns {{buffer: Buffer, contentType: string, cropped: boolean, note: string}}
 */
export async function cropToLead(buffer, contentType = "image/jpeg") {
  const keep = (note) => ({ buffer, contentType, cropped: false, note });
  try {
    const m = await sharp(buffer).metadata();
    if (!m.width || !m.height) return keep("dimensions unreadable");
    if ((m.pages || 1) > 1) return keep("animated");
    if (m.hasAlpha) return keep("has transparency, treated as a logo or graphic");
    if (m.width < MIN_WIDTH) return keep(`only ${m.width}px wide`);

    const ratio = m.width / m.height;
    if (ratio > MAX_RATIO) return keep(`panorama at ${ratio.toFixed(2)}:1`);
    if (ratio >= LEAD_RATIO - TOLERANCE) return keep("already 16:9 or wider");

    const head = await findHead(buffer);

    // Black and white. Colour cannot find the face, but a TALL mono picture is
    // nearly always a portrait, and the centre band of a portrait is the fault
    // we are here to fix. Airport 889 is exactly this: a mono headshot the
    // centre crop reduced to a headless torso. Attention is safe on these
    // because there is no saturated distractor for it to prefer.
    if (head?.greyscale) {
      if (ratio > 1.15) return keep("black and white but not a portrait, left alone");
      let w = Math.min(m.width, MAX_WIDTH);
      let h = Math.round(w / LEAD_RATIO);
      if (h > m.height) { h = m.height; w = Math.round(h * LEAD_RATIO); }
      const fmt0 = m.format === "png" ? "png" : m.format === "webp" ? "webp" : "jpeg";
      let p = sharp(buffer).resize(w, h, { fit: "cover", position: sharp.strategy.attention });
      p = fmt0 === "png" ? p.png() : fmt0 === "webp" ? p.webp({ quality: 90 }) : p.jpeg({ quality: 88, mozjpeg: true });
      return {
        buffer: await p.toBuffer(),
        contentType: fmt0 === "jpeg" ? "image/jpeg" : `image/${fmt0}`,
        cropped: true,
        note: `${m.width}x${m.height} to ${w}x${h}; black and white portrait, composed by attention`,
      };
    }
    if (!head) return keep("no face found, left for the browser to crop");

    // The window the browser would take today.
    const cropH = Math.round(m.width / LEAD_RATIO);
    const centreTop = Math.round((m.height - cropH) / 2);
    const headTopPx = Math.round(head.top * m.height);
    const headBotPx = Math.round(head.bottom * m.height);

    // ONLY the top of the head matters. Testing whether the whole skin run sat
    // inside the band made this fire on pictures whose face was perfectly safe
    // and whose chest or hands merely ran out of the bottom, and on Barbering
    // 351 it threw away the product being written about to chase a forearm
    // below the band. A head that starts below the top of the band is not
    // being cut off; it is just low in the frame, which is the photographer's
    // choice and none of our business.
    if ((centreTop / m.height) < MIN_BAND) {
      return keep(`band only takes ${Math.round((centreTop / m.height) * 100)}% off the top`);
    }
    if (headTopPx >= centreTop) {
      return keep(`face starts at ${Math.round(head.top * 100)}%, inside the centre band at ${Math.round((centreTop / m.height) * 100)}%`);
    }

    // Put the head in with headroom, then clamp inside the frame.
    const headH = Math.max(1, headBotPx - headTopPx);
    let top = Math.round(headTopPx - headH * HEADROOM);
    top = Math.max(0, Math.min(top, m.height - cropH));

    let w = Math.min(m.width, MAX_WIDTH);
    let h = Math.round(w / LEAD_RATIO);
    const scale = w / m.width;

    const fmt = m.format === "png" ? "png" : m.format === "webp" ? "webp" : "jpeg";
    let pipe = sharp(buffer)
      .extract({ left: 0, top, width: m.width, height: cropH })
      .resize(w, h);
    pipe = fmt === "png" ? pipe.png() : fmt === "webp" ? pipe.webp({ quality: 90 }) : pipe.jpeg({ quality: 88, mozjpeg: true });
    const out = await pipe.toBuffer();

    return {
      buffer: out,
      contentType: fmt === "jpeg" ? "image/jpeg" : `image/${fmt}`,
      cropped: true,
      note:
        `${m.width}x${m.height} to ${w}x${h}; face at ${Math.round(head.top * 100)}%-${Math.round(head.bottom * 100)}% ` +
        `would have been cut by the centre band at ${Math.round((centreTop / m.height) * 100)}%`,
    };
  } catch (e) {
    return keep(`crop failed, original kept: ${String(e.message).slice(0, 120)}`);
  }
}
