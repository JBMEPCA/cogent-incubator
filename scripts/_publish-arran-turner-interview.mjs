/**
 * Publish SME Leaders: Arran Turner, Sorbus Finance (Smart SME post 1367).
 *
 * JB, 17 Sep 2026: "publish, and send to him at 3:30pm". Not pinned: the
 * homepage lead stays with the existing pins. The theme adds the piece to the
 * SME Leaders hub and sidebar card by itself once it is published.
 *
 * The email is its own script on a scheduled task. notifiedAt stays null here.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-arran-turner-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 1367;
const SLUG = "sme-leaders-arran-turner-on-getting-ready-to-borrow";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024 }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);

wp(`post update ${POST_ID} --post_status=publish --post_name=${SLUG}`);
ssh(`cd '${docroot}' && wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}" && wp cache flush && (wp sg purge || true)`);

const url = wp(`post url ${POST_ID}`);
const live = JSON.parse(wp(`post get ${POST_ID} --fields=post_status,post_date_gmt --format=json`));
const content = wp(`post get ${POST_ID} --field=post_content`);
const quotes = [...content.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)].map((m) => m[1]);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' '${url}?nocache=${Date.now()}'`);
const home = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://smartsme.co.uk/?nocache=${Date.now()}'`);
// The title markup rule: after every interview publish, no escaped eyebrow on
// the article or the homepage, including share links.
const LEAK = /&lt;span class=&quot;franchise-eyebrow|%3Cspan%20class%3D|&amp;lt;span class=/i;
const checks = {
  status: live.post_status,
  url,
  quotes: quotes.length,
  linksInsideQuotes: quotes.filter((q) => /<a\s/i.test(q)).length,
  articleServes: /Arran Turner/.test(page) && /interview-quote/.test(page),
  escapedTitleOnArticle: LEAK.test(page),
  escapedTitleOnHomepage: LEAK.test(home),
  pinnedNow: ssh(`cd '${docroot}' && (wp post meta get ${POST_ID} cogent_pin_until || echo none)`),
  inLeadersHub: ssh(`cd '${docroot}' && wp eval 'echo in_array(${POST_ID}, wp_list_pluck(cogent_leaders(), "ID")) ? "yes" : "no";'`),
};
console.log(JSON.stringify(checks, null, 2));
if (checks.status !== "publish" || checks.linksInsideQuotes || !checks.articleServes || checks.escapedTitleOnArticle) {
  throw new Error("published, but a check failed. See above.");
}

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "sorbusfinance.co.uk" } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedUrl: url, publishedAt: new Date(`${live.post_date_gmt.replace(" ", "T")}Z`) },
});
await prisma.$disconnect();
console.log(`recorded: ${url}`);
