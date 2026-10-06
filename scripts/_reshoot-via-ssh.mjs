// Companion to _reshoot-against-imagery-rules.mjs for when the title's REST API
// is behind SiteGround's captcha (it challenged this IP after three dry runs on
// 2 Oct 2026). Chooses each replacement here with the current picture desk, then
// imports it on the host with WP-CLI over the same SSH key the theme deploys use.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_reshoot-via-ssh.mjs --site=<slug> --only=1,2,3
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { chooseSmartImage } from "../lib/images.js";

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const site = await prisma.site.findUnique({ where: { slug: arg("site") } });
const ids = arg("only").split(",").map(Number);
const { creds } = await siteCredentials(site.id);
const cfg = creds.sftp;
const root = cfg.themePath.split("/wp-content/")[0];
const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`, `cd "${root}" && ${cmd}`],
    { encoding: "utf8", timeout: 180000 }).trim();
const q = (s) => `'${String(s).replace(/'/g, `'\''`)}'`;
const db = forSite(site.id);

for (const id of ids) {
  const title = ssh(`wp post get ${id} --field=post_title`);
  const article = await db.article.findFirst({ where: { wpPostId: id }, select: { id: true, keyphrase: true, category: true } });
  // Each attempt rewrites the searches with a different subject, which is what
  // it takes on a title whose obvious stock picture is the one it bans.
  let image = null, reason = "";
  for (let attempt = Number(arg("from-attempt") || 0); attempt < 4 && !image; attempt++) {
    ({ image, reason } = await chooseSmartImage(site, { title, keyphrase: article?.keyphrase, category: article?.category, attempt }));
  }
  if (!image) { console.log(`KEPT    ${id}  ${title}: no replacement found (${reason})`); continue; }
  const media = ssh(`wp media import ${q(image.url)} --post_id=${id} --featured_image --title=${q(title)} --alt=${q(image.alt || title)}${image.credit ? ` --caption=${q(image.credit)}` : ""} --porcelain`);
  // A real save, so Yoast rebuilds the indexable and og:image follows the new picture.
  ssh(`wp post update ${id} --post_title=${q(title)}`);
  if (article) await db.article.update({ where: { id: article.id }, data: { imageUrl: image.url, imageAlt: image.alt, imageSource: image.source } });
  console.log(`SWAPPED ${id}  ${title}  -> media ${media}  (${image.alt})`);
}
await prisma.$disconnect();
