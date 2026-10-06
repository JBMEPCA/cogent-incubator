/**
 * Publish a Smart SME draft that must stay off the homepage.
 *
 * Refuses unless the post is a draft, carries the guest-perspective tag and
 * has a featured image. Dates it now (never backdate), clears the Yoast
 * indexable, purges caches, then checks from the server itself, because this
 * machine is usually behind SiteGround's captcha.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-buried.mjs --id=N --slug=the-slug
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=");
const POST_ID = Number(arg("id"));
const SLUG = arg("slug");
const TAG = "guest-perspective";
if (!POST_ID || !/^[a-z0-9-]+$/.test(SLUG)) throw new Error("need --id=N --slug=kebab-case");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
await prisma.$disconnect();
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);
if (!wp(`post term list ${POST_ID} post_tag --field=slug`).split(/\s+/).includes(TAG)) throw new Error(`post ${POST_ID} is not tagged ${TAG}; refusing to publish onto the homepage`);
if (!wp(`post meta get ${POST_ID} _thumbnail_id`)) throw new Error("no featured image");

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
wp(`post update ${POST_ID} --post_status=publish --post_name=${SLUG} --post_date_gmt=${sq(now)} --post_date=${sq(now)}`);
ssh(`cd ${sq(docroot)} && wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}" && wp cache flush && (wp sg purge >/dev/null 2>&1 || true)`);

const url = wp(`post url ${POST_ID}`);
if (!/^https:\/\/smartsme\.co\.uk\/[a-z0-9-]+\/$/.test(url)) throw new Error(`live URL looks wrong: "${url}"`);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(url)}`);
const home = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://smartsme.co.uk/'`);
const captcha = /SG-Captcha|Robot Challenge/i.test(home);
console.log(JSON.stringify({
  id: POST_ID, status: wp(`post get ${POST_ID} --field=post_status`), url,
  articleServes: page.length > 20000 && !/SG-Captcha|Robot Challenge/i.test(page),
  homepageCaptcha: captcha, homepageSlugHits: (home.match(new RegExp(SLUG, "g")) || []).length,
}, null, 2));
console.log(captcha ? "homepage check was challenged from the server; recheck shortly" : (home.includes(SLUG) ? "STILL ON HOMEPAGE" : "BURIED OK"));
