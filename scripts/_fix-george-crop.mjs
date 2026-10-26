/**
 * Put George's whole face back on post 367, Dental Business News.
 *
 * Emma Mugizi at MPS, 22 Oct: "I've noticed George's face is cut off on the
 * page." She is right, and it is the same fault that cut the top off Sheena
 * Tanna's head two days ago: templates/single.html renders the lead image with
 * aspectRatio 16/9 and object-fit cover, so the browser takes the MIDDLE band
 * of whatever it is given. The supplied photograph is 2560x2560, a full-length
 * portrait with his head in the top quarter, so the centre band starts below
 * his eyes.
 *
 * The press release was filed as subjectKind "company", so none of the
 * person-photo handling applied. That is the wider hole: a release about an
 * organisation can still carry a photograph of a named individual.
 *
 * THE CROP IS CHOSEN BY sharp.strategy.attention, not by hand, because that is
 * the rule going fleetwide in lib/images.js and this should be the first thing
 * it is proven on. Compared on this image: centre cuts him at the mouth,
 * entropy crops to his legs, top is cramped, attention frames head and torso
 * with headroom.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_fix-george-crop.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const POST_ID = 367;
const ARTICLE_ID = "cmvja877c0005jteari0f64dj";
const S =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/scratchpad";
const SRC = `${S}/george-current.jpg`;
const OUT = `${S}/george-fixed.jpg`;

// Name and title taken from the body of the article, not from Emma's email,
// which only said "George".
const ALT = "Dr George Wright, Dental Director at Dental Protection";
const CAPTION =
  "Dr George Wright, Dental Director at Dental Protection. Picture: Dental Protection (The Medical Protection Society Limited)";

const meta = await sharp(SRC).metadata();
await sharp(SRC)
  .resize(2000, 1125, { fit: "cover", position: sharp.strategy.attention })
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(OUT);
const out = await sharp(OUT).metadata();
console.log(`source ${meta.width}x${meta.height}  ->  hero ${out.width}x${out.height} (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB)`);

if (!APPLY) {
  console.log("DRY RUN, the live article is untouched. add --apply");
  process.exit(0);
}

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
const ssh = (cmd, input) => execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 48e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

const before = wp(`post meta get ${POST_ID} _thumbnail_id`);
console.log(`featured before: ${before}`);

const stamp = Date.now();
ssh(`base64 -d > /tmp/george-${stamp}.jpg`, fs.readFileSync(OUT).toString("base64"));
const mediaId = Number(
  wp(
    `media import /tmp/george-${stamp}.jpg --post_id=${POST_ID} --title=${sq("George Wright, Dental Protection")} ` +
      `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
  )
);
ssh(`rm -f /tmp/george-${stamp}.jpg`);
const mediaUrl = wp(`post get ${mediaId} --field=guid`);
console.log(`featured after : ${wp(`post meta get ${POST_ID} _thumbnail_id`)} (${mediaId})`);

// Without this the share card keeps serving the old crop however many times
// the featured image is changed. Same trap as the Dental hero swap.
const prefix = ssh(`cd ${sq(docroot)} && wp db prefix --skip-themes --skip-plugins`).trim();
wp(`db query "DELETE FROM ${prefix}yoast_indexable WHERE object_id = ${POST_ID} AND object_type = 'post'" --skip-themes --skip-plugins`);
console.log("yoast indexable row deleted so og:image rebuilds");

ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`);

await forSite(site.id).article.update({
  where: { id: ARTICLE_ID },
  data: { imageUrl: mediaUrl, imageAlt: ALT, imageCredit: CAPTION },
});

const b64 = ssh(`curl -s --max-time 40 -A 'Mozilla/5.0' ${JSON.stringify(wp(`post url ${POST_ID}`))} | base64 -w0`);
const html = Buffer.from(b64, "base64").toString("utf8");
const og = (html.match(/property=["']og:image["'] content=["']([^"']*)/i) || [])[1] || "";
console.log(`\nlive og:image  : ${og}`);
console.log(`new crop live  : ${og.includes(String(mediaId)) || html.includes(mediaUrl.split("/").pop())}`);
console.log(`url            : ${wp(`post url ${POST_ID}`)}`);
await prisma.$disconnect();
