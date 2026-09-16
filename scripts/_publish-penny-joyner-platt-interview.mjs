/**
 * Publish SME Leaders: Penny Joyner-Platt (Smart SME post 1295) and tell her.
 *
 * JB, 16 Sep 2026: "publish and send to her". Same checklist as the Rob Wood
 * piece (docs/interview-format.md): publish, pin to the homepage lead for four
 * weeks, clear the Yoast indexable and caches, check it from the server, record
 * it, then send the franchise's own "your piece is live" email in her thread
 * and set notifiedAt so the hourly sweep does not send a second copy.
 *
 * Every step refuses rather than guesses: the post must still be a draft, the
 * checks must pass before the email goes, and the email refuses if she has
 * already been notified or it is outside sending hours.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-penny-joyner-platt-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 1295;
const SLUG = "sme-leaders-penny-joyner-platt-on-finding-the-real-story";
const PIN_DAYS = 28;
const TO = "penny@the-plattform.com";
const THREAD_ID = "1a08bd1650c85142";
const IN_REPLY_TO = "<LOYP123MB299032E3A15A852BA136EFD6E6BA2@LOYP123MB2990.GBRP123.PROD.OUTLOOK.COM>";
const SUBJECT = "Re: Seven questions for The Plattform";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail } = await import("../lib/gmail.js");
const { buildBacklinkAsk, htmlise, nextSendableTime } = await import("../lib/interviews.js");
const { siteUrl } = await import("../lib/site-url.js");

const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024 }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);
const db = forSite(site.id);

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "draft") throw new Error(`post ${POST_ID} is ${status}, expected draft`);

// 1. Publish, keeping the clean slug set when the draft was rebuilt.
wp(`post update ${POST_ID} --post_status=publish --post_name=${SLUG}`);

// 2. Homepage lead for four weeks. GMT, Y-m-d H:i:s. Pinning this one takes
// over from the Martyn Barklett-Judge pin, which is how the franchise rotates.
const pinUntil = new Date(Date.now() + PIN_DAYS * 864e5).toISOString().replace("T", " ").slice(0, 19);
wp(`post meta update ${POST_ID} cogent_pin_until '${pinUntil}'`);

// 3. Caches, and the Yoast indexable so the canonical and sitemap use the slug.
ssh(`cd '${docroot}' && wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}" && wp cache flush && (wp sg purge || true)`);

// 4. Check it from the server: this machine is behind SiteGround's captcha.
// `wp post url`, not `post list --post__in`, which can return nothing.
const url = wp(`post url ${POST_ID}`);
const live = JSON.parse(wp(`post get ${POST_ID} --fields=post_status,post_date_gmt --format=json`));
const content = wp(`post get ${POST_ID} --field=post_content`);
const quotes = [...content.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)].map((m) => m[1]);
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' '${url}?nocache=${Date.now()}'`);
const home = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://smartsme.co.uk/?nocache=${Date.now()}'`);
const checks = {
  status: live.post_status,
  url,
  slugOk: url.includes(SLUG),
  quotes: quotes.length,
  linksInsideQuotes: quotes.filter((q) => /<a\s/i.test(q)).length,
  imageBlock: wp(`eval 'echo has_block("core/image", ${POST_ID}) ? "yes" : "no";'`),
  pinUntil: wp(`post meta get ${POST_ID} cogent_pin_until`),
  articleServes: /Joyner-Platt/.test(page) && /interview-quote/.test(page),
  onHomepage: home.includes(SLUG),
};
console.log(JSON.stringify(checks, null, 2));
if (checks.status !== "publish" || !checks.slugOk || checks.linksInsideQuotes || !checks.articleServes) {
  throw new Error("published, but a check failed, so the email has NOT been sent. See above.");
}

// 5. Record it.
const target = await db.interviewTarget.findFirst({ where: { personName: { contains: "Penny Joyner-Platt" } } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedUrl: url, publishedAt: new Date(`${live.post_date_gmt.replace(" ", "T")}Z`) },
});
if (target.articleId) await db.article.update({ where: { id: target.articleId }, data: { status: "published", publishedAt: new Date() } });
console.log(`recorded: ${url}`);

// 6. Tell her.
const fresh = await db.interviewTarget.findFirst({ where: { id: target.id } });
const now = new Date();
if (fresh.notifiedAt) {
  console.log(`NOT SENT: already notified at ${fresh.notifiedAt.toISOString()}`);
} else if (nextSendableTime(now) > now) {
  console.log(`NOT SENT: outside sending hours; next sendable ${nextSendableTime(now).toISOString()}. The sweep will send it then.`);
} else {
  const body = buildBacklinkAsk({
    personName: fresh.personName,
    company: "The Plattform",
    titleName: site.name,
    url,
    senderName: creds?.outreach?.fromName || "James Burke",
    siteUrl: siteUrl(site),
  });
  const res = await sendGmail({ outreach: creds.outreach, to: TO, toName: fresh.personName, subject: SUBJECT, text: body, html: htmlise(body), inReplyTo: IN_REPLY_TO, threadId: THREAD_ID });
  await db.interviewTarget.update({ where: { id: target.id }, data: { notifiedAt: new Date() } });
  console.log(`\nSENT to ${TO}: gmail id ${res.id}\n\n${body}`);
}
await prisma.$disconnect();
