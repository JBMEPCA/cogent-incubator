// Draws the interview overlay onto a photograph.
//
// The look was set by hand on nine real interviews and approved by JB on 1 Oct
// 2026 (the prototype lives in ~/.claude/social-overlay-prototype): the
// series name in Permanent Marker with the company under a thin brand-colour
// bar, a slanted brand-colour name tag per person with a hand-drawn arrow to
// their head, and the title's reversed logo over a dark fade. This file does
// automatically what was done there by eye: it frames the picture, finds the
// clear space, and puts each piece where it covers no face.
//
// All lettering is drawn as SVG paths from the font files in ./assets, never
// as <text>. The serverless runtime has no fonts installed, so anything set in
// a font would render as empty boxes in production while looking right here.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as fontkit from "fontkit";

const ASSETS = path.join(process.cwd(), "lib/social-overlay/assets");

let fonts = null;
function loadFonts() {
  if (!fonts) {
    fonts = {
      marker: fontkit.create(fs.readFileSync(path.join(ASSETS, "fonts/PermanentMarker-Regular.ttf"))),
      bebas: fontkit.create(fs.readFileSync(path.join(ASSETS, "fonts/BebasNeue-Regular.ttf"))),
    };
  }
  return fonts;
}

export const FORMATS = {
  // LinkedIn keeps the photo's own shape, inside the range its feed shows
  // uncropped: 4:5 portrait to 1.91:1 landscape.
  linkedin: { width: 1600, minAspect: 0.8, maxAspect: 1.91 },
  // Instagram takes 4:5 portrait at 1080 x 1350, JPEG only.
  instagram: { width: 1080, height: 1350 },
};

// ---------------------------------------------------------------------------
// Lettering
// ---------------------------------------------------------------------------

// Characters a font lacks are drawn without their accent rather than as a box.
function fit(font, str) {
  return [...str]
    .map((ch) => (font.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : ch.normalize("NFKD").replace(/[̀-ͯ]/g, "")))
    .filter((ch) => ch && font.hasGlyphForCodePoint(ch.codePointAt(0)))
    .join("");
}

/** Text as one SVG path. y is the baseline. */
function text(font, str, size, x, y, tracking = 0.02) {
  const scale = size / font.unitsPerEm;
  const lay = font.layout(fit(font, str));
  let pen = 0;
  let d = "";
  lay.glyphs.forEach((g, i) => {
    if (g.path && g.path.commands.length) d += g.path.translate(pen, 0).scale(scale, -scale).translate(x, y).toSVG();
    pen += lay.positions[i].xAdvance + tracking * font.unitsPerEm;
  });
  return { d, width: pen * scale };
}

// Width only, without building any outlines: the layout search measures
// thousands of times and draws once.
const widths = new Map();
function measure(font, str, size, tracking = 0.02) {
  const key = `${font.postscriptName}|${str}|${tracking}`;
  if (!widths.has(key)) {
    const lay = font.layout(fit(font, str));
    widths.set(key, lay.positions.reduce((s, p) => s + p.xAdvance + tracking * font.unitsPerEm, 0) / font.unitsPerEm);
  }
  return widths.get(key) * size;
}

// Plain text only: never markup, never an emoji, never a dash we would not print.
export const plain = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const overlaps = (a, b, pad = 0) =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

const inside = (r, W, H, m) => r.x >= m && r.y >= m && r.x + r.w <= W - m && r.y + r.h <= H - m;

// The area a face really takes: hair above it, ears beside it.
const headBox = (f) => ({ x: f.x - f.w * 0.25, y: f.y - f.h * 0.35, w: f.w * 1.5, h: f.h * 1.45 });

const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

const r1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Reading the picture
// ---------------------------------------------------------------------------

// A small greyscale copy of the canvas, with summed-area tables so the
// brightness and busyness of any box is four lookups.
async function analyse(canvas, W, H) {
  const aw = 200;
  const ah = Math.max(1, Math.round((aw * H) / W));
  const { data } = await sharp(canvas).resize(aw, ah, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const lum = new Float64Array((aw + 1) * (ah + 1));
  const grad = new Float64Array((aw + 1) * (ah + 1));
  for (let y = 0; y < ah; y++) {
    let rl = 0;
    let rg = 0;
    for (let x = 0; x < aw; x++) {
      const v = data[y * aw + x] / 255;
      const gx = x + 1 < aw ? Math.abs(data[y * aw + x + 1] / 255 - v) : 0;
      const gy = y + 1 < ah ? Math.abs(data[(y + 1) * aw + x] / 255 - v) : 0;
      rl += v;
      rg += gx + gy;
      lum[(y + 1) * (aw + 1) + x + 1] = lum[y * (aw + 1) + x + 1] + rl;
      grad[(y + 1) * (aw + 1) + x + 1] = grad[y * (aw + 1) + x + 1] + rg;
    }
  }
  const sx = aw / W;
  const sy = ah / H;
  const sum = (t, r) => {
    const x0 = Math.max(0, Math.min(aw, Math.floor(r.x * sx)));
    const y0 = Math.max(0, Math.min(ah, Math.floor(r.y * sy)));
    const x1 = Math.max(x0 + 1, Math.min(aw, Math.ceil((r.x + r.w) * sx)));
    const y1 = Math.max(y0 + 1, Math.min(ah, Math.ceil((r.y + r.h) * sy)));
    const s = t[y1 * (aw + 1) + x1] - t[y0 * (aw + 1) + x1] - t[y1 * (aw + 1) + x0] + t[y0 * (aw + 1) + x0];
    return s / ((x1 - x0) * (y1 - y0));
  };
  return { lum: (r) => sum(lum, r), busy: (r) => sum(grad, r) };
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/**
 * Where the photo sits on the canvas. Crops to the target shape around the
 * faces when they fit; otherwise ("fit") shows the whole photo across the
 * canvas over a blurred, darkened copy of itself.
 */
function frame(W0, H0, faces, fmt) {
  const spec = FORMATS[fmt];
  const a0 = W0 / H0;
  const a = spec.height ? spec.width / spec.height : Math.min(spec.maxAspect, Math.max(spec.minAspect, a0));
  const W = spec.width;
  const H = Math.round(W / a);

  if (Math.abs(a - a0) < 0.01) return { W, H, mode: "full", crop: { left: 0, top: 0, width: W0, height: H0 } };

  const fx0 = faces.length ? Math.min(...faces.map((f) => f.x - f.w * 0.5)) : null;
  const fx1 = faces.length ? Math.max(...faces.map((f) => f.x + f.w * 1.5)) : null;
  const fy0 = faces.length ? Math.min(...faces.map((f) => f.y - f.h * 0.6)) : null;
  const fy1 = faces.length ? Math.max(...faces.map((f) => f.y + f.h * 1.3)) : null;

  if (a0 > a) {
    const cw = Math.round(H0 * a);
    if (faces.length && fx1 - fx0 > cw) return { W, H, mode: "fit" };
    const centre = faces.length ? (fx0 + fx1) / 2 : W0 / 2;
    const left = Math.round(Math.min(W0 - cw, Math.max(0, centre - cw / 2)));
    return { W, H, mode: "crop", crop: { left, top: 0, width: cw, height: H0 } };
  }
  const ch = Math.round(W0 / a);
  if (faces.length && fy1 - fy0 > ch) return { W, H, mode: "fit" };
  // Faces in the upper part of the frame, with room above for the series name.
  const top = faces.length ? Math.min(Math.max(0, fy0 - ch * 0.18), H0 - ch) : (H0 - ch) * 0.3;
  return { W, H, mode: "crop", crop: { left: 0, top: Math.round(Math.max(0, top)), width: W0, height: ch } };
}

async function canvasFor(photo, W0, H0, fr, light) {
  const { W, H } = fr;
  if (fr.mode !== "fit") {
    const buf = await sharp(photo).rotate().extract(fr.crop).resize(W, H, { fit: "fill", kernel: "lanczos3" }).toBuffer();
    const s = W / fr.crop.width;
    return { buf, map: (f) => ({ ...f, x: (f.x - fr.crop.left) * s, y: (f.y - fr.crop.top) * s, w: f.w * s, h: f.h * s }) };
  }
  const ph = Math.round((W * H0) / W0);
  const top = Math.round((H - ph) / 2);
  const back = await sharp(photo)
    .rotate()
    .resize(W, H, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: light ? 1.05 : 0.55 })
    .toBuffer();
  const front = await sharp(photo).rotate().resize(W, ph).toBuffer();
  const buf = await sharp(back).composite([{ input: front, left: 0, top }]).jpeg({ quality: 95 }).toBuffer();
  const s = W / W0;
  return { buf, map: (f) => ({ ...f, x: f.x * s, y: f.y * s + top, w: f.w * s, h: f.h * s }), band: { top, bottom: top + ph } };
}

// ---------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------

const SLANT = 0.22;
const TILT = -4;

/** The series block: marker lines, brand bar, Bebas sub lines. Unpositioned. */
function seriesBlock({ series, subLines, u, W, narrow = false, subU = u }) {
  const { marker, bebas } = loadFonts();
  const words = plain(series).toUpperCase().split(/\s+/).filter(Boolean);
  let size = 50 * u;
  // Narrow breaks at every word that can stand alone ("GOLF / RESORT /
  // LEADER"), keeping little joining words with the one before them ("IN THE /
  // CHAIR", "MEET THE / MANAGER"), for a gap beside a head that is tall rather
  // than wide.
  const GLUE = new Set(["THE", "A", "AN", "OF", "IN", "ON", "AT", "TO", "AND", "&", "FOR", "WITH"]);
  const wrap = (sz) => {
    if (narrow) {
      const lines = [];
      let cur = [];
      words.forEach((w, i) => {
        cur.push(w);
        const next = words[i + 1];
        const breakAfter = GLUE.has(w) ? cur.length > 1 : next && !GLUE.has(next);
        if (breakAfter || !next) {
          lines.push(cur.join(" "));
          cur = [];
        }
      });
      return lines;
    }
    const maxW = W * 0.42;
    const lines = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && measure(marker, `${last} ${w}`, sz) <= maxW) lines[lines.length - 1] = `${last} ${w}`;
      else lines.push(w);
    }
    return lines;
  };
  const maxW = W * 0.42;
  let lines = wrap(size);
  if (lines.length > 2) {
    size = 40 * u;
    lines = wrap(size);
  }
  while (!narrow && Math.max(...lines.map((l) => measure(marker, l, size))) > maxW && size > 24 * u) size *= 0.92;

  const lead = size * 1.12;
  const subs = subLines.map((s) => plain(s).toUpperCase()).filter(Boolean);
  // The company line shrinks less than the series name, or it stops being read.
  let subSize = 22 * subU;
  const subMax = W * 0.5;
  while (subs.length && Math.max(...subs.map((s) => measure(bebas, s, subSize, 0.06))) > subMax && subSize > 14 * subU) subSize *= 0.92;
  const subLead = subSize * 1.3;

  const top = size * 0.85;
  const lastBase = top + (lines.length - 1) * lead;
  const subTop = lastBase + 15 * u;
  const height = subs.length ? subTop + 21 * u + (subs.length - 1) * subLead + 6 * u : lastBase + 14 * u;
  const width = Math.max(...lines.map((l) => measure(marker, l, size)), ...subs.map((s) => 12 * u + measure(bebas, s, subSize, 0.06)));

  return {
    lines: lines.length,
    w: width,
    h: height,
    draw(x, y, { ink, colour, shadow }) {
      let out = "";
      const label = lines.map((l, i) => text(marker, l, size, x, y + top + i * lead).d).join("");
      out += `<path d="${label}" fill="${ink}"${shadow}/>`;
      if (subs.length) {
        const barH = 21 * u + (subs.length - 1) * subLead;
        out += `<rect x="${r1(x)}" y="${r1(y + subTop)}" width="${r1(4.5 * u)}" height="${r1(barH)}" fill="${colour}"/>`;
        subs.forEach((s, i) => {
          out += `<path d="${text(bebas, s, subSize, x + 12 * u, y + subTop + 19 * u + i * subLead, 0.06).d}" fill="${ink}"${shadow}/>`;
        });
      }
      return out;
    },
  };
}

/** A slanted name plate, tilted. Returns its drawing and its bounding box. */
function nameTag(name, cx, cy, size, colour) {
  const { marker } = loadFonts();
  const label = plain(name).toUpperCase();
  const tw = measure(marker, label, size);
  const padX = size * 0.45;
  const h = size * 1.35;
  const w = tw + padX * 2;
  // Laid out from its baseline-left corner, then centred on (cx, cy).
  const x = cx - (w + h * SLANT) / 2;
  const y = cy + size * 0.35;
  const top = y - size * 1.02;
  const corners = [
    [x + h * SLANT, top],
    [x + w + h * SLANT, top],
    [x + w, top + h],
    [x, top + h],
  ];
  const rad = (TILT * Math.PI) / 180;
  const rot = ([px, py]) => [
    x + (px - x) * Math.cos(rad) - (py - y) * Math.sin(rad),
    y + (px - x) * Math.sin(rad) + (py - y) * Math.cos(rad),
  ];
  const rc = corners.map(rot);
  const xs = rc.map((p) => p[0]);
  const ys = rc.map((p) => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return {
    box,
    // Outlines are built only for the tag that is actually drawn.
    draw: () => {
      const plate = `M${corners.map((p) => p.map(r1).join(" ")).join("L")}Z`;
      const inner = text(marker, label, size, x + padX + h * SLANT * 0.5, y);
      return `<g filter="url(#sh)" transform="rotate(${TILT} ${r1(x)} ${r1(y)})"><path d="${plate}" fill="${colour}"/><path d="${inner.d}" fill="#fff"/></g>`;
    },
  };
}

/** A curve from the tag to beside the head, and two short strokes for the head. */
function arrowPath(start, exit, tip, approach, u) {
  const L = Math.hypot(tip[0] - start[0], tip[1] - start[1]);
  const c1 = [start[0] + exit[0] * L * 0.5, start[1] + exit[1] * L * 0.5];
  const c2 = [tip[0] - approach[0] * L * 0.5, tip[1] - approach[1] * L * 0.5];
  const pts = Array.from({ length: 24 }, (_, i) => cubic(start, c1, c2, tip, i / 23));
  const ang = Math.atan2(approach[1], approach[0]);
  const hl = 15 * u;
  const sp = 0.55;
  const p1 = [tip[0] - hl * Math.cos(ang - sp), tip[1] - hl * Math.sin(ang - sp)];
  const p2 = [tip[0] - hl * Math.cos(ang + sp), tip[1] - hl * Math.sin(ang + sp)];
  const d = `M${start.map(r1).join(" ")} C ${c1.map(r1).join(" ")}, ${c2.map(r1).join(" ")}, ${tip.map(r1).join(" ")}`;
  const head = `M${p1.map(r1).join(" ")} L${tip.map(r1).join(" ")} L${p2.map(r1).join(" ")}`;
  return { pts, length: L, draw: (ink) => `<g fill="none" stroke="${ink}" stroke-width="${r1(3.6 * u)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)"><path d="${d}"/><path d="${head}"/></g>` };
}

/**
 * The best place for one person's tag and arrow, or null when there is no
 * clear space for it. Every candidate that would touch a face, sit nearer
 * someone else, or run its arrow through anything is thrown out; the rest are
 * scored on how busy the background is and how far the tag is from its face.
 */
function placeTag({ name, face: f, faces, obstacles, arrows, map, W, H, u, colour }) {
  // Full size, or a little smaller when the full-size tag will not fit.
  let best = null;
  for (const [sizeCost, size] of [[0, 26 * u], [0.35, 22 * u]]) {
    const found = placeTagAt({ name, f, faces, obstacles, arrows, map, W, H, u, colour, size });
    if (found && (!best || found.cost + sizeCost < best.cost)) best = { ...found, cost: found.cost + sizeCost };
  }
  return best;
}

function placeTagAt({ name, f, faces, obstacles, arrows, map, W, H, u, colour, size }) {
  const fcx = f.x + f.w / 2;
  const fcy = f.y + f.h / 2;
  const probe = nameTag(name, 0, 0, size, colour).box;
  const others = faces.filter((g) => g !== f);
  let best = null;

  const columns = [];
  for (const gap of [0.3, 0.65, 1.0, 1.5]) {
    columns.push({ side: "right", cx: f.x + f.w * 1.25 + gap * f.w + probe.w / 2 });
    columns.push({ side: "left", cx: f.x - f.w * 0.25 - gap * f.w - probe.w / 2 });
  }
  for (const dx of [-0.6, -0.3, 0, 0.3, 0.6]) columns.push({ side: "below", cx: fcx + dx * f.w });

  for (const col of columns) {
    for (let k = -2; k <= 9; k++) {
      const cy = fcy + k * 0.3 * f.h;
      if (col.side === "below" && cy < f.y + f.h * 1.4) continue;
      const tag = nameTag(name, col.cx, cy, size, colour);
      const b = tag.box;
      if (!inside(b, W, H, 14 * u)) continue;
      if (faces.some((g) => overlaps(b, headBox(g), 6 * u))) continue;
      if (obstacles.some((o) => overlaps(b, o, 8 * u))) continue;

      // Nearer its own face than anyone else's, by a clear margin, so nobody
      // could read it as someone else's name.
      const d = Math.hypot(b.x + b.w / 2 - fcx, b.y + b.h / 2 - fcy);
      if (others.some((g) => Math.hypot(b.x + b.w / 2 - (g.x + g.w / 2), b.y + b.h / 2 - (g.y + g.h / 2)) < d * 1.35)) continue;
      // Not on another person's body either.
      if (others.some((g) => overlaps(b, { x: g.x - g.w * 0.5, y: g.y + g.h, w: g.w * 2, h: H }, 0))) continue;

      // Arrow: out of the tag's nearest edge, into the side of the head.
      let tip;
      let approach;
      if (col.side === "right") {
        tip = [f.x + f.w * 1.2, f.y + f.h * 0.62];
        approach = [-1, 0];
      } else if (col.side === "left") {
        tip = [f.x - f.w * 0.2, f.y + f.h * 0.62];
        approach = [1, 0];
      } else {
        tip = [fcx + (col.cx - fcx) * 0.25, f.y + f.h * 1.18];
        approach = [0, -1];
      }
      let start;
      let exit;
      const nearX = col.side === "right" ? b.x + b.w * 0.25 : col.side === "left" ? b.x + b.w * 0.75 : b.x + b.w / 2;
      if (b.y > tip[1] + 4 * u) {
        start = [nearX, b.y - 6 * u];
        exit = [0, -1];
      } else if (b.y + b.h < tip[1] - 4 * u) {
        start = [nearX, b.y + b.h + 6 * u];
        exit = [0, 1];
      } else {
        start = col.side === "right" ? [b.x - 6 * u, b.y + b.h / 2] : [b.x + b.w + 6 * u, b.y + b.h / 2];
        exit = col.side === "right" ? [-1, 0] : [1, 0];
      }
      if (col.side === "below") {
        // Straight on towards the chin, not an S-bend.
        const dx = tip[0] - start[0];
        const dy = tip[1] - start[1];
        const n = Math.hypot(dx, dy) || 1;
        const ax = dx / n;
        const ay = dy / n - 1;
        const an = Math.hypot(ax, ay) || 1;
        approach = [ax / an, ay / an];
      }
      const arrow = arrowPath(start, exit, tip, approach, u);
      // Long enough to read as a drawn arrow, short enough to stay with its face.
      if (arrow.length < (col.side === "below" ? 80 : 55) * u || arrow.length > Math.max(3.2 * f.w, 260 * u)) continue;
      // The line stays off every face and every other piece.
      const clear = arrow.pts.slice(1, -2).every(
        ([px, py]) =>
          px > 4 * u && py > 4 * u && px < W - 4 * u && py < H - 4 * u &&
          !faces.some((g) => px > g.x && px < g.x + g.w && py > g.y && py < g.y + g.h) &&
          ![...obstacles, b].some((o) => px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h) &&
          !arrows.some((a) => a.pts.some(([qx, qy]) => Math.hypot(qx - px, qy - py) < 10 * u))
      );
      if (!clear) continue;

      const cost =
        // The plate is solid, so a busy background matters less than for text.
        map.busy(b) * 3 +
        (d / f.w) * 0.35 +
        (arrow.length / f.w) * 0.15 +
        (col.side === "below" ? 0.45 : 0) +
        (cy < fcy ? 0.1 : 0);
      if (!best || cost < best.cost) best = { cost, tag, arrow };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The whole overlay
// ---------------------------------------------------------------------------

/**
 * photo: Buffer of the original picture
 * faces: [{x,y,w,h}] in photo pixels, background faces already removed
 * tags: [{ name, face }] from names.js assignNames, possibly empty
 * Returns { buffer, width, height, report }.
 */
export async function renderOverlay(photo, { slug, colour, series, company, names = [], faces, tags, format = "linkedin" }) {
  const meta = await sharp(photo).rotate().metadata();
  const swap = meta.orientation >= 5;
  const W0 = swap ? meta.height : meta.width;
  const H0 = swap ? meta.width : meta.height;

  const fr = frame(W0, H0, faces, format);
  // Light or dark is decided on the framed picture, below; the blurred
  // backdrop of a "fit" frame is darkened, which only suits a dark picture,
  // so a light one is read from the photo itself first.
  const pre = await analyse(await sharp(photo).rotate().resize(400).toBuffer(), W0, H0);
  const lightPhoto = isLight(pre, W0, H0);
  const { buf: canvas, map: toCanvas } = await canvasFor(photo, W0, H0, fr, lightPhoto);
  const { W, H } = fr;
  const u = Math.sqrt(W * H) / 816;
  const m = 30 * u;
  const map = await analyse(canvas, W, H);
  const light = isLight(map, W, H);

  const cfaces = faces.map(toCanvas);
  // The same objects as cfaces, so a tag can tell its own face from the rest.
  const ctags = tags.map((t) => {
    const i = faces.indexOf(t.face);
    if (i < 0) throw new Error("a tagged face is not among the detected faces");
    return { name: t.name, face: cfaces[i] };
  });
  const visible = (f) => f.x >= 0 && f.y >= 0 && f.x + f.w <= W && f.y + f.h <= H;

  const ink = light ? "#1A1712" : "#FFFFFF";
  const shadow = light ? "" : ` filter="url(#sh)"`;
  const heads = cfaces.map(headBox);

  // Tags first decided in principle, then everything placed: if any tag will
  // not fit, the names go into the series block instead.
  const tryLayout = (withTags) => {
    const subLines = (withTags ? [company] : [names.join(" and "), company]).filter(Boolean);

    // Series name: along the top, top left by preference, sliding along the
    // edge or a little smaller before it would touch a head; along the bottom
    // only when the top is all faces.
    const labels = [];
    for (const [scale, narrow] of [[1, false], [1, true], [0.85, false], [0.85, true], [0.72, false], [0.72, true], [0.6, false], [0.6, true]]) {
      const block = seriesBlock({ series, subLines, u: u * scale, W, narrow, subU: u * Math.max(scale, 0.85) });
      if (narrow && block.lines === seriesBlock({ series, subLines, u: u * scale, W }).lines) continue;
      const span = Math.max(1, W - 2 * m - block.w);
      for (const edge of ["t", "b"]) {
        const y = edge === "t" ? m : H - m - block.h;
        for (let i = 0; i <= 20; i++) {
          const x = m + (span * i) / 20;
          const r = { x, y, w: block.w, h: block.h };
          if (heads.some((h) => overlaps(r, h, 4 * u))) continue;
          // Nearest corner, left before right; shrinking costs more than sliding.
          const corner = Math.min(i / 20, 1.15 - i / 20);
          const c = corner * 0.5 + (1 - scale) * 0.8 + (narrow ? 0.05 : 0) + (edge === "b" ? 0.45 : 0) + map.busy(r) * 2;
          labels.push({ at: edge + (x + block.w / 2 < W / 2 ? "l" : "r"), x, y, r, block, cost: c });
        }
      }
    }
    labels.sort((a, b) => a.cost - b.cost);

    // The best series spot and logo spot that still leave room for every
    // tag. Tried in order of preference, so the first that works is kept.
    // A hard budget, because this runs inside a posting job with a function
    // time limit: a picture with no room for a tag must fall back to plain
    // names in seconds, not search every corner for a minute.
    const deadline = Date.now() + 6000;
    let tries = 0;
    for (const label of labels) {
      for (const logo of logoSpots({ W, H, m, u, light, slug, label, heads, map })) {
        if (++tries > 40 || (withTags && Date.now() > deadline)) return null;
        const obstacles = [label.r, logo.r];
        const arrows = [];
        const placed = [];
        let ok = true;
        if (withTags) {
          // Largest face first: it has the most room to lose.
          for (const t of [...ctags].sort((a, b) => b.face.w - a.face.w)) {
            const p = visible(t.face) && placeTag({ ...t, faces: cfaces, obstacles, arrows, map, W, H, u, colour });
            if (!p) {
              ok = false;
              break;
            }
            placed.push(p);
            obstacles.push(p.tag.box);
            arrows.push(p.arrow);
          }
        }
        if (ok) return { block: label.block, label, logo, placed };
      }
    }
    return null;
  };

  let layout = ctags.length ? tryLayout(true) : null;
  const tagged = Boolean(layout);
  if (!layout) layout = tryLayout(false);
  if (!layout) throw new Error("no clear space for the series name and logo");

  const { block, label, logo, placed } = layout;
  const labelTop = label.at[0] === "t";
  const logoTop = logo.at[0] === "t";

  let fades = "";
  if (!light) {
    if (labelTop) fades += `<rect width="${W}" height="${r1(label.r.y + label.r.h + 60 * u)}" fill="url(#t)"/>`;
    if (!labelTop || !logoTop) {
      const h = Math.max(!logoTop ? logo.r.h + m + 70 * u : 0, !labelTop ? label.r.h + m + 60 * u : 0);
      fades += `<rect y="${r1(H - h)}" width="${W}" height="${r1(h)}" fill="url(#b)"/>`;
    }
    if (logoTop) {
      const cx = logo.at[1] === "r" ? W : 0;
      fades += `<radialGradient id="r" cx="${cx / W}" cy="0" r="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
      const rw = logo.r.w + m * 2 + 160 * u;
      fades += `<rect x="${logo.at[1] === "r" ? W - rw : 0}" y="0" width="${r1(rw)}" height="${r1(logo.r.h + m * 2 + 90 * u)}" fill="url(#r)"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${r1(1.2 * u)}" stdDeviation="${r1(2 * u)}" flood-color="#000" flood-opacity="${light ? ".25" : ".7"}"/></filter>
  <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
</defs>
${fades}
${block.draw(label.x, label.y, { ink, colour, shadow })}
${placed.map((p) => p.tag.draw() + p.arrow.draw(light ? colour : "#fff")).join("\n")}
</svg>`;

  const buffer = await sharp(canvas)
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: await logo.png, left: Math.round(logo.r.x), top: Math.round(logo.r.y) },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return {
    buffer,
    width: W,
    height: H,
    report: {
      format,
      frame: fr.mode,
      light,
      tagged: tagged ? ctags.map((t) => t.name) : [],
      label: label.at,
      logo: logo.at,
    },
  };
}

function isLight(map, W, H) {
  const top = map.lum({ x: 0, y: 0, w: W, h: H * 0.25 });
  const bottom = map.lum({ x: 0, y: H * 0.75, w: W, h: H * 0.25 });
  const all = map.lum({ x: 0, y: 0, w: W, h: H });
  return top > 0.74 && bottom > 0.66 && all > 0.68;
}

// The title's logo, sized by area so a stacked mark and a one-line mark carry
// the same weight, and placed bottom left unless that corner is busy or taken.
// Every usable corner, best first.
const logoCache = new Map();
function logoSpots({ W, H, m, u, light, slug, label, heads, map }) {
  const file = path.join(ASSETS, "logos", slug, light ? "wordmark.svg" : "wordmark-reversed.svg");
  if (!fs.existsSync(file)) throw new Error(`no logo for ${slug}`);
  const svg = fs.readFileSync(file, "utf8");
  const vb = svg.match(/viewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
  const aspect = vb ? vb[2] / vb[3] : 3;
  const w = Math.round(Math.min(W * 0.4, Math.sqrt(250 * 75 * aspect) * u));
  const h = Math.round(w / aspect);
  const spots = [
    { at: "bl", x: m, y: H - m - h, cost: 0 },
    { at: "tr", x: W - m - w, y: m, cost: 0.12 },
    { at: "br", x: W - m - w, y: H - m - h, cost: 0.16 },
    { at: "tl", x: m, y: m, cost: 0.3 },
  ];
  const key = `${file}:${w}`;
  const png = () => {
    if (!logoCache.has(key)) logoCache.set(key, sharp(Buffer.from(svg), { density: Math.max(72, Math.ceil((72 * w) / (vb?.[2] || w)) * 2) }).resize({ width: w, height: h, fit: "fill" }).png().toBuffer());
    return logoCache.get(key);
  };
  const out = [];
  for (const s of spots) {
    const r = { x: s.x, y: s.y, w, h };
    if (heads.some((hb) => overlaps(r, hb, 4 * u))) continue;
    if (overlaps(r, label.r, 10 * u)) continue;
    out.push({ ...s, r, cost: s.cost + map.busy(r) * 2.5, get png() { return png(); } });
  }
  return out.sort((a, b) => a.cost - b.cost);
}
