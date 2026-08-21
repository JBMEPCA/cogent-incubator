// Regenerates lib/brand/wordmarks.js — one wordmark per title, on a white
// background, for use inside outreach emails.
//
//   node --env-file=.env scripts/build-brand-wordmarks.mjs
//
// The fleet-wide sibling of build-brand-logo.mjs, stored the same way:
// embedded in the bundle rather than fetched at send time, so a slow or
// reorganised website can never cost an email its branding.
//
// Two sources, because the titles brand themselves two different ways:
//  - Smart SME publishes a real logo file (the schema.org organisation logo
//    on its homepage), so that is fetched and trimmed, as before.
//  - Fleet and Golf have no logo artwork anywhere: their masthead is a CSS
//    type lockup (cogent-base-theme .logo-lockup). Those are typeset here
//    with the same fonts, colours and proportions the theme uses, recoloured
//    for a white background the way Golf's own white header already does it.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import os from "os";

const OUT = "lib/brand/wordmarks.js";
const STORED_WIDTH = 520; // several times the size it is ever drawn at
const INK = "#14181C"; // the base theme's "contrast" token

// The CSS lockup, per title. Values mirror cogent-base-theme style.css
// (.logo-row 1.3rem Archivo 700, chip padding 3px 7px radius 4px,
// .logo-mag 8px JetBrains Mono tracked 0.42em) at 5x scale for crispness.
const LOCKUPS = {
  "fleet-magazine": {
    pre: "The ",
    chip: "FLEET",
    chipBg: "#B45309", // Signal Amber — the child theme's .logo-mark override
    mag: "MAGAZINE",
    magColor: "#0B5563", // Fleet Petrol; brand-bright is too pale on white
  },
  "golf-resort-magazine": {
    pre: "GOLF ",
    chip: "RESORT",
    chipBg: "#15694A", // Fairway Green — the parent default, as on its site
    mag: "MAGAZINE",
    magColor: "#15694A", // the child's own .logo-mag override for white
  },
};

// Pango needs TTF; the themes ship woff2. Same faces, fetched from Google
// Fonts at build time only — nothing is fetched when emails are sent.
const FONTS = {
  archivo: "https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTT0zRp8A.ttf",
  mono: "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf",
};

const S = 5;
const ROW_PX = Math.round(20.8 * S); // 1.3rem
const CHIP_PAD_X = 7 * S;
const CHIP_PAD_Y = 3 * S;
const CHIP_RADIUS = 4 * S;
const MAG_PX = 8 * S;
const MAG_TOP = 4 * S;
// Pango letter_spacing is in 1024ths of a point (dpi 72 makes pt == px)
const MAG_TRACKING = Math.round(0.42 * MAG_PX * 1024);
const ROW_TRACKING = Math.round(-0.01 * ROW_PX * 1024);

async function fontFile(name, url) {
  const file = path.join(os.tmpdir(), `wordmark-${name}.ttf`);
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font download ${res.status}: ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

async function piece(markup, fontfile) {
  const img = sharp({ text: { text: markup, fontfile, dpi: 72, rgba: true } }).png();
  const buf = await img.toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

async function typesetLockup(cfg, fonts) {
  const row = (text, colour) =>
    `<span font="Archivo Bold ${ROW_PX}px" letter_spacing="${ROW_TRACKING}" foreground="${colour}">${text}</span>`;

  const pre = await piece(row(cfg.pre, INK), fonts.archivo);
  const chipText = await piece(row(cfg.chip, "#FFFFFF"), fonts.archivo);
  const mag = await piece(
    `<span font="JetBrains Mono ${MAG_PX}px" letter_spacing="${MAG_TRACKING}" foreground="${cfg.magColor}">${cfg.mag}</span>`,
    fonts.mono
  );

  const chipW = chipText.width + CHIP_PAD_X * 2;
  const chipH = chipText.height + CHIP_PAD_Y * 2;
  const chip = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${chipW}" height="${chipH}"><rect width="${chipW}" height="${chipH}" rx="${CHIP_RADIUS}" fill="${cfg.chipBg}"/></svg>`
  );

  const rowH = Math.max(pre.height, chipH);
  const width = pre.width + chipW;
  const height = rowH + MAG_TOP + mag.height;

  const composed = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: pre.buf, left: 0, top: Math.round((rowH - pre.height) / 2) },
      { input: chip, left: pre.width, top: Math.round((rowH - chipH) / 2) },
      {
        input: chipText.buf,
        left: pre.width + CHIP_PAD_X,
        top: Math.round((rowH - chipText.height) / 2),
      },
      { input: mag.buf, left: width - mag.width, top: rowH + MAG_TOP },
    ])
    .png()
    .toBuffer();

  return sharp(composed)
    .trim({ background: "#ffffff", threshold: 5 })
    .resize({ width: STORED_WIDTH, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

async function fetchSiteLogo(domain) {
  const home = await fetch(`https://${domain}/`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!home.ok) throw new Error(`homepage ${home.status}`);
  const match = (await home.text()).match(/"logo":\{[^}]*"contentUrl":"([^"]+)"/);
  if (!match) throw new Error("no organisation logo in the homepage markup");
  const logoUrl = match[1].replace(/\\\//g, "/");
  const res = await fetch(logoUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`logo download ${res.status}`);
  return sharp(Buffer.from(await res.arrayBuffer()))
    .trim({ background: "#ffffff", threshold: 5 })
    .resize({ width: STORED_WIDTH, fit: "inside" })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { slug: true, name: true, domain: true },
  orderBy: { createdAt: "asc" },
});
await prisma.$disconnect();

const fonts = {
  archivo: await fontFile("archivo-700", FONTS.archivo),
  mono: await fontFile("jetbrains-mono-400", FONTS.mono),
};

const entries = [];
for (const site of sites) {
  try {
    const lockup = LOCKUPS[site.slug];
    const png = lockup ? await typesetLockup(lockup, fonts) : await fetchSiteLogo(site.domain);
    const { width, height } = await sharp(png).metadata();
    entries.push({ slug: site.slug, name: site.name, source: lockup ? "CSS lockup" : site.domain, width, height, png });
    console.log(`${site.slug}: ${width}x${height}, ${(png.length / 1024).toFixed(1)}KB (${lockup ? "typeset" : "site logo"})`);
  } catch (err) {
    console.error(`${site.slug}: FAILED — ${err.message}`);
    process.exitCode = 1;
  }
}

if (!entries.length) {
  console.error("no wordmarks built; not writing anything");
  process.exit(1);
}

fs.writeFileSync(
  OUT,
  `// Per-title wordmarks on white, for outreach email footers. Generated by
// scripts/build-brand-wordmarks.mjs — do not edit by hand; rerun the script
// when a title's logo changes or a title is added.
export const WORDMARKS = {
${entries
  .map(
    (e) => `  // ${e.name} — ${e.source}
  "${e.slug}": {
    width: ${e.width},
    height: ${e.height},
    png: Buffer.from(
      "${e.png.toString("base64")}",
      "base64"
    ),
  },`
  )
  .join("\n")}
};

export function wordmarkFor(slug) {
  return WORDMARKS[slug] || null;
}
`
);

console.log(`wrote ${OUT}: ${entries.length} titles`);
