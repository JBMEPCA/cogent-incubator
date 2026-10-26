/**
 * Cogent Multimedia group overview: every title, established and new, in one
 * short advertiser deck with group-wide numbers.
 *
 * JB, 20 Oct 2026: "one beautiful pack for all 10 titles in one, like a cogent
 * multimedia pack. And also include the original titles MEPCA, Bar, Hotel etc.
 * Not too big, just an overview of the titles we have, with some macro numbers."
 *
 * Same type system as the per-title packs (Arial / Cambria / Consolas, A4
 * landscape) so the two sit together, on a neutral ink-and-paper ground that
 * lets each title's own colour carry its tile.
 *
 * NUMBERS: group-stats.json (pull-group-stats.mjs), Mailchimp, live. Rates are
 * pooled over the last 90 days of sends. GuildProp is excluded: it is not a
 * title and has not sent since June.
 *
 * LOGOS: the ten new titles use the brand kit's reversed marks. The established
 * titles use the files on their own websites (group-assets/), never recoloured:
 * MEPCA and Salon publish white versions; Bar, Hotel, Total Grooming and Care
 * Home only publish colour ones, so those sit on light tiles.
 *
 * Run: node scripts/advertiser-pack/build-group-pack.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, "../../../cogent-base-theme/scripts/brand/dist");
const ASSETS = path.join(HERE, "group-assets");
const OUT = path.join(HERE, "packs", process.argv[2] || "Cogent Multimedia Advertiser Overview.pptx");
const G = JSON.parse(fs.readFileSync(path.join(HERE, "group-stats.json"), "utf8")).lists;

const INK = "111418";
const PAPER = "F6F4EF";
const ACCENT = "E0A33A";
const BODY = "2E3338";
const GREY = "6B7177";
const PALE = "E3DFD6";
const SOFT = "A9ADB2";

const SANS = "Arial";
const SERIF = "Cambria";
const MONO = "Consolas";
const W = 11.69, H = 8.27, M = 0.62;

/* ------------------------------------------------------------------ titles */
// list: the Mailchimp audience name. tile: ground for the logo. light: true
// when the logo is a colour file that needs a pale tile.
const ESTABLISHED = [
  { name: "MEPCA", list: "MEPCA", logo: "mepca.png", tile: "1B2330", domain: "mepca-engineering.com",
    readers: "Directors, senior managers and engineers in UK manufacturing and processing.", format: "Monthly · print and digital" },
  { name: "Hotel Magazine", list: "Hotel Magazine", logo: "hotel.png", tile: "FFFFFF", light: true, domain: "thehotelmagazine.co.uk",
    readers: "Owners, managers, purchasers and operators of UK hotels.", format: "Monthly" },
  { name: "Bar Magazine", list: "Bar Magazine", logo: "bar.png", tile: "FFFFFF", light: true, domain: "barmagazine.co.uk",
    readers: "Owners, operators and managers of UK bars, pubs and restaurants.", format: "Monthly · print and digital · since 1999" },
  { name: "Bar Magazine India", list: "BMA India", logo: "bar.png", tag: "INDIA", tile: "FFFFFF", light: true, domain: null,
    readers: "Bar Magazine's edition for the bar and hospitality trade in India.", format: "Monthly · digital" },
  { name: "Care Home Magazine", list: "Care Home Magazine", logo: "carehome.png", tile: "FFFFFF", light: true, domain: "carehomemagazine.co.uk",
    readers: "Owners, operators, managers and senior leaders of UK care homes.", format: "Monthly" },
  { name: "Total Grooming Magazine", list: "Total Grooming Magazine", logo: "tgm.png", tile: "FFFFFF", light: true, domain: "totalgroomingmagazine.co.uk",
    readers: "Dog groomers, grooming salons, tack shops and grooming colleges.", format: "Monthly · print and digital" },
  { name: "The Salon Magazine", list: "Salon Magazine", logo: "salon.png", tile: "2A2220", domain: "thesalonmagazine.co.uk",
    readers: "Owners and managers of hair and beauty salons.", format: "Digital" },
];

const NEW = [
  { name: "Smart SME", list: "Smart SME", slug: "smart-sme", tile: "151B6E", domain: "smartsme.co.uk", readers: "Owners and directors of UK small businesses" },
  { name: "The Fleet Magazine", list: "The Fleet Magazine", slug: "fleet-magazine", tile: "0F2D52", domain: "thefleetmagazine.co.uk", readers: "UK fleet and transport managers" },
  { name: "Airport Business Magazine", list: "Airport Business Magazine", slug: "airport-business-magazine", tile: "123B66", domain: "airportbusinessmagazine.com", readers: "Airport leaders and buyers, worldwide" },
  { name: "Golf Resort Magazine", list: "Golf Resort Magazine", slug: "golf-resort-magazine", tile: "0F3D2B", domain: "golfresortmagazine.com", readers: "Golf resort owners and managers, worldwide" },
  { name: "Barbering Business", list: "Barbering Business", slug: "barbering-business", mark: "wordmark-stacked-reversed", tile: "6E2B2B", domain: "barberingbusiness.com", readers: "UK barbershop owners and barbers" },
  { name: "Dental Business News", list: "Dental Business News", slug: "dental-business-news", tile: "0B5E63", domain: "dentalbusinessnews.com", readers: "UK dental practice owners and managers" },
  { name: "Senior Lifestyle Business", list: "Senior Living Business", slug: "senior-lifestyle-business", tile: "4A1427", domain: "seniorlifestylebusiness.com", readers: "Retirement community operators and investors" },
  { name: "Smart Farming News", list: "Smart Farming News", slug: "smart-farming-news", mark: "wordmark-stacked-reversed", tile: "1E441E", domain: "smartfarmingnews.com", readers: "UK farm owners and their advisers" },
  { name: "Gym Business News", list: "Gym Business News", slug: "gym-business-news", mark: "wordmark-stacked-reversed", tile: "16181B", domain: "gymbusinessnews.com", readers: "Independent gym and studio owners" },
  { name: "Nursery Daily", list: "Nursery Daily", slug: "nursery-daily", tile: "9E1F4D", domain: "nurserydaily.com", readers: "UK nursery owners and managers" },
];
const ALL = [...ESTABLISHED, ...NEW];
for (const t of ALL) {
  t.stats = G[t.list];
  if (!t.stats) throw new Error(`no Mailchimp audience called ${t.list}`);
}

/* ----------------------------------------------------------------- numbers */
const sum = (f) => ALL.reduce((n, t) => n + f(t.stats), 0);
const SUBS = sum((s) => s.subscribers);
const EMAILS = sum((s) => s.emailsYear);
const OPEN = sum((s) => s.opens90) / sum((s) => s.delivered90);
const CLICK = sum((s) => s.clicks90) / sum((s) => s.delivered90);
const n0 = (v) => Math.round(v).toLocaleString("en-GB");
const pct = (v, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const COUNT = ALL.length;
const CountWord = WORDS[COUNT][0].toUpperCase() + WORDS[COUNT].slice(1);

/* ------------------------------------------------------------------- logos */
// Every logo trimmed to its ink, so placement is about the mark, not the
// padding each file happens to carry.
async function logoFor(t) {
  const src = t.slug
    ? await sharp(path.join(BRAND, t.slug, `${t.mark ?? "wordmark-reversed"}.svg`), { density: 900 }).png().toBuffer()
    : fs.readFileSync(path.join(ASSETS, t.logo));
  const buf = await sharp(src).ensureAlpha().trim().resize({ width: 1400, withoutEnlargement: true }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { data: `image/png;base64,${buf.toString("base64")}`, ratio: m.width / m.height };
}
for (const t of ALL) t.img = await logoFor(t);

/* ------------------------------------------------------------------- deck */
const pres = new pptxgen();
pres.defineLayout({ name: "A4L", width: W, height: H });
pres.layout = "A4L";
pres.author = "Cogent Multimedia Ltd";
pres.company = "Cogent Multimedia Ltd";
pres.title = "Cogent Multimedia, advertiser overview";
pres.theme = { headFontFace: SANS, bodyFontFace: SERIF };

const text = (s, t, o) => s.addText(t, { margin: 0, isTextBox: true, valign: "top", ...o });
const eyebrow = (s, t, o = {}) => text(s, t.toUpperCase(), {
  x: M, y: 0.52, w: 6, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true, color: GREY, charSpacing: 2.2, ...o,
});
const headline = (s, t, o = {}) => text(s, t, {
  x: M, y: 0.86, w: 6, h: 1.4, fontFace: SANS, fontSize: 30, bold: true, color: INK, lineSpacingMultiple: 1.06, ...o,
});
const serif = (s, t, o = {}) => text(s, t, {
  fontFace: SERIF, fontSize: 12, color: BODY, lineSpacingMultiple: 1.3, ...o,
});
const rect = (s, x, y, w, h, color, extra = {}) =>
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color, width: 0 }, ...extra });
const hline = (s, x, y, w, color = PALE) =>
  s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width: 0.75 } });

/** A logo centred in a box, as large as fits within the given share of it. */
function placeLogo(s, t, x, y, w, h, fw = 0.72, fh = 0.5) {
  const maxW = w * fw, maxH = h * fh;
  let lw = Math.min(maxW, maxH * t.img.ratio);
  let lh = lw / t.img.ratio;
  const tagH = t.tag ? 0.2 : 0;
  const ly = y + (h - lh - tagH) / 2;
  s.addImage({ data: t.img.data, x: x + (w - lw) / 2, y: ly, w: lw, h: lh });
  if (t.tag) text(s, t.tag, {
    x, y: ly + lh + 0.06, w, h: 0.16, fontFace: MONO, fontSize: 7.5, bold: true,
    color: t.light ? INK : "FFFFFF", charSpacing: 3, align: "center",
  });
}
function tile(s, t, x, y, w, h, fw, fh) {
  rect(s, x, y, w, h, t.tile);
  placeLogo(s, t, x, y, w, h, fw, fh);
}

function footer(s, section, n) {
  hline(s, M, H - 0.72, W - M * 2);
  text(s, `COGENT MULTIMEDIA   ·   ${section.toUpperCase()}`, {
    x: M, y: H - 0.6, w: 6.5, h: 0.24, fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.6,
  });
  text(s, `${n} / 6`, {
    x: W - M - 1.4, y: H - 0.6, w: 1.4, h: 0.24, fontFace: MONO, fontSize: 8.5, bold: true, color: SOFT, charSpacing: 1.6, align: "right",
  });
}
const page = (section, n, bg = "FFFFFF") => {
  const s = pres.addSlide();
  s.background = { color: bg };
  footer(s, section, n);
  return s;
};

/* ============================ 1. Cover ============================ */
{
  const s = pres.addSlide();
  s.background = { color: INK };

  // The mosaic: every title on its own ground, three across.
  const px = 5.9, cols = 3, gap = 0.035;
  const cells = [...ALL];
  const rows = Math.ceil((cells.length + 1) / cols);
  const cw = (W - px - gap * (cols - 1)) / cols;
  const ch = (H - gap * (rows - 1)) / rows;
  cells.forEach((t, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    tile(s, t, px + c * (cw + gap), r * (ch + gap), cw, ch, 0.7, 0.46);
  });
  // The last cell carries the count, so the grid closes on a statement.
  {
    const i = cells.length, c = i % cols, r = Math.floor(i / cols);
    const x = px + c * (cw + gap), y = r * (ch + gap);
    rect(s, x, y, W - x, ch, ACCENT);
    text(s, String(COUNT), { x: x + 0.22, y: y + 0.2, w: cw, h: 0.7, fontFace: SANS, fontSize: 38, bold: true, color: INK });
    text(s, "TITLES", { x: x + 0.24, y: y + 0.92, w: cw, h: 0.2, fontFace: MONO, fontSize: 8.5, bold: true, color: INK, charSpacing: 2.4 });
  }

  text(s, "COGENT MULTIMEDIA", { x: M, y: 0.62, w: 4.8, h: 0.26, fontFace: MONO, fontSize: 11, bold: true, color: "FFFFFF", charSpacing: 3.2 });
  text(s, "ADVERTISER OVERVIEW   ·   2026 / 27", { x: M, y: 0.92, w: 4.8, h: 0.22, fontFace: MONO, fontSize: 8.5, bold: true, color: ACCENT, charSpacing: 2.2 });

  text(s, [
    { text: `${CountWord} titles.\n`, options: { color: "FFFFFF" } },
    { text: "One team.", options: { color: ACCENT } },
  ], { x: M, y: 3.95, w: 5.0, h: 1.9, fontFace: SANS, fontSize: 44, bold: true, lineSpacingMultiple: 1.0 });

  hline(s, M, 6.55, 4.75, "2C3238");
  serif(s, "Specialist business media for the people who run hotels, bars, care homes, salons, factories, fleets, farms and more.", {
    x: M, y: 6.72, w: 4.6, h: 0.8, fontSize: 12.5, color: "D5D8DB",
  });
}

/* ======================= 2. At a glance ========================= */
{
  const s = page("At a glance", 2);
  eyebrow(s, "The group at a glance");
  headline(s, "Specialist audiences,\nat scale.", { w: 5.0 });

  const stats = [
    [n0(SUBS), "newsletter subscribers across the group"],
    [`${(EMAILS / 1e6).toFixed(1)}m`, "emails delivered to them in the last twelve months"],
    [pct(OPEN), "average open rate over the last 90 days"],
    [pct(CLICK), "average click rate over the same sends"],
  ];
  stats.forEach(([fig, desc], i) => {
    const x = M + (i % 2) * 2.55, y = 2.55 + Math.floor(i / 2) * 1.75;
    rect(s, x, y, 0.06, 1.35, ACCENT);
    text(s, fig, { x: x + 0.22, y: y - 0.02, w: 2.3, h: 0.6, fontFace: SANS, fontSize: 28, bold: true, color: INK });
    serif(s, desc, { x: x + 0.22, y: y + 0.6, w: 2.1, h: 0.75, fontSize: 10.5, color: BODY, lineSpacingMultiple: 1.25 });
  });
  serif(s, `${COUNT} titles across ${ESTABLISHED.length} established monthlies and ${NEW.length} launched in 2026. Readers in the UK first, with Golf Resort, Airport Business and Senior Lifestyle Business read worldwide.`, {
    x: M, y: 6.05, w: 4.9, h: 0.9, fontSize: 10.5, color: GREY, lineSpacingMultiple: 1.25,
  });

  // Subscribers by title, each bar in the title's own colour.
  const px = 6.05, pw = W - M - px;
  rect(s, px, 0.52, pw, 6.72, PAPER);
  text(s, "NEWSLETTER SUBSCRIBERS BY TITLE", { x: px + 0.3, y: 0.76, w: pw - 0.6, h: 0.2, fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.8 });
  const sorted = [...ALL].sort((a, b) => b.stats.subscribers - a.stats.subscribers);
  const max = sorted[0].stats.subscribers;
  const labW = 1.95, barX = px + 0.3 + labW, barMax = pw - 0.6 - labW - 0.72;
  const rowH = 0.345;
  sorted.forEach((t, i) => {
    const y = 1.15 + i * rowH;
    text(s, t.name, { x: px + 0.3, y: y + 0.03, w: labW - 0.1, h: 0.22, fontFace: SANS, fontSize: 8.5, bold: true, color: INK });
    const bw = Math.max(0.04, barMax * t.stats.subscribers / max);
    const c = t.light ? (t.list === "Bar Magazine" || t.list === "BMA India" ? "3FA9AD" : t.list === "Total Grooming Magazine" ? "A35A95" : t.list === "Care Home Magazine" ? "2A2A6E" : "8A8D91") : t.tile;
    rect(s, barX, y + 0.05, bw, 0.2, c);
    text(s, n0(t.stats.subscribers), { x: barX + bw + 0.08, y: y + 0.04, w: 0.8, h: 0.22, fontFace: MONO, fontSize: 8, bold: true, color: BODY });
  });
  s.addNotes(`Mailchimp, subscribed members per audience, ${new Date().toISOString().slice(0, 10)}. Rates pooled over all sends in the last 90 days. GuildProp excluded.`);
}

/* ===================== 3. Established titles ===================== */
{
  const s = page("Established titles", 3);
  eyebrow(s, "Established titles");
  headline(s, "The monthlies.", { w: 5, h: 0.7 });
  serif(s, "Long-standing titles with loyal trade readerships, most in print as well as the inbox.", {
    x: M, y: 1.62, w: 5.2, h: 0.5, fontSize: 12.5,
  });

  const tx = M, tw = W - M * 2, y0 = 2.35;
  // Right edges of the three number columns, so the figures line up.
  const C = { logo: tx, read: tx + 2.1, subs: tx + 7.85, open: tx + 9.0, click: tx + tw - 0.18 };
  rect(s, tx, y0, tw, 0.36, INK);
  const head = (t, x, w, align = "left") => text(s, t, { x, y: y0 + 0.1, w, h: 0.18, fontFace: MONO, fontSize: 7.5, bold: true, color: "FFFFFF", charSpacing: 1.6, align });
  head("TITLE", C.logo + 0.15, 1.6);
  head("WHO READS IT", C.read, 3);
  head("SUBSCRIBERS", C.subs - 1.3, 1.3, "right");
  head("OPEN RATE", C.open - 1.1, 1.1, "right");
  head("CLICK RATE", C.click - 1.1, 1.1, "right");
  const rh = 0.64;
  ESTABLISHED.forEach((t, i) => {
    const y = y0 + 0.36 + i * rh;
    const lt = { ...t, tile: t.light ? PAPER : t.tile };
    tile(s, lt, C.logo, y + 0.08, 1.85, rh - 0.16, 0.74, t.tag ? 0.42 : 0.6);
    text(s, [
      { text: t.name, options: { fontFace: SANS, fontSize: 10.5, bold: true, color: INK } },
      { text: `   ${t.format.toUpperCase()}`, options: { fontFace: MONO, fontSize: 6.5, bold: true, color: SOFT, charSpacing: 1 } },
    ], { x: C.read, y: y + 0.1, w: 4.6, h: 0.22 });
    serif(s, t.readers, { x: C.read, y: y + 0.35, w: 4.6, h: 0.22, fontSize: 9, color: GREY, lineSpacingMultiple: 1.0 });
    const num = (v, right, w) => text(s, v, { x: right - w, y: y + 0.2, w, h: 0.26, fontFace: SANS, fontSize: 12.5, bold: true, color: INK, align: "right" });
    num(n0(t.stats.subscribers), C.subs, 1.3);
    num(pct(t.stats.openRate), C.open, 1.1);
    num(pct(t.stats.clickRate), C.click, 1.1);
    hline(s, tx, y + rh, tw);
  });
  text(s, "Rates pooled across every send in the last 90 days.", {
    x: tx, y: y0 + 0.36 + ESTABLISHED.length * rh + 0.12, w: tw, h: 0.2, fontFace: MONO, fontSize: 7.5, color: GREY, charSpacing: 0.6, align: "right",
  });
}

/* ===================== 4. Launched in 2026 ======================= */
{
  const s = page("Launched in 2026", 4);
  eyebrow(s, "Launched in 2026");
  headline(s, "The new titles.", { w: 5, h: 0.7 });
  serif(s, "Ten digital titles built this year, each for the people who own and run one industry. Young lists, opened hard.", {
    x: M, y: 1.62, w: 6.2, h: 0.5, fontSize: 12.5,
  });

  const cols = 5, gx = 0.18, gy = 0.3;
  const cw = (W - M * 2 - gx * (cols - 1)) / cols;
  const th = 1.05, ch = 2.3;
  NEW.forEach((t, i) => {
    const x = M + (i % cols) * (cw + gx);
    const y = 2.4 + Math.floor(i / cols) * (ch + gy);
    tile(s, t, x, y, cw, th, 0.74, 0.56);
    serif(s, t.readers, { x, y: y + th + 0.12, w: cw, h: 0.42, fontSize: 9.5, color: BODY, lineSpacingMultiple: 1.15 });
    hline(s, x, y + th + 0.62, cw);
    text(s, n0(t.stats.subscribers), { x, y: y + th + 0.72, w: cw / 2, h: 0.3, fontFace: SANS, fontSize: 14, bold: true, color: INK });
    text(s, pct(t.stats.openRate), { x: x + cw / 2, y: y + th + 0.72, w: cw / 2, h: 0.3, fontFace: SANS, fontSize: 14, bold: true, color: INK, align: "right" });
    text(s, "SUBSCRIBERS", { x, y: y + th + 1.02, w: cw / 2, h: 0.16, fontFace: MONO, fontSize: 6.5, bold: true, color: GREY, charSpacing: 1.2 });
    text(s, "OPEN RATE", { x: x + cw / 2, y: y + th + 1.02, w: cw / 2, h: 0.16, fontFace: MONO, fontSize: 6.5, bold: true, color: GREY, charSpacing: 1.2, align: "right" });
  });
}

/* ======================== 5. How to buy ========================== */
{
  const s = page("How to buy", 5);
  eyebrow(s, "How to buy");
  headline(s, "One booking.\nAny mix of titles.", { w: 4.6 });
  serif(s, "Every title sells the same four formats, so a campaign can run on one magazine or across every audience that buys what you sell. Multi-title campaigns are priced as one package.", {
    x: M, y: 2.35, w: 4.3, h: 1.5, fontSize: 12,
  });

  const formats = [
    ["Website banners", "Billboard, leaderboard and MPU across the site."],
    ["Solus email", "Your own message to the list, nobody else in it."],
    ["Newsletter sponsorship", "Named sponsor of the weekly briefing."],
    ["Sponsored content", "Your story on the site and in the newsletter."],
  ];
  text(s, "THE FORMATS", { x: M, y: 4.1, w: 4, h: 0.2, fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.8 });
  formats.forEach(([a, b], i) => {
    const y = 4.45 + i * 0.6;
    rect(s, M + 0.02, y + 0.07, 0.1, 0.1, ACCENT);
    text(s, a, { x: M + 0.3, y, w: 4, h: 0.22, fontFace: SANS, fontSize: 11, bold: true, color: INK });
    serif(s, b, { x: M + 0.3, y: y + 0.23, w: 4, h: 0.24, fontSize: 9.5, color: GREY });
  });

  const groups = [
    ["Hospitality and leisure", ["Hotel Magazine", "Bar Magazine", "Bar Magazine India", "Golf Resort Magazine", "Gym Business News"]],
    ["Care, health and education", ["Care Home Magazine", "Senior Lifestyle Business", "Dental Business News", "Nursery Daily"]],
    ["Hair, beauty and grooming", ["The Salon Magazine", "Barbering Business", "Total Grooming Magazine"]],
    ["Industry and business", ["MEPCA", "Smart SME", "The Fleet Magazine", "Airport Business Magazine", "Smart Farming News"]],
  ];
  const px = 5.55, pw = W - M - px;
  text(s, "BUY BY AUDIENCE", { x: px, y: 0.56, w: pw, h: 0.2, fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.8 });
  let y = 0.92;
  for (const [label, names] of groups) {
    const ts = names.map((n) => ALL.find((t) => t.name === n));
    const reach = ts.reduce((n, t) => n + t.stats.subscribers, 0);
    const bh = 1.5;
    rect(s, px, y, pw, bh, PAPER);
    rect(s, px, y, 0.06, bh, ACCENT);
    text(s, label, { x: px + 0.28, y: y + 0.18, w: 3.6, h: 0.26, fontFace: SANS, fontSize: 13, bold: true, color: INK });
    text(s, n0(reach), { x: px + pw - 2.0, y: y + 0.14, w: 1.75, h: 0.32, fontFace: SANS, fontSize: 16, bold: true, color: INK, align: "right" });
    text(s, "SUBSCRIBERS COMBINED", { x: px + pw - 2.6, y: y + 0.48, w: 2.35, h: 0.16, fontFace: MONO, fontSize: 6.5, bold: true, color: GREY, charSpacing: 1.2, align: "right" });
    // Small logo chips, so the group reads as titles rather than a list of names.
    const chW = (pw - 0.56 - 0.1 * 4) / 5, chH = 0.5;
    ts.forEach((t, i) => {
      const cx = px + 0.28 + i * (chW + 0.1);
      tile(s, { ...t, tile: t.light ? "FFFFFF" : t.tile }, cx, y + 0.82, chW, chH, 0.78, t.tag ? 0.4 : 0.58);
    });
    y += bh + 0.15;
  }
}

/* ========================= 6. Get in touch ======================= */
{
  const s = pres.addSlide();
  s.background = { color: INK };
  text(s, "COGENT MULTIMEDIA", { x: M, y: 0.62, w: 4.8, h: 0.26, fontFace: MONO, fontSize: 11, bold: true, color: "FFFFFF", charSpacing: 3.2 });

  text(s, "ADVERTISE WITH US", { x: M, y: 2.5, w: 5, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true, color: ACCENT, charSpacing: 2.4 });
  text(s, "Get in touch.", { x: M, y: 2.84, w: 5.5, h: 0.8, fontFace: SANS, fontSize: 40, bold: true, color: "FFFFFF" });
  serif(s, "Tell us who you want to reach and what you want them to do. We will come back with the titles that fit, availability and one price.", {
    x: M, y: 3.82, w: 4.5, h: 0.95, fontSize: 13, color: "D5D8DB",
  });
  text(s, "ADVERTISING", { x: M, y: 5.05, w: 2, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: SOFT, charSpacing: 1.8 });
  text(s, "jb@cimltd.co.uk", { x: M + 2.0, y: 5.0, w: 3.5, h: 0.3, fontFace: SANS, fontSize: 14, bold: true, color: "FFFFFF", hyperlink: { url: "mailto:jb@cimltd.co.uk" } });
  hline(s, M, 7.08, 4.9, "2C3238");
  text(s, "COGENT MULTIMEDIA LTD, 5 JUBILEE WAY, FAVERSHAM, KENT", {
    x: M, y: 7.26, w: 5.2, h: 0.22, fontFace: MONO, fontSize: 7.5, bold: true, color: SOFT, charSpacing: 1.1,
  });

  // Every title and where to find it.
  const px = 6.2, pw = W - px;
  rect(s, px, 0, pw, H, "1A1E23");
  text(s, "OUR TITLES", { x: px + 0.45, y: 0.62, w: 3, h: 0.22, fontFace: MONO, fontSize: 8.5, bold: true, color: ACCENT, charSpacing: 2.2 });
  ALL.forEach((t, i) => {
    const y = 1.05 + i * 0.385;
    text(s, t.name, { x: px + 0.45, y, w: 2.4, h: 0.22, fontFace: SANS, fontSize: 9.5, bold: true, color: "FFFFFF" });
    text(s, t.domain ?? "Digital edition", { x: px + 2.85, y: y + 0.02, w: pw - 3.3, h: 0.2, fontFace: MONO, fontSize: 8, color: SOFT, align: "right" });
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await pres.writeFile({ fileName: OUT });
console.log(`written: ${OUT}\n${COUNT} titles · ${n0(SUBS)} subscribers · ${(EMAILS / 1e6).toFixed(1)}m emails · open ${pct(OPEN)} · click ${pct(CLICK)}`);
