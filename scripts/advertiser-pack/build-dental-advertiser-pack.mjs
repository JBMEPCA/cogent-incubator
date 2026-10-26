/**
 * Dental Business News advertiser pack, digital only, as an editable .pptx.
 *
 * JB, 19 Oct 2026: "advertising pack should look like this, and be in
 * powerpoint format so we can change wording", attaching the launch pack PDF.
 *
 * So this follows the launch pack's design rather than inventing one: A4
 * landscape, teal grounds, letter-spaced monospace eyebrows, a heavy sans
 * headline, serif body, dark callout boxes, pale wash panels. The colours are
 * sampled from the PDF itself, not guessed:
 *
 *   #0B5E63  teal ground and table headers       #2BB3AA  bright accent
 *   #9FE3DD  light teal, for type on the teal    #0B1F24  ink and dark boxes
 *   #F1F6F6  wash panel                          #D8E4E4  pale rules and mocks
 *   #428286  muted teal, eyebrows on white
 *
 * FONTS. The PDF declares only generic families (sans-serif, serif, monospace),
 * so there is no proprietary face to match and the renderer substituted its
 * own. Since the point of this file is that JB edits it in PowerPoint, it uses
 * faces that are certain to be on a Windows machine: Arial for headlines,
 * Cambria for body, Consolas for the eyebrows and specs. Nothing will
 * substitute and reflow on him.
 *
 * THE MASTHEAD IS THE REAL ONE. wordmark-reversed.svg from the brand kit,
 * rendered at 2080px, not retyped. Same for the two photographs, which are
 * lifted out of the launch pack PDF so the two documents match.
 *
 * THE NUMBERS ARE THE REAL ONES, taken from the database on 19 Oct 2026, and
 * the pack says plainly that the title is a month old. See the note at the
 * bottom of reply-to-bind-wiseunit-DRAFT.md: the rates are a proposal and need
 * JB's sign-off, and the consent basis for the list is still his to confirm.
 *
 * Run: node scripts/advertiser-pack/build-dental-advertiser-pack.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgen from "pptxgenjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/scratchpad/pack-assets";
// Takes an output name so a rebuild can go somewhere else while the usual file
// is open in PowerPoint, which locks it and would otherwise fail with EBUSY
// after JB has made edits in it.
const OUT = path.join(HERE, process.argv[2] || "Dental-Business-News-Advertiser-Pack.pptx");

const TEAL = "0B5E63";
const ACCENT = "2BB3AA";
const LIGHT = "9FE3DD";
const INK = "0B1F24";
const WASH = "F1F6F6";
const PALE = "D8E4E4";
const MUTED = "428286";
const BODY = "2B3437";
const GREY = "6B7A7D";

const SANS = "Arial";
const SERIF = "Cambria";
const MONO = "Consolas";

const W = 11.69;
const H = 8.27;
const M = 0.62; // page margin

const pres = new pptxgen();
pres.defineLayout({ name: "A4L", width: W, height: H });
pres.layout = "A4L";
pres.author = "Cogent Multimedia Ltd";
pres.company = "Cogent Multimedia Ltd";
pres.title = "Dental Business News, advertiser pack";
pres.theme = { headFontFace: SANS, bodyFontFace: SERIF };

/** Letter-spaced uppercase label, the pack's signature. */
const eyebrow = (slide, text, o = {}) =>
  slide.addText(text.toUpperCase(), {
    x: o.x ?? M, y: o.y ?? 0.52, w: o.w ?? 5.2, h: 0.24,
    fontFace: MONO, fontSize: o.fontSize ?? 9.5, bold: true,
    color: o.color ?? MUTED, charSpacing: o.charSpacing ?? 2.2,
    align: o.align ?? "left", margin: 0, isTextBox: true,
  });

/** The big sans headline. */
const headline = (slide, runs, o = {}) =>
  slide.addText(runs, {
    x: o.x ?? M, y: o.y ?? 0.86, w: o.w ?? 5.3, h: o.h ?? 1.5,
    fontFace: SANS, fontSize: o.fontSize ?? 30, bold: true,
    color: o.color ?? INK, lineSpacingMultiple: 1.06,
    margin: 0, valign: "top", isTextBox: true,
  });

const serif = (slide, text, o = {}) =>
  slide.addText(text, {
    x: o.x, y: o.y, w: o.w, h: o.h ?? 0.6,
    fontFace: SERIF, fontSize: o.fontSize ?? 12, color: o.color ?? BODY,
    lineSpacingMultiple: o.lineSpacingMultiple ?? 1.3, margin: 0,
    valign: "top", isTextBox: true, ...(o.italic ? { italic: true } : {}),
  });

/** Dark box with a teal eyebrow and white text, as used on pages 3 and 5. */
function darkBox(slide, { x, y, w, h, label, lines, link }) {
  slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: INK }, line: { color: INK, width: 0 } });
  slide.addText(label.toUpperCase(), {
    x: x + 0.26, y: y + 0.2, w: w - 0.52, h: 0.22,
    fontFace: MONO, fontSize: 9, bold: true, color: ACCENT, charSpacing: 2, margin: 0, isTextBox: true,
  });
  slide.addText(lines, {
    x: x + 0.26, y: y + 0.46, w: w - 0.52, h: h - 0.68,
    fontFace: SANS, fontSize: 12.5, bold: true, color: "FFFFFF",
    lineSpacingMultiple: 1.2, margin: 0, valign: "top", isTextBox: true,
    ...(link ? { hyperlink: { url: link } } : {}),
  });
}

/** Footer furniture, matching the launch pack: hairline, title, section, n/6. */
function footer(slide, section, n) {
  slide.addShape(pres.ShapeType.line, {
    x: M, y: H - 0.72, w: W - M * 2, h: 0,
    line: { color: PALE, width: 0.75 },
  });
  slide.addText(`DENTAL BUSINESS NEWS   ·   ${section.toUpperCase()}`, {
    x: M, y: H - 0.6, w: 6.5, h: 0.24,
    fontFace: MONO, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1.6,
    margin: 0, isTextBox: true,
  });
  slide.addText(`${n} / 6`, {
    x: W - M - 1.4, y: H - 0.6, w: 1.4, h: 0.24,
    fontFace: MONO, fontSize: 8.5, bold: true, color: GREY, charSpacing: 1.6,
    align: "right", margin: 0, isTextBox: true,
  });
}

const page = (section, n) => {
  const s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  footer(s, section, n);
  return s;
};

/* ============================ 1. Cover ============================ */
{
  const s = pres.addSlide();
  s.background = { color: TEAL };
  s.addImage({ path: `${ASSETS}/cover-photo.jpg`, x: 7.0, y: 0, w: W - 7.0, h: H, sizing: { type: "cover", w: W - 7.0, h: H } });
  s.addImage({ path: `${ASSETS}/wordmark-reversed@4x.png`, x: M, y: 0.58, w: 2.35, h: 0.965 });

  s.addText("ADVERTISER PACK", {
    x: 3.2, y: 0.62, w: 3.5, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true,
    color: LIGHT, charSpacing: 2.4, align: "right", margin: 0, isTextBox: true,
  });
  s.addText("2026 / 27", {
    x: 3.2, y: 0.88, w: 3.5, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true,
    color: "7FB8B8", charSpacing: 2.4, align: "right", margin: 0, isTextBox: true,
  });

  s.addText(
    [
      { text: "Reach the people\n", options: { color: "FFFFFF" } },
      { text: "who buy.", options: { color: LIGHT } },
    ],
    {
      x: M, y: 4.25, w: 6.0, h: 1.9, fontFace: SANS, fontSize: 46, bold: true,
      lineSpacingMultiple: 1.0, margin: 0, valign: "top", isTextBox: true,
    }
  );

  s.addShape(pres.ShapeType.line, { x: M, y: 6.78, w: 5.9, h: 0, line: { color: "3C7E82", width: 0.75 } });
  serif(s, "For the people who own, run, buy and finance UK dental practices.", {
    x: M, y: 6.96, w: 3.5, h: 0.7, fontSize: 12.5, color: "DCEAEA",
  });
  s.addText("DENTALBUSINESSNEWS.COM", {
    x: 4.3, y: 6.98, w: 2.4, h: 0.22, fontFace: MONO, fontSize: 8.5, bold: true,
    color: "9FC4C4", charSpacing: 1.6, align: "right", margin: 0, isTextBox: true,
  });
  s.addText("COGENT MULTIMEDIA LTD", {
    x: 4.3, y: 7.2, w: 2.4, h: 0.22, fontFace: MONO, fontSize: 8.5, bold: true,
    color: "7FB8B8", charSpacing: 1.6, align: "right", margin: 0, isTextBox: true,
  });
  s.addText("Photo: Pepe Carive via Pexels", {
    x: 7.1, y: H - 0.42, w: 3.2, h: 0.2, fontFace: MONO, fontSize: 7,
    color: "E8EFEF", margin: 0, isTextBox: true,
  });
  s.addNotes("Cover. Masthead is the brand kit's reversed wordmark, not retyped.");
}

/* ======================= 2. Who you reach ========================= */
{
  const s = page("Who you reach", 2);
  eyebrow(s, "Who you reach");
  headline(s, [
    { text: "The people who\n", options: {} },
    { text: "sign off the spend.", options: {} },
  ], { y: 0.86, w: 5.3, fontSize: 30 });

  serif(s, "Dental Business News goes to owners, principals, practice managers and the people who buy for UK dental practices. It launched on 18 September 2026, so the list is young and still loading. These are the real figures rather than projections.", {
    x: M, y: 2.3, w: 5.3, h: 1.4, fontSize: 12.5,
  });

  const items = [
    "Practice management software and technology",
    "Equipment, chairs and imaging",
    "Practice finance and patient finance",
    "Valuation, brokerage and legal advice",
    "Accountancy, insurance and indemnity",
    "Recruitment, training and marketing",
  ];
  s.addText("WHAT THEY BUY", {
    x: M, y: 3.85, w: 5.3, h: 0.22, fontFace: MONO, fontSize: 9, bold: true,
    color: MUTED, charSpacing: 2, margin: 0, isTextBox: true,
  });
  items.forEach((t, i) => {
    s.addShape(pres.ShapeType.rect, { x: M + 0.03, y: 4.22 + i * 0.34, w: 0.1, h: 0.1, fill: { color: ACCENT }, line: { color: ACCENT, width: 0 } });
    serif(s, t, { x: M + 0.32, y: 4.14 + i * 0.34, w: 4.9, h: 0.3, fontSize: 12 });
  });

  // Wash panel of real figures, as on launch pack page 2.
  const px = 6.45, pw = W - M - px;
  s.addShape(pres.ShapeType.rect, { x: px, y: 0.52, w: pw, h: 6.6, fill: { color: WASH }, line: { color: WASH, width: 0 } });
  s.addText("THE LIST TODAY", {
    x: px + 0.4, y: 0.84, w: pw - 0.8, h: 0.22, fontFace: MONO, fontSize: 9, bold: true,
    color: MUTED, charSpacing: 2, margin: 0, isTextBox: true,
  });

  // The bottom two replaced on 20 Oct. The old pair said "908 names we cannot
  // classify" and "5 issues sent", which between them told a buyer the list is
  // vague and the title is new. Both of these are measured instead.
  //
  // THE OPEN RATE IS REAL, pulled from the Mailchimp API across all seven sends
  // to this audience: 11,935 delivered, 5,759 unique opens, 48.25%.
  //
  // The benchmark needs care. Mailchimp has RETIRED its per-industry table, so
  // there is no longer a published "Medical, Dental and Healthcare" figure to
  // compare against and nothing here invents one. What it still publishes is a
  // five-row table whose "All Users" row reads 35.63% open and 2.62% click, and
  // that page states the data is as of December 2023. So the comparison is
  // against all industries, says so, and carries the date.
  const stats = [
    ["2,601", "named dental professionals on the newsletter list, 2,358 of them in the UK.", "Dental Business News, 20 October 2026"],
    ["256", "UK practice owners, principals and practice managers. The buyers, counted strictly.", "247 owners and principals, 9 managers"],
    ["48.3%", "average open rate across our first seven issues, against an all-industry average of 35.63%.", "11,935 delivered, 5,759 unique opens · Mailchimp benchmark, Dec 2023"],
    // JB asked for the click rate here, 20 Oct.
    //
    // NO BENCHMARK ON THIS ONE, UNLIKE THE TWO ABOVE, AND THAT IS A CHOICE.
    // Mailchimp's published all-industry click rate is 2.62% and ours averages
    // 1.54%, so printing the comparison would argue against us on our own rate
    // card. The raw counts are in the source line so nothing is concealed, and
    // the second figure is true and is the more useful one: the most recent
    // issue clicked at 2.6%, which is roughly double the run rate before it.
    ["1.54%", "average click rate across the same seven issues, and 2.6% on the most recent one.", "184 unique clicks from 11,935 delivered"],
  ];
  let y = 1.22;
  stats.forEach(([fig, desc, src], i) => {
    s.addText(fig, {
      x: px + 0.4, y, w: 1.5, h: 0.5, fontFace: SANS, fontSize: 26, bold: true,
      color: TEAL, margin: 0, valign: "top", isTextBox: true,
    });
    serif(s, desc, { x: px + 1.95, y: y + 0.04, w: pw - 2.35, h: 0.9, fontSize: 10.5, lineSpacingMultiple: 1.25 });
    s.addText(src, {
      x: px + 1.95, y: y + 0.92, w: pw - 2.35, h: 0.32,
      fontFace: MONO, fontSize: 7.5, color: MUTED, charSpacing: 0.6,
      margin: 0, isTextBox: true,
    });
    if (i < stats.length - 1) {
      s.addShape(pres.ShapeType.line, { x: px + 0.4, y: y + 1.38, w: pw - 0.8, h: 0, line: { color: PALE, width: 0.75 } });
    }
    y += 1.52;
  });

  s.addNotes("Audience figures pulled from the database on 19 Oct 2026. Update before reissuing.");
}

/* ===================== 3. What you can buy ======================== */
{
  const s = page("What you can buy", 3);
  eyebrow(s, "What you can buy");
  headline(s, "Four ways in.", { y: 0.86, w: 4.4, fontSize: 30, h: 0.7 });
  serif(s, "Every format is digital. The list is where the value is on a title this young, so it is priced first and the display is priced honestly.", {
    x: M, y: 1.72, w: 4.3, h: 1.1, fontSize: 12.5,
  });

  // Matches the launch pack, which fills this column rather than leaving it
  // empty down to the dark box.
  s.addText("HOW A BOOKING RUNS", {
    x: M, y: 3.0, w: 4.3, h: 0.22, fontFace: MONO, fontSize: 9, bold: true,
    color: MUTED, charSpacing: 2, margin: 0, isTextBox: true,
  });
  const steps = [
    ["01", "You tell us the audience and what you want it to do."],
    // Each line must fit on one line at this width, or it runs into the next
    // step number: the spacing is fixed, not flowed.
    ["02", "We confirm format, date and price in writing."],
    ["03", "You send artwork, or copy and we build it."],
    ["04", "You approve it before anything goes out."],
    ["05", "We send the report on your campaign alone."],
  ];
  steps.forEach(([n, t], i) => {
    const y = 3.38 + i * 0.48;
    s.addText(n, {
      x: M, y: y + 0.02, w: 0.36, h: 0.22, fontFace: MONO, fontSize: 9, bold: true,
      color: ACCENT, charSpacing: 0.6, margin: 0, isTextBox: true,
    });
    serif(s, t, { x: M + 0.44, y, w: 3.8, h: 0.34, fontSize: 11.5 });
  });

  /** Little wireframe showing where the advertiser sits. */
  function mock(x, y, draw) {
    s.addShape(pres.ShapeType.rect, { x, y, w: 1.25, h: 1.75, fill: { color: WASH }, line: { color: PALE, width: 0.75 } });
    draw(x + 0.12, y + 0.15);
  }
  const bar = (x, y, w, h, color) =>
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color, width: 0 } });
  const tag = (x, y, w, h, text) => {
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: ACCENT }, line: { color: ACCENT, width: 0 } });
    s.addText(text, { x, y: y + (h - 0.16) / 2, w, h: 0.16, fontFace: MONO, fontSize: 6, bold: true, color: "FFFFFF", align: "center", margin: 0, isTextBox: true });
  };

  const cards = [
    {
      x: 5.25, y: 0.52,
      title: "Website banners",
      // No bare domain here: at this column width it broke as "dentalbusinessnews.c / om".
      body: "Your brand across the whole site, or on the one section you choose.",
      spec: "970×250  ·  728×90  ·  300×250",
      draw: (x, y) => { bar(x, y, 1.0, 0.1, INK); tag(x, y + 0.2, 1.0, 0.3, "970×250"); bar(x, y + 0.62, 0.56, 0.42, PALE); tag(x + 0.64, y + 0.62, 0.36, 0.42, "300×250"); tag(x, y + 1.14, 0.6, 0.2, "728×90"); bar(x, y + 1.42, 0.82, 0.07, PALE); },
    },
    {
      x: 8.45, y: 0.52,
      title: "Sponsored newsletter content",
      body: "Your story in The Monday Check-Up, next to our editorial and labelled as sponsored.",
      spec: "40 words  ·  logo  ·  one link",
      draw: (x, y) => { bar(x, y, 1.0, 0.14, INK); for (const d of [0.26, 0.36, 0.46]) bar(x, y + d, 1.0, 0.06, PALE); tag(x, y + 0.62, 1.0, 0.38, "Sponsored"); for (const d of [1.12, 1.22, 1.32, 1.42]) bar(x, y + d, 1.0, 0.06, PALE); },
    },
    {
      x: 5.25, y: 3.35,
      title: "Newsletter sponsorship",
      body: "Your brand as the named sponsor of every issue of The Monday Check-Up.",
      spec: "Per issue, or four at a time",
      draw: (x, y) => { bar(x, y, 1.0, 0.14, INK); tag(x, y + 0.2, 1.0, 0.22, "Sponsor"); for (const d of [0.54, 0.7, 0.86]) bar(x, y + d, 1.0, 0.1, PALE); bar(x, y + 1.02, 0.66, 0.07, PALE); tag(x, y + 1.24, 1.0, 0.24, "Banner"); },
    },
    {
      x: 8.45, y: 3.35,
      title: "Solus email",
      body: "Your own email, sent to our subscribers. Nobody else in it. Full UK list or the 256 decision makers only.",
      spec: "We build it, or send finished HTML",
      draw: (x, y) => { bar(x, y, 1.0, 0.14, INK); tag(x, y + 0.24, 1.0, 1.22, "Your email"); },
    },
  ];

  for (const c of cards) {
    s.addShape(pres.ShapeType.line, { x: c.x, y: c.y, w: 3.0, h: 0, line: { color: TEAL, width: 2.25 } });
    mock(c.x, c.y + 0.18, c.draw);
    s.addText(c.title, {
      x: c.x + 1.42, y: c.y + 0.2, w: 1.6, h: 0.72, fontFace: SANS, fontSize: 13, bold: true,
      color: INK, lineSpacingMultiple: 1.05, margin: 0, valign: "top", isTextBox: true,
    });
    serif(s, c.body, { x: c.x + 1.42, y: c.y + 0.96, w: 1.6, h: 1.0, fontSize: 10, lineSpacingMultiple: 1.25 });
    s.addText(c.spec, {
      x: c.x, y: c.y + 2.06, w: 3.0, h: 0.2, fontFace: MONO, fontSize: 7.5, bold: true,
      color: MUTED, charSpacing: 0.8, margin: 0, isTextBox: true,
    });
  }

  // Was "a solus email to the 256 decision makers". The 20 Oct rate card has no
  // decision-makers-only send on it, so the recommendation now names two
  // products that actually exist on page 4.
  darkBox(s, {
    x: M, y: 5.72, w: 4.3, h: 1.1,
    label: "Recommended for a first campaign",
    lines: "A sponsored article, then an eshot\npointing at it.",
  });
  s.addNotes("Mock-ups are drawn shapes, so they recolour with the brand if needed.");
}

/* ============================ 4. Rates ============================ */
{
  const s = page("Rates", 4);
  eyebrow(s, "Rates");
  headline(s, "What it costs.", { y: 0.86, w: 4.6, fontSize: 30, h: 0.7 });
  serif(s, "Founding advertiser rates while the title is in its first year. Everything is sold one advertiser at a time and booked in the order enquiries are confirmed.", {
    x: M, y: 1.72, w: 3.9, h: 1.2, fontSize: 12.5,
  });

  darkBox(s, {
    x: M, y: 5.6, w: 3.9, h: 1.22,
    label: "Talk it through",
    lines: "jb@dentalbusinessnews.com",
    link: "mailto:jb@dentalbusinessnews.com",
  });

  // JB's card, 20 Oct. Volume tiers rather than one price, so the table gained
  // three money columns and lost the single RATE one. Category sponsorship is
  // withdrawn.
  //
  // NO AUDIENCE FIGURE IN THE DESCRIPTIONS. The eshot row used to read "to
  // 2,358 UK names", which meant the list size was stated on two slides and
  // the two had already drifted apart. It lives on slide 2 only now.
  const rows = [
    ["EMAIL", null],
    ["Eshot", "Your message alone, nobody else in it", ["£700", "£1,500", "£2,400"]],
    ["Newsletter sponsorship", "Named sponsor of The Monday Check-Up", ["£600", "£1,350", "£1,800"]],
    ["CONTENT", null],
    ["Sponsored article", "On the website and in the newsletter", ["£200", "£450", "£600"]],
    ["DISPLAY", null],
    ["Billboard, 970×250", "Top of the homepage", ["£500", "£1,000", "£1,500"]],
    ["Leaderboard, 728×90", "Across the site", ["£400", "£800", "£1,200"]],
    ["MPU, 300×250", "Two sidebar positions, sold separately", ["£200", "£400", "£600"]],
  ];

  const tx = 4.85, tw = W - M - tx;
  // Three right-aligned money columns on a shared grid, so the pounds line up
  // down the table whatever the number of digits.
  const COLS = [tx + 3.0, tx + 4.05, tx + 5.1];
  const CW = 0.95;
  let ty = 0.52;
  s.addShape(pres.ShapeType.rect, { x: tx, y: ty, w: tw, h: 0.42, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
  s.addText("FORMAT", { x: tx + 0.22, y: ty + 0.11, w: 2.6, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: "FFFFFF", charSpacing: 1.6, margin: 0, isTextBox: true });
  ["ONE", "THREE", "SIX"].forEach((lab, i) => {
    s.addText(lab, { x: COLS[i], y: ty + 0.11, w: CW, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: "FFFFFF", charSpacing: 1.6, align: "right", margin: 0, isTextBox: true });
  });
  ty += 0.42;

  for (const [a, b, prices] of rows) {
    if (b === null) {
      s.addShape(pres.ShapeType.rect, { x: tx, y: ty, w: tw, h: 0.34, fill: { color: WASH }, line: { color: WASH, width: 0 } });
      s.addText(a, { x: tx + 0.22, y: ty + 0.09, w: 3.0, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: TEAL, charSpacing: 1.8, margin: 0, isTextBox: true });
      ty += 0.34;
      continue;
    }
    const lines = Math.ceil(b.length / 33);
    const h = 0.46 + lines * 0.18;
    s.addText(a, { x: tx + 0.22, y: ty + 0.12, w: 2.6, h: 0.24, fontFace: SANS, fontSize: 10.5, bold: true, color: INK, margin: 0, valign: "top", isTextBox: true });
    serif(s, b, { x: tx + 0.22, y: ty + 0.36, w: 2.5, h: lines * 0.18, fontSize: 9.5, lineSpacingMultiple: 1.15, color: GREY });
    prices.forEach((p, i) => {
      s.addText(p, { x: COLS[i], y: ty + 0.16, w: CW, h: 0.26, fontFace: SANS, fontSize: 12, bold: true, color: TEAL, align: "right", margin: 0, isTextBox: true });
    });
    ty += h;
    s.addShape(pres.ShapeType.line, { x: tx, y: ty - 0.03, w: tw, h: 0, line: { color: PALE, width: 0.75 } });
  }
  s.addText("Display is priced per month. Email and content are priced per send or per article.", {
    x: tx, y: ty + 0.14, w: tw, h: 0.2, fontFace: MONO, fontSize: 7.5, color: MUTED, charSpacing: 0.6, margin: 0, isTextBox: true,
  });
  s.addText("All rates exclude VAT.  ·  Invoiced on publication, payable within 30 days.", {
    x: tx, y: ty + 0.34, w: tw, h: 0.2, fontFace: MONO, fontSize: 7.5, color: MUTED, charSpacing: 0.6, margin: 0, isTextBox: true,
  });
  s.addNotes("JB's rate card of 20 Oct 2026. Three tiers: one, three and six.");
}

/* ==================== 5. What results you get ===================== */
/*
 * Replaces the Specifications page, which JB cut on 20 Oct.
 *
 * EVERY FIGURE IS A LITERAL X AND THAT IS DELIBERATE. The title has run no
 * paid campaign, so there is no open rate, no click rate and no benchmark to
 * print. Putting a plausible-looking number here would be the MEPCA e-shot
 * problem in a document we hand to a buyer, so the page shows the shape of the
 * report and nothing else. The X runs in the bright accent rather than the
 * teal used for real figures elsewhere, so nobody mistakes one for the other.
 *
 * Note also that we cannot currently measure most of this: nothing in the
 * database stores opens or clicks for any title. This page is a promise that
 * needs the reporting built before it is handed to anybody.
 */
{
  const s = page("What results you get", 5);
  eyebrow(s, "What results you get");
  headline(s, "The numbers\nyou get back.", { y: 0.86, w: 4.2, fontSize: 30, h: 1.2 });
  serif(s, "Within X working days of your campaign finishing you get a report on your campaign and no other. The figures come straight from the sending platform and the site analytics.", {
    x: M, y: 2.3, w: 3.9, h: 1.3, fontSize: 12.5,
  });

  const rules = [
    "Unique counts, never totals, so one person opening twice is one open.",
    "Every click destination listed, so you can see what actually pulled.",
    "No house average standing in for your result.",
    "If it underperformed, the report says so.",
  ];
  s.addText("HOW WE COUNT", {
    x: M, y: 3.78, w: 3.9, h: 0.22, fontFace: MONO, fontSize: 9, bold: true,
    color: MUTED, charSpacing: 2, margin: 0, isTextBox: true,
  });
  // Advanced by the number of lines each rule actually takes. A fixed step
  // left a wider gap above the short ones than between the wrapped ones.
  let ry = 4.16;
  rules.forEach((t) => {
    const lines = Math.ceil(t.length / 48);
    s.addShape(pres.ShapeType.rect, { x: M + 0.03, y: ry + 0.07, w: 0.1, h: 0.1, fill: { color: ACCENT }, line: { color: ACCENT, width: 0 } });
    serif(s, t, { x: M + 0.32, y: ry, w: 3.6, h: lines * 0.26, fontSize: 11.5 });
    ry += lines * 0.26 + 0.16;
  });

  darkBox(s, {
    x: M, y: 6.5, w: 3.9, h: 0.92,
    label: "When you get it",
    lines: "Within X working days of the send.",
  });

  // ---- the report, with every figure left as a placeholder ----
  const tx = 4.85, tw = W - M - tx;
  const rows = [
    ["EMAIL CAMPAIGN", null, null],
    ["Delivered", "Inboxes it actually reached", "X,XXX"],
    ["Unique opens", "People who opened, counted once", "X,XXX · XX.X%"],
    ["Unique clicks", "People who clicked, counted once", "XXX · X.X%"],
    ["Click to open", "Of those who opened, who then clicked", "XX.X%"],
    ["Unsubscribes", "Off the list after your send", "X · X.XX%"],
    ["Hard bounces", "Addresses that no longer exist", "X · X.XX%"],
    ["ON THE SITE", null, null],
    ["Impressions", "Times your creative was served", "XX,XXX"],
    ["Clicks", "And the click-through rate", "XXX · X.XX%"],
    ["Article views", "If you bought a sponsored article", "X,XXX"],
    ["Median time on page", "How long they actually stayed", "X:XX"],
  ];

  let ty = 0.52;
  s.addShape(pres.ShapeType.rect, { x: tx, y: ty, w: tw, h: 0.42, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
  s.addText("YOUR CAMPAIGN REPORT", { x: tx + 0.22, y: ty + 0.11, w: 3.0, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: "FFFFFF", charSpacing: 1.6, margin: 0, isTextBox: true });
  s.addText("YOURS ALONE", { x: tx + tw - 1.8, y: ty + 0.11, w: 1.6, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: LIGHT, charSpacing: 1.6, align: "right", margin: 0, isTextBox: true });
  ty += 0.42;

  for (const [a, b, c] of rows) {
    if (b === null) {
      s.addShape(pres.ShapeType.rect, { x: tx, y: ty, w: tw, h: 0.34, fill: { color: WASH }, line: { color: WASH, width: 0 } });
      s.addText(a, { x: tx + 0.22, y: ty + 0.09, w: 3.0, h: 0.2, fontFace: MONO, fontSize: 8, bold: true, color: TEAL, charSpacing: 1.8, margin: 0, isTextBox: true });
      ty += 0.34;
      continue;
    }
    s.addText(a, { x: tx + 0.22, y: ty + 0.12, w: 1.6, h: 0.24, fontFace: SANS, fontSize: 10.5, bold: true, color: INK, margin: 0, valign: "top", isTextBox: true });
    serif(s, b, { x: tx + 1.95, y: ty + 0.13, w: 2.5, h: 0.4, fontSize: 9.5, lineSpacingMultiple: 1.2, color: GREY });
    s.addText(c, { x: tx + 4.62, y: ty + 0.11, w: 1.4, h: 0.26, fontFace: MONO, fontSize: 11, bold: true, color: ACCENT, align: "right", margin: 0, isTextBox: true });
    ty += 0.46;
    s.addShape(pres.ShapeType.line, { x: tx, y: ty - 0.03, w: tw, h: 0, line: { color: PALE, width: 0.75 } });
  }
  s.addText("Every X is a figure filled in from your campaign. No benchmark we have not measured.", {
    x: tx, y: ty + 0.14, w: tw, h: 0.2, fontFace: MONO, fontSize: 7.5, color: MUTED, charSpacing: 0.6, margin: 0, isTextBox: true,
  });
  s.addNotes("Placeholders only. The title has run no paid campaign, and nothing in the database stores opens or clicks yet.");
}

/* ========================= 6. Get in touch ======================== */
{
  const s = pres.addSlide();
  s.background = { color: TEAL };
  s.addImage({ path: `${ASSETS}/closing-photo.jpg`, x: 7.0, y: 0, w: W - 7.0, h: H, sizing: { type: "cover", w: W - 7.0, h: H } });
  s.addImage({ path: `${ASSETS}/wordmark-reversed@4x.png`, x: M, y: 0.58, w: 2.35, h: 0.965 });

  s.addText("ADVERTISE WITH US", {
    x: M, y: 2.5, w: 5.5, h: 0.24, fontFace: MONO, fontSize: 9.5, bold: true,
    color: LIGHT, charSpacing: 2.4, margin: 0, isTextBox: true,
  });
  s.addText("Get in touch.", {
    x: M, y: 2.84, w: 5.5, h: 0.8, fontFace: SANS, fontSize: 40, bold: true,
    color: "FFFFFF", margin: 0, valign: "top", isTextBox: true,
  });
  serif(s, "Tell us who you are trying to reach and what you want it to do, and we will come back with a plan, availability and a price.", {
    x: M, y: 3.82, w: 4.4, h: 0.9, fontSize: 13, color: "DCEAEA",
  });

  const contacts = [
    ["ADVERTISING", "jb@dentalbusinessnews.com"],
    ["SEND US A STORY", "dentalbusinessnews.com/submit-news"],
    ["SUBSCRIBE FREE", "dentalbusinessnews.com/newsletter"],
  ];
  contacts.forEach(([label, value], i) => {
    const y = 4.95 + i * 0.62;
    s.addText(label, {
      x: M, y, w: 2.0, h: 0.2, fontFace: MONO, fontSize: 8, bold: true,
      color: "7FB8B8", charSpacing: 1.8, margin: 0, isTextBox: true,
    });
    s.addText(value, {
      x: M + 2.1, y: y - 0.04, w: 4.0, h: 0.28, fontFace: SANS, fontSize: 12.5, bold: true,
      color: "FFFFFF", margin: 0, isTextBox: true,
    });
  });

  s.addShape(pres.ShapeType.line, { x: M, y: 7.08, w: 5.9, h: 0, line: { color: "3C7E82", width: 0.75 } });
  s.addText("PUBLISHED BY  ·  COGENT MULTIMEDIA LTD, 5 JUBILEE WAY, FAVERSHAM, KENT", {
    x: M, y: 7.26, w: 5.9, h: 0.22, fontFace: MONO, fontSize: 7.5, bold: true,
    color: "9FC4C4", charSpacing: 1.1, margin: 0, isTextBox: true,
  });
  // This photograph runs from a dark cable to a white chair exactly where the
  // credit sits, so no single ink colour reads across it. A faint scrim fixes
  // it and keeps the credit in the same corner as the cover's.
  s.addShape(pres.ShapeType.rect, {
    x: 7.0, y: H - 0.48, w: W - 7.0, h: 0.48,
    fill: { color: "0B1F24", transparency: 55 }, line: { color: "0B1F24", width: 0 },
  });
  s.addText("Photo: Cedric Fauntleroy via Pexels", {
    x: 7.1, y: H - 0.37, w: 3.4, h: 0.2, fontFace: MONO, fontSize: 7,
    color: "FFFFFF", margin: 0, isTextBox: true,
  });
}

await pres.writeFile({ fileName: OUT });
console.log(`written: ${OUT}`);
