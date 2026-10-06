/**
 * Publish and bury Dean Butt's Brexit piece (Smart SME post 1319).
 *
 * Bury = the guest-perspective tag, already on the draft; the child theme's
 * pre_get_posts hook drops it from every front-page query. Date is set to now
 * (never backdate, the ticker ignores the plan). Yoast indexable is cleared so
 * the sitemap and canonical pick up the published slug, caches purged, then
 * checked from the server itself because this machine is behind SiteGround's
 * captcha and a local fetch proves nothing.
 *
 * Nothing here emails Dean. That is scripts/_email-dean-brexit-live.mjs.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-dean-brexit.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 1319;
const SLUG = "brexit-what-it-cost-one-small-british-manufacturer";
const TAG = "guest-perspective";

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);
const tags = wp(`post term list ${POST_ID} post_tag --field=slug`).split(/\s+/);
if (!tags.includes(TAG)) throw new Error(`post ${POST_ID} is not tagged ${TAG}; refusing to publish onto the homepage`);
if (!wp(`post meta get ${POST_ID} _thumbnail_id`)) throw new Error("no featured image");

// Publish, dated now, clean slug.
const now = new Date().toISOString().replace("T", " ").slice(0, 19);
wp(`post update ${POST_ID} --post_status=publish --post_name=${SLUG} --post_date_gmt=${sq(now)} --post_date=${sq(now)}`);

// Yoast indexable rebuilt from the published title; caches purged.
ssh(`cd ${sq(docroot)} && wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}" && wp cache flush && (wp sg purge || true)`);

// Check from the server.
const live = JSON.parse(wp(`post get ${POST_ID} --fields=ID,post_status,post_name,post_date_gmt --format=json`));
const url = wp(`post list --post__in=${POST_ID} --post_status=publish --field=url`);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(url)}`);
const home = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://smartsme.co.uk/'`);
const checks = {
  status: live.post_status,
  dateGmt: live.post_date_gmt,
  url,
  articleServes: /Dean Butt/.test(page) && /Brexit/.test(page) && !/SG-Captcha|Robot Challenge/i.test(page),
  articleBytes: page.length,
  homepageBytes: home.length,
  homepageCaptcha: /SG-Captcha|Robot Challenge/i.test(home),
  homepageSlugHits: (home.match(new RegExp(SLUG, "g")) || []).length,
  operationsStillLeadsWith: (home.match(/cat-section--operations[\s\S]*?<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>/) || [])[1]?.trim() || "(not parsed)",
};
console.log(JSON.stringify(checks, null, 2));
if (checks.homepageCaptcha) console.log("homepage fetch was challenged even from the server; rerun the check in a minute");
else console.log(checks.homepageSlugHits === 0 ? "BURIED OK" : "STILL ON HOMEPAGE");
await prisma.$disconnect();
