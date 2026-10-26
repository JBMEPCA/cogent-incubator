/**
 * The "Who reads <title>" page, modelled on MEPCA 2026 In Numbers pages 2 and
 * 4 but folded onto one A4 page: seniority, most common roles, a world map
 * shaded by where readers are, and three panels each sector's buyer asks
 * about.
 *
 * Built with pptxgenjs as a one-slide deck, then spliced into the title pack
 * by build-advertiser-packs.mjs, so every shape stays editable in PowerPoint.
 * Every figure is a percentage. A null is printed as XX.
 */
import pptxgen from "pptxgenjs";
import sharp from "sharp";
import JSZip from "jszip";

const W = 11.69, H = 8.27, M = 0.62;
const SANS = "Arial", SERIF = "Cambria", MONO = "Consolas";
const BODY = "2B3437", GREY = "6B7A7D";

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const tint = (h, t) => toHex(hex(h).map((v) => v + (255 - v) * t));
const pct = (v) => (v == null ? "XX%" : `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`);

/** The world map as a PNG, each reader country in its region's shade. */
async function mapPng(world, profile, shades, base) {
  const regionShade = Object.fromEntries(profile.regions.map((r, i) => [r.label, shades[i]]));
  const rest = shades[profile.regions.length - 1];
  const top = profile.regions[0];
  const zoom = top.label === "UK and Ireland" && top.pct >= 0.75;
  const { regionOf } = await import("./audience-profile.mjs");
  const paths = world.countries.map((c) => {
    let fill = base;
    if (profile.countries[c.name]) fill = "#" + (regionShade[regionOf(c.name, c.lon, c.lat)] ?? rest);
    return `<path d="${c.d}" fill="${fill.startsWith("#") ? fill : "#" + fill}" stroke="#FFFFFF" stroke-width="${zoom ? 0.15 : 0.4}"/>`;
  }).join("");
  // A title read mostly in the UK zooms in on the UK and Europe. On the whole
  // world a 6% North American slice covers more of the page than a 90% UK one.
  const vb = zoom ? "420 70 200 104" : `0 0 ${world.w} ${world.h}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${world.w * 2}" height="${world.h * 2}">${paths}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * @returns {{ slideXml: string, relsXml: string, media: Record<string, Buffer> }}
 */
export async function buildProfileSlide({ name, pal, profile, world, callout, pageNo, pages }) {
  const { G, A, INK } = pal;
  const MUTED = tint(G, 0.22), WASH = tint(G, 0.94), PALE = tint(G, 0.84);
  const shades = [G, tint(G, 0.3), tint(G, 0.5), tint(G, 0.66), tint(G, 0.8)];

  const pres = new pptxgen();
  pres.defineLayout({ name: "A4L", width: W, height: H });
  pres.layout = "A4L";
  const s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  const text = (t, o) => s.addText(t, { margin: 0, isTextBox: true, valign: "top", ...o });
  const rect = (x, y, w, h, color) => s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color, width: 0 } });
  const line = (x, y, w, color, width = 0.75) => s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width } });
  const eyebrow = (t, x, y, w) => text(t.toUpperCase(), { x, y, w, h: 0.2, fontFace: MONO, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 2 });
  const bar = (x, y, w, h, v, max) => {
    rect(x, y, w, h, WASH);
    if (v != null && v > 0) rect(x, y, Math.max(0.03, (w * v) / max), h, G);
  };

  // ---- header
  // Eyebrow and headline copy the template's exactly (9.5pt eyebrow, centred in
  // a 0.24in box at 0.52in; 30pt headline at 0.86in), so the titles sit in
  // the same place as on every other page.
  s.addText(profile.projected ? "WHO READS   ·   PROJECTED AT SCALE" : "WHO READS", {
    x: M, y: 0.52, w: 6.5, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true, color: MUTED, charSpacing: 2.2, margin: 0, isTextBox: true,
  });
  text([
    { text: "Who reads ", options: { color: INK } },
    { text: name, options: { color: G } },
  ], { x: M, y: 0.86, w: W - 2 * M, h: 0.6, fontFace: SANS, fontSize: 30, bold: true, lineSpacingMultiple: 1.06 });
  text([
    { text: `${callout.figure} ${callout.lead} `, options: { fontFace: SANS, bold: true, color: INK } },
    { text: callout.rest, options: { fontFace: SERIF, color: GREY } },
  ], { x: M, y: 1.5, w: W - 2 * M, h: 0.3, fontSize: 11.5 });

  // ---- seniority
  const tw = (5.1 - 0.3) / 4;
  profile.tiers.forEach((t, i) => {
    const x = M + i * (tw + 0.1), y = 1.95;
    rect(x, y, tw, 0.88, WASH);
    text(pct(t.pct), { x: x + 0.14, y: y + 0.1, w: tw - 0.2, h: 0.36, fontFace: SANS, fontSize: 19, bold: true, color: t.pct == null ? A : G });
    text(t.label, { x: x + 0.14, y: y + 0.48, w: tw - 0.22, h: 0.34, fontFace: SANS, fontSize: 7.5, color: BODY, lineSpacingMultiple: 1.0 });
  });

  // ---- roles
  eyebrow("Most common roles", M, 3.05, 5);
  const maxRole = Math.max(0.0001, ...profile.roles.map((r) => r.pct ?? 0));
  profile.roles.forEach((r, i) => {
    const y = 3.35 + i * 0.33;
    text(r.label, { x: M, y: y - 0.02, w: 2.3, h: 0.22, fontFace: SANS, fontSize: 9, color: INK });
    bar(M + 2.35, y, 2.0, 0.16, r.pct, maxRole);
    text(pct(r.pct), { x: M + 4.4, y: y - 0.02, w: 0.7, h: 0.22, fontFace: SANS, fontSize: 9, bold: true, color: r.pct == null ? A : INK, align: "right" });
  });

  // ---- map and regions
  const mx = 6.05, mw = W - M - mx;
  eyebrow("Where they are", mx, 1.95, 3);
  // Capped so a two-line region label still clears the panels below.
  const mh = Math.min(mw * (world.h / world.w), 2.42);
  const imw = mh * (world.w / world.h);
  const map = await mapPng(world, profile, shades, "#" + tint(G, 0.9));
  s.addImage({ data: `image/png;base64,${map.toString("base64")}`, x: mx + (mw - imw) / 2, y: 2.22, w: imw, h: mh });
  const rw = mw / profile.regions.length;
  profile.regions.forEach((r, i) => {
    const x = mx + i * rw, y = 2.22 + mh + 0.12;
    rect(x, y, rw - 0.1, 0.05, shades[i]);
    text(pct(r.pct), { x, y: y + 0.1, w: rw - 0.1, h: 0.3, fontFace: SANS, fontSize: 14, bold: true, color: INK });
    text(r.label, { x, y: y + 0.42, w: rw - 0.1, h: 0.3, fontFace: SANS, fontSize: 7.5, color: GREY });
  });

  // ---- the three sector panels
  const py = 5.55, pw = (W - 2 * M - 0.3) / 3;
  profile.panels.forEach((p, i) => {
    const x = M + i * (pw + 0.15);
    line(x, py, pw, G, 2);
    eyebrow(p.title, x, py + 0.14, pw);
    const max = Math.max(0.0001, ...p.rows.map((r) => r.pct ?? 0));
    p.rows.forEach((r, j) => {
      const y = py + 0.46 + j * 0.27;
      text(r.label, { x, y: y - 0.02, w: 1.75, h: 0.2, fontFace: SANS, fontSize: 8.5, color: INK });
      bar(x + 1.8, y, pw - 2.4, 0.14, r.pct, max);
      text(pct(r.pct), { x: x + pw - 0.55, y: y - 0.02, w: 0.55, h: 0.2, fontFace: SANS, fontSize: 8.5, bold: true, color: r.pct == null ? A : INK, align: "right" });
    });
  });

  // ---- footer, matching the template's
  line(M, H - 0.72, W - 2 * M, PALE);
  text(`${name.toUpperCase()}   ·   WHO READS`, { x: M, y: H - 0.6, w: 6.5, h: 0.24, fontFace: MONO, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1.6 });
  text(`${pageNo} / ${pages}`, { x: W - M - 1.4, y: H - 0.6, w: 1.4, h: 0.24, fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.6, align: "right" });
  s.addNotes(profile.notes ?? "");

  const zip = await JSZip.loadAsync(await pres.write({ outputType: "nodebuffer" }));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  const relsXml = await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string");
  const media = {};
  for (const f of Object.keys(zip.files)) if (f.startsWith("ppt/media/") && !zip.files[f].dir) media[f.slice(10)] = await zip.file(f).async("nodebuffer");
  const notesXml = await zip.file("ppt/notesSlides/notesSlide1.xml")?.async("string");
  return { slideXml, relsXml, media, notesXml };
}
