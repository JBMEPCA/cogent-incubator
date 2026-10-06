// Last resort for _reshoot-via-ssh.mjs: a hand-written Pexels query per post,
// every candidate still judged by the picture gate, imported over SSH.
//   node ... scripts/_reshoot-manual-query.mjs --site=<slug> <postId>="<query>" ...
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { verifyImage } from "../lib/qa.js";

const site = await prisma.site.findUnique({ where: { slug: process.argv.find((a) => a.startsWith("--site=")).split("=")[1] } });
const jobs = process.argv.slice(2).filter((a) => /^\d+=/.test(a)).map((a) => { const i = a.indexOf("="); return [Number(a.slice(0, i)), a.slice(i + 1)]; });
const { creds } = await siteCredentials(site.id);
const cfg = creds.sftp;
const root = cfg.themePath.split("/wp-content/")[0];
const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const ssh = (cmd) => execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`, `cd "${root}" && ${cmd}`], { encoding: "utf8", timeout: 180000 }).trim();
const q = (s) => `'${String(s).replace(/'/g, `'\''`)}'`;
const db = forSite(site.id);
const used = new Set((await db.article.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } })).map((a) => a.imageUrl.split("?")[0]));

for (const [id, query] of jobs) {
  const title = ssh(`wp post get ${id} --field=post_title`);
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`, { headers: { authorization: process.env.PEXELS_API_KEY } });
  const photos = ((await res.json()).photos || []).filter((p) => !used.has(p.src.large2x.split("?")[0]));
  let done = false;
  for (const p of photos.slice(0, 5)) {
    const check = await verifyImage({ site, imageUrl: p.src.large2x, title });
    if (!check.ok) { console.log(`  no: ${p.alt?.slice(0, 50)} - ${check.reason.slice(0, 100)}`); continue; }
    const media = ssh(`wp media import ${q(p.src.large2x)} --post_id=${id} --featured_image --title=${q(title)} --alt=${q(check.altText || title)} --porcelain`);
    ssh(`wp post update ${id} --post_title=${q(title)}`);
    const article = await db.article.findFirst({ where: { wpPostId: id }, select: { id: true } });
    if (article) await db.article.update({ where: { id: article.id }, data: { imageUrl: p.src.large2x, imageAlt: check.altText, imageSource: `pexels:${String(p.photographer).toLowerCase()}` } });
    console.log(`SWAPPED ${id}  ${title}  -> media ${media}  (${check.altText})`);
    done = true;
    break;
  }
  if (!done) console.log(`KEPT    ${id}  ${title}: nothing passed for "${query}"`);
}
await prisma.$disconnect();
