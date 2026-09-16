/**
 * Swap the secondary image on draft 1333 (SME Leaders: Dr Mark Williams OBE).
 *
 * JB, 16 Sep 2026: use the investiture photo with the Princess Royal as the
 * secondary image. It goes under "What the OBE changed", where it belongs, and
 * the solo studio full-length it replaces comes out of the closing section, so
 * the article keeps one secondary image. The draft is edited in place; it stays
 * a draft, and the build script already produces the same layout on a rebuild.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_swap-mark-williams-secondary-image.mjs --photos=<dir>
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const POST_ID = 1333;
const PHOTOS = (process.argv.find((a) => a.startsWith("--photos=")) || "").split("=")[1];
const ROYAL_FILE = path.join(PHOTOS, "Screenshot_20260609_164902_Facebook.jpg");
const ROYAL_ALT = "Dr Mark Williams OBE showing his LIMB-art prosthetic leg cover to the Princess Royal at his investiture";
const OBE_HEADING = `<h2 class="wp-block-heading">What the OBE changed</h2>`;

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

if (wp(`post get ${POST_ID} --field=post_status`) !== "draft") throw new Error(`post ${POST_ID} is not a draft`);
const content = wp(`post get ${POST_ID} --field=post_content`);

// The one existing image block is the solo shot. Exactly one, or stop.
const blockRe = /<!-- wp:image [^>]*-->\s*<figure class="wp-block-image[^"]*">[\s\S]*?<\/figure>\s*<!-- \/wp:image -->\n?/g;
const blocks = content.match(blockRe) || [];
if (blocks.length !== 1) throw new Error(`expected exactly one image block, found ${blocks.length}`);
if (content.split(OBE_HEADING).length !== 2) throw new Error("OBE heading not found exactly once");

const royal = await sharp(ROYAL_FILE).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
const stamp = Date.now();
ssh(`base64 -d > /tmp/mark-royal-${stamp}.jpg`, royal.toString("base64"));
const royalId = wp(`media import /tmp/mark-royal-${stamp}.jpg --title=${sq("Dr Mark Williams OBE at his investiture")} --alt=${sq(ROYAL_ALT)} --porcelain`);
const royalUrl = wp(`post get ${royalId} --field=guid`);

const royalBlock = `<!-- wp:image {"width":"480px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n<figure class="wp-block-image aligncenter size-full is-resized"><img src="${royalUrl}" alt="${ROYAL_ALT}" style="width:480px"/></figure>\n<!-- /wp:image -->`;
const updated = content.replace(blocks[0], "").replace(OBE_HEADING, `${OBE_HEADING}\n${royalBlock}`);

ssh(`base64 -d > /tmp/mark-body-${stamp}.html`, Buffer.from(updated, "utf8").toString("base64"));
wp(`post update ${POST_ID} /tmp/mark-body-${stamp}.html`);
ssh(`rm -f /tmp/mark-royal-${stamp}.jpg /tmp/mark-body-${stamp}.html`);

const after = wp(`post get ${POST_ID} --field=post_content`);
const quotes = (s) => (s.match(/interview-quote/g) || []).length;
console.log(JSON.stringify({
  status: wp(`post get ${POST_ID} --field=post_status`),
  royalMediaId: royalId,
  imageBlocks: (after.match(blockRe) || []).length,
  royalUnderObeHeading: after.includes(`${OBE_HEADING}\n<!-- wp:image`),
  soloRemoved: !after.includes("Union flag prosthetic leg cover"),
  quotesBefore: quotes(content),
  quotesAfter: quotes(after),
  imageBlockDetected: wp(`eval 'echo has_block("core/image", ${POST_ID}) ? "yes" : "no";'`),
}, null, 1));
