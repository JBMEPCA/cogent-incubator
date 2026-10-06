/**
 * One-off, 14 Sep 2026: trim the white border off the BOW. press photo JB
 * saved from the Stellantis email, attach it to Fleet post 926 as the featured
 * image, add the credit line, publish, and mark the Article row published.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-stellantis-iaa.mjs [--publish]
 */
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const PUBLISH = process.argv.includes("--publish");
const POST_ID = 926;
const SRC = path.join(os.homedir(), "Downloads", "unnamed.jpg");
const OUT = path.join(os.tmpdir(), "stellantis-pro-one-bow-concept-iaa-2026.jpg");
const ALT = "Stellantis Pro One BOW. autonomous electric delivery concept vehicle";
const CREDIT = "Picture: Stellantis";

// The supplied frame has a white border on three sides. Trim anything near
// white off the edges, then shave two more pixels so no anti-aliased fringe
// survives the theme's crop.
const trimmed = await sharp(SRC).trim({ background: "#ffffff", threshold: 30 }).toBuffer({ resolveWithObject: true });
const { width, height } = trimmed.info;
await sharp(trimmed.data)
  .extract({ left: 2, top: 2, width: width - 4, height: height - 4 })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`source ${(await sharp(SRC).metadata()).width}x${(await sharp(SRC).metadata()).height} -> ${meta.width}x${meta.height}, ${fs.statSync(OUT).size} bytes`);
console.log(`preview: ${OUT}`);
if (!PUBLISH) process.exit(0);

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const target = `${s.username}@${s.host}`;
const sshArgs = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
const ssh = (cmd) => execFileSync("ssh", [...sshArgs, target, `cd '${docroot}' && ${cmd}`], { encoding: "utf8", timeout: 180000 }).trim();
const b64 = (x) => Buffer.from(x, "utf8").toString("base64");

// Upload over the same SSH channel: base64 through stdin, decoded remotely.
const remote = `/tmp/${path.basename(OUT)}`;
execFileSync("ssh", [...sshArgs, target, `base64 -d > '${remote}'`], { input: fs.readFileSync(OUT).toString("base64"), timeout: 180000 });

const mediaId = Number(
  ssh(`wp media import '${remote}' --post_id=${POST_ID} --featured_image --title='Stellantis Pro One BOW. concept' --alt="$(printf '%s' '${b64(ALT)}' | base64 -d)" --caption='${CREDIT}' --porcelain && rm -f '${remote}'`)
);
console.log("media", mediaId);

// Credit line, the same form publishArticle() appends for imageCredit.
const body = ssh(`wp post get ${POST_ID} --field=post_content`);
const creditLine = `<p><em style="font-size:0.85em">${CREDIT}</em></p>`;
if (!body.includes(creditLine)) {
  const tmp = `/tmp/stellantis-body-${Date.now()}.html`;
  ssh(`printf '%s' '${b64(body + "\n\n" + creditLine)}' | base64 -d > ${tmp} && wp post update ${POST_ID} ${tmp} && rm -f ${tmp}`);
}

ssh(`wp post update ${POST_ID} --post_status=publish`);
const link = ssh(`wp post list --post__in=${POST_ID} --post_status=publish --fields=url --format=csv | tail -1`);
console.log(ssh(`wp post get ${POST_ID} --fields=post_status,post_name,post_date --format=csv`));
console.log("thumbnail", ssh(`wp post meta get ${POST_ID} _thumbnail_id`), "| url", link);

const art = await prisma.article.findFirst({ where: { siteId: site.id, wpPostId: POST_ID } });
await prisma.article.update({
  where: { id: art.id },
  data: { status: "published", publishedAt: new Date(), imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:stellantis" },
});
console.log("article row published", art.id);
await prisma.$disconnect();
