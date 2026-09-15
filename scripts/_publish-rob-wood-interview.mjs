/**
 * Publish In the Chair: Rob Wood (Barbering Business post 662).
 *
 * JB approved the proof on 15 Sep 2026 with one change: the sign-off reads
 * "lightly edited for clarity", not "for spelling and clarity". The rest is the
 * publishing checklist in docs/interview-format.md: publish, pin to the homepage
 * lead for four weeks, clear the Yoast indexable and the caches, check it, then
 * record publishedUrl and publishedAt on the InterviewTarget row.
 *
 * Telling Rob is deliberately NOT done here. JB asked for that two hours after
 * publication, so it is scripts/_email-rob-wood-live.mjs on a scheduled task.
 * The row is left with notifiedAt null, which also means the hourly sweep's own
 * backlink ask is a fallback at 24 hours if the scheduled send never runs.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-rob-wood-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 662;
const SLUG = "in-the-chair-rob-wood-on-the-posts-that-fill-chairs";
const OLD_SIGNOFF = "Answers have been lightly edited for spelling and clarity.";
const NEW_SIGNOFF = "Answers have been lightly edited for clarity.";
const PIN_DAYS = 28;

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);

// 1. The sign-off change, made once and checked.
const content = wp(`post get ${POST_ID} --field=post_content`);
const hits = content.split(OLD_SIGNOFF).length - 1;
if (hits !== 1) throw new Error(`expected the old sign-off exactly once, found ${hits}`);
const updated = content.replace(OLD_SIGNOFF, NEW_SIGNOFF);
const stamp = Date.now();
ssh(`base64 -d > /tmp/rob-wood-final-${stamp}.html`, Buffer.from(updated, "utf8").toString("base64"));
wp(`post update ${POST_ID} /tmp/rob-wood-final-${stamp}.html`);
ssh(`rm -f /tmp/rob-wood-final-${stamp}.html`);

// 2. Publish with a clean slug. Left to itself WordPress would build one from a
// title that starts with a span and an emoji.
wp(`post update ${POST_ID} --post_status=publish --post_name=${SLUG}`);

// 3. Homepage lead for four weeks. GMT, Y-m-d H:i:s, expires on its own.
const pinUntil = new Date(Date.now() + PIN_DAYS * 864e5).toISOString().replace("T", " ").slice(0, 19);
wp(`post meta update ${POST_ID} cogent_pin_until '${pinUntil}'`);

// 4. Caches. The Yoast indexable is rebuilt from the published title; a stale
// one keeps the draft's empty slug in the sitemap and the canonical.
ssh(`cd '${docroot}' && wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}" && wp cache flush && (wp sg purge || true)`);

// 5. Check it, from the server itself: this machine is behind SiteGround's
// captcha, so a local fetch proves nothing either way.
const live = JSON.parse(wp(`post get ${POST_ID} --fields=ID,post_status,post_name,post_date_gmt --format=json`));
const url = wp(`post list --post__in=${POST_ID} --post_status=publish --field=url`);
const fresh = wp(`post get ${POST_ID} --field=post_content`);
const quotes = [...fresh.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)].map((m) => m[1]);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' '${url}'`);
const home = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://barberingbusiness.com/'`);
const checks = {
  status: live.post_status,
  url,
  signoffUpdated: fresh.includes(NEW_SIGNOFF) && !fresh.includes(OLD_SIGNOFF),
  quotes: quotes.length,
  linksInsideQuotes: quotes.filter((q) => /<a\s/i.test(q)).length,
  pinUntil: wp(`post meta get ${POST_ID} cogent_pin_until`),
  articleServes: /Rob Wood/.test(page) && /interview-quote/.test(page),
  onHomepage: home.includes(SLUG),
};
console.log(JSON.stringify(checks, null, 2));
if (checks.status !== "publish" || !checks.signoffUpdated || checks.linksInsideQuotes) {
  throw new Error("post published but a check failed, see above");
}

// 6. Record it. notifiedAt stays null until the scheduled email goes.
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { personName: "Rob Wood" } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedUrl: url, publishedAt: new Date(`${live.post_date_gmt.replace(" ", "T")}Z`) },
});
await prisma.$disconnect();
console.log(`recorded: ${url}`);
