// Give each title a publisher logo and an Organization entity.
//
//   node --import ./scripts/_register.mjs scripts/set-publisher-logo.mjs --all [--dry-run]
//   node --import ./scripts/_register.mjs scripts/set-publisher-logo.mjs --site=golf-resort-magazine
//
// Yoast owns the schema graph, and it only emits an Organization node when
// wpseo_titles.company_name AND company_logo are both set. Four of the five
// titles had company_or_person=company with both fields empty, so their pages
// carried no publisher entity at all: every article named ITSELF as publisher,
// with no logo, which is the one thing Google News and Discover both want.
//
// The mark drawn here is the same one the theme already draws as the favicon
// (inc/brand.php mark_letters on the child's two brand tones, split on the
// diagonal), rendered at 512px. Using the existing mark rather than inventing
// artwork means no new design decision and nothing to keep in step later.
//
// Idempotent: a title that already has a company_logo is left alone unless
// --force is passed, so this cannot overwrite real artwork with a typeset
// stand-in (Smart SME publishes a genuine logo file and must keep it).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";


const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const ALL = process.argv.includes("--all");
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// Mirrors cogent_brand_defaults(): one initial per word of the full site name,
// article included, unless the child overrides it.
const LETTER_OVERRIDES = { "smart-sme": "SME" };
const initials = (name) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("");

// Read the child theme's palette so the logo cannot drift from the site.
const CHILD_DIRS = {
  "smart-sme": "smart-sme-website",
  "fleet-magazine": "fleet-magazine-website",
  "golf-resort-magazine": "golf-resort-magazine-website",
  "barbering-business": "barbering-business-website",
  "airport-business-magazine": "airport-business-magazine-website",
};

function palette(slug) {
  const dir = CHILD_DIRS[slug];
  if (!dir) return null;
  const file = path.resolve(process.cwd(), "..", dir, "child", "theme.json");
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = json?.settings?.color?.palette || [];
  const pick = (s) => list.find((c) => c.slug === s)?.color || null;
  return { deep: pick("brand"), bright: pick("brand-bright") || pick("brand") };
}

// The favicon geometry from cogent-base/functions.php, scaled 16x to 512px.
function markSvg({ letters, deep, bright }) {
  const sizes = { 1: 22, 2: 15, 3: 11.5 };
  const size = sizes[Math.min(3, letters.length)] || 11.5;
  const y = Math.round((16 + size * 0.36) * 10) / 10;
  const track = letters.length >= 3 ? ' letter-spacing="-0.3"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512">
<defs><clipPath id="r"><rect width="32" height="32" rx="6"/></clipPath></defs>
<g clip-path="url(#r)">
<rect width="32" height="32" fill="${deep}"/>
<polygon points="0,32 32,0 32,32" fill="${bright}"/>
</g>
<text x="16" y="${y}" text-anchor="middle" fill="#fff" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700"${track}>${letters}</text>
</svg>`;
}

const sites = ALL
  ? await prisma.site.findMany({ orderBy: { createdAt: "asc" } })
  : await prisma.site.findMany({ where: { slug: arg("site") } });

if (!sites.length) {
  console.error("Usage: --all | --site=<slug>");
  await prisma.$disconnect();
  process.exit(1);
}

for (const site of sites) {
  console.log(`\n=== ${site.name} (${site.slug}) ===`);
  const { creds } = await siteCredentials(site.id);
  const wp = creds?.wordpress;
  const sftp = creds?.sftp;
  if (!wp?.url || !sftp?.host) {
    console.log("  skipped: missing WordPress or SFTP credential");
    continue;
  }

  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const ssh = (cmd) =>
    execFileSync(
      "ssh",
      ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
       "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd],
      { encoding: "utf8", timeout: 120000 }
    ).trim();

  // Never overwrite a real logo with a typeset stand-in.
  let current = "";
  try {
    current = ssh(`cd '${docroot}' && wp option get wpseo_titles --format=json | tr ',' '\\n' | grep -o '"company_logo":"[^"]*"' | head -1`);
  } catch {
    current = "";
  }
  const hasLogo = current && !/"company_logo":""/.test(current);
  if (hasLogo && !FORCE) {
    console.log(`  already has a publisher logo, left alone (--force to replace)`);
    console.log(`  ${current}`);
    continue;
  }

  const pal = palette(site.slug);
  if (!pal?.deep) {
    console.log("  skipped: could not read brand colours from the child theme");
    continue;
  }
  const letters = LETTER_OVERRIDES[site.slug] || initials(site.name);
  console.log(`  mark: "${letters}" on ${pal.deep} / ${pal.bright}`);

  if (DRY) {
    console.log("  dry run: would upload the mark and set company_name + company_logo");
    continue;
  }

  const png = await sharp(Buffer.from(markSvg({ letters, ...pal }))).png().toBuffer();

  // Posted straight from the buffer. lib/wordpress.js's uploadMedia sideloads
  // from a URL and Node's fetch has no file:// support, so the bytes go up
  // directly rather than round-tripping through a temporary web server.
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const base = `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2`;
  const up = await fetch(`${base}/media`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${site.slug}-publisher-logo.png"`,
    },
    body: png,
  });
  if (!up.ok) {
    console.log(`  upload FAILED ${up.status}: ${(await up.text()).slice(0, 200)}`);
    continue;
  }
  const media = await up.json();
  await fetch(`${base}/media/${media.id}`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ alt_text: `${site.name} logo` }),
  });
  media.url = media.source_url;
  console.log(`  uploaded media #${media.id} -> ${media.url}`);

  ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_name ${JSON.stringify(site.name)}`);
  ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_logo ${JSON.stringify(media.url)}`);
  ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_logo_id ${media.id}`);
  ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_or_person company`);
  console.log("  Yoast site representation set");
}

await prisma.$disconnect();
process.exit(0);
