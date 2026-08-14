// Regenerates lib/brand/logo.js from the logo published on smartsme.co.uk.
//
// The mark is embedded in the bundle rather than fetched at post time so a
// slow or reorganised website can never cost us the branding on a post, and so
// the runtime needs no fonts to draw the brand name.
//
//   node scripts/build-brand-logo.mjs
//
// Run it if the site logo changes. The source is the schema.org organisation
// logo in the homepage markup.
import sharp from "sharp";
import fs from "fs";

const HOME = "https://smartsme.co.uk/";
const OUT = "lib/brand/logo.js";
const STORED_WIDTH = 520; // several times the size it is ever drawn at

const home = await fetch(HOME, { headers: { "user-agent": "Mozilla/5.0" } });
if (!home.ok) throw new Error(`could not read ${HOME} (${home.status})`);
const html = await home.text();

const match = html.match(/"logo":\{[^}]*"contentUrl":"([^"]+)"/);
if (!match) throw new Error("no organisation logo found in the homepage markup");
const logoUrl = match[1].replace(/\\\//g, "/");
console.log("source:", logoUrl);

const res = await fetch(logoUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!res.ok) throw new Error(`could not download the logo (${res.status})`);

// The published logo sits on a white canvas with generous margins, so it is
// trimmed to the mark itself before being stored.
const png = await sharp(Buffer.from(await res.arrayBuffer()))
  .trim({ background: "#ffffff", threshold: 5 })
  .resize({ width: STORED_WIDTH, fit: "inside" })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();

const { width, height } = await sharp(png).metadata();

fs.writeFileSync(
  OUT,
  `// The Smart SME wordmark, taken from the logo on smartsme.co.uk and trimmed.
// Embedded rather than read from disk so the serverless bundle always carries
// it, and so no font has to exist in the runtime to draw the brand name.
// Regenerate with scripts/build-brand-logo.mjs if the site logo changes.
export const LOGO_WIDTH = ${width};
export const LOGO_HEIGHT = ${height};
export const LOGO_PNG = Buffer.from(
  "${png.toString("base64")}",
  "base64"
);
`
);

console.log(`wrote ${OUT}: ${width}x${height}, ${(png.length / 1024).toFixed(1)}KB`);
