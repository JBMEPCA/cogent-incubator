/**
 * Add Gareth Anderson's headshot to the Allica piece (Smart SME post 1498):
 * inline, right-aligned, immediately before his first quote, and as the
 * featured image in place of the name card. Over SSH + wp-cli.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_add-gareth-headshot.mjs --file=<path.jpg>
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const POST_ID = 1498;
const FILE = (process.argv.find((a) => a.startsWith("--file=")) || "").split("=").slice(1).join("=");
if (!FILE || !fs.existsSync(FILE)) throw new Error("--file=<headshot.jpg> required");
const ANCHOR = "Manufacturers will be breathing a sigh of relief";
const ALT = "Gareth Anderson, Head of Business Management at Allica Bank";
const CAPTION = "Gareth Anderson, Head of Business Management, Allica Bank";

const raw = fs.readFileSync(FILE);
const m = await sharp(raw).metadata();
const inline = await sharp(raw).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
// A 3:2 portrait is taller than 16:9, so the hero is a crop, not an extension.
// "attention" keeps the face rather than the middle of the frame.
const hero = await sharp(raw).resize(1600, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
console.log(`source ${m.width}x${m.height}; inline ${(inline.length / 1024).toFixed(0)} KB; hero ${(hero.length / 1024).toFixed(0)} KB`);

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
await prisma.$disconnect();
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const content = wp(`post get ${POST_ID} --field=post_content`);
if (!content.includes(ANCHOR)) throw new Error("anchor quote not found in post content");
if (/wp-block-image/.test(content)) throw new Error("post already has an inline image; refusing to add a second");

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`gareth-inline-${stamp}.jpg`, inline);
put(`gareth-hero-${stamp}.jpg`, hero);
const inlineId = wp(`media import /tmp/gareth-inline-${stamp}.jpg --title=${sq("Gareth Anderson, Allica Bank")} --alt=${sq(ALT)} --porcelain`);
const heroId = wp(`media import /tmp/gareth-hero-${stamp}.jpg --title=${sq("Gareth Anderson, Allica Bank (lead)")} --alt=${sq(ALT)} --porcelain`);
const inlineUrl = wp(`post get ${inlineId} --field=guid`);

const figure = `<!-- wp:image {"id":${inlineId},"width":"360px","sizeSlug":"large","linkDestination":"none","align":"right"} -->
<figure class="wp-block-image alignright size-large is-resized"><img src="${inlineUrl}" alt="${ALT}" class="wp-image-${inlineId}" style="width:360px"/><figcaption class="wp-element-caption">${CAPTION}</figcaption></figure>
<!-- /wp:image -->`;

// The quote paragraph starts with <p>&#8220;Manufacturers... ; put the figure on the line before it.
const idx = content.indexOf(ANCHOR);
const pStart = content.lastIndexOf("<p>", idx);
if (pStart < 0) throw new Error("could not find the paragraph start before the anchor");
const updated = content.slice(0, pStart) + figure + "\n\n" + content.slice(pStart);

put(`allica-body-${stamp}.html`, Buffer.from(updated, "utf8"));
wp(`post update ${POST_ID} /tmp/allica-body-${stamp}.html`);
const oldThumb = wp(`post meta get ${POST_ID} _thumbnail_id`);
wp(`post meta update ${POST_ID} _thumbnail_id ${heroId}`);
ssh(`rm -f /tmp/gareth-inline-${stamp}.jpg /tmp/gareth-hero-${stamp}.jpg /tmp/allica-body-${stamp}.html && cd ${sq(docroot)} && wp cache flush && (wp sg purge >/dev/null 2>&1 || true)`);

const url = wp(`post url ${POST_ID}`);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(url)}`);
console.log(JSON.stringify({
  url, inlineId, heroId, previousThumb: oldThumb,
  inlineRendered: page.includes(`wp-image-${inlineId}`),
  figureBeforeQuote: page.indexOf(`wp-image-${inlineId}`) > 0 && page.indexOf(`wp-image-${inlineId}`) < page.indexOf(ANCHOR),
  captcha: /SG-Captcha|Robot Challenge/i.test(page),
}, null, 2));
