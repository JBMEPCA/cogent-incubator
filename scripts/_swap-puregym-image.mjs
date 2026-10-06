/**
 * Swap the lead image on Gym post 86 ("PureGym refinances debt, plans 750 new
 * gyms worldwide") from a Pexels stock shot to PureGym's own 2025 campaign
 * photo. JB, 30 Sep 2026: "use these images instead, pick one". Chosen:
 * PG_1124_12204301_2025CAMPAIGN_Sled_01_RGB.tif (wide gym floor, PureGym
 * trainer in branded kit), cut to 2000x1125 locally from the 8192px TIF.
 * The old media item (85) is left in the library, not deleted.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_swap-puregym-image.mjs --file=<jpg>
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const POST_ID = 86;
const FILE = (process.argv.find((a) => a.startsWith("--file=")) || "").slice(7);
if (!FILE || !fs.existsSync(FILE)) throw new Error("--file=<jpg>");
const ALT = "A PureGym member pushes a weighted sled while a personal trainer coaches her on the gym floor";
const CAPTION = "Picture: PureGym";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 64 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

const stamp = Date.now();
const name = `puregym-refinancing-750-gyms-${stamp}.jpg`;
ssh(`base64 -d > /tmp/${name}`, fs.readFileSync(FILE).toString("base64"));
const id = wp(`media import /tmp/${name} --post_id=${POST_ID} --title=${sq("PureGym member and personal trainer on the gym floor")} --alt=${sq(ALT)} --caption=${sq(CAPTION)} --porcelain`);
ssh(`rm -f /tmp/${name}`);
const old = wp(`post meta get ${POST_ID} _thumbnail_id`);
wp(`post meta update ${POST_ID} _thumbnail_id ${id}`);
// A real save, so Yoast rebuilds its indexable and og:image follows.
const ping = wp(`post get ${POST_ID} --field=ping_status`);
wp(`post update ${POST_ID} --ping_status=${ping}`);
ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);

const db = forSite(site.id);
const art = await db.article.findFirst({ where: { wpPostId: POST_ID } });
if (art) await db.article.update({ where: { id: art.id }, data: { imageSource: "supplied:puregym", imageCredit: CAPTION } });

const url = wp(`post url ${POST_ID}`);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`${url}?nc=${stamp}`)}`);
const og = (page.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
console.log({ oldThumb: old, newThumb: id, url, ogImage: og, pageUsesNew: page.includes("puregym-refinancing-750-gyms"), articleRow: !!art });
await prisma.$disconnect();
