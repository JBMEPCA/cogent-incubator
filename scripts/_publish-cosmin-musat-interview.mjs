/**
 * Publish the Behind the Mask interview with Dr Cosmin-Andrei Musat and send
 * him the link. JB, 14 Oct 2026: "publish and send".
 *
 * The draft is post 278, reworked this morning by
 * _build-cosmin-musat-interview.mjs over a sweep draft that had invented the
 * town, the year, every quotation and two suppliers. Because of that history
 * this script re-checks the body on the server immediately before publishing
 * rather than trusting that what I wrote is what is sitting there: the whole
 * failure mode on this title has been something publishing that nobody looked
 * at at the moment it went out.
 *
 * Published by hand through wp-cli, not through the app's publish path, so
 * nothing fans out to LinkedIn or Instagram on its own. The Drew article
 * auto-posted to LinkedIn while it was still fabricated, and after that the
 * social bridge on a person story is JB's call, not a side effect.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-cosmin-musat-interview.mjs [--apply] [--send]
 *
 *   --apply   publish the post
 *   --send    email him the live link (requires the post to be live)
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const SEND = process.argv.includes("--send");

const POST_ID = 278;
const ARTICLE_ID = "cmv6w0dja00017etb9do1fz4a";
const TARGET_ID = "cmv5149en001510pgljvfx2k7";
const SLUG = "behind-the-mask-cosmin-andrei-musat-moyle-dental-care";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { buildBacklinkAsk, htmlise } = await import("../lib/interviews.js");
const { stripEmDashes } = await import("../lib/drafting.js");
const { siteUrl } = await import("../lib/voice.js");

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;
const s = creds.sftp;

const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd) =>
  execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

// ---- look at what is actually on the server before publishing it ----------
const bodyB64 = ssh(`cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content | base64 -w0`);
const body = Buffer.from(bodyB64, "base64").toString("utf8");
const status = wp(`post get ${POST_ID} --field=post_status`);
const slug = wp(`post get ${POST_ID} --field=post_name`);
const thumb = wp(`post meta get ${POST_ID} _thumbnail_id`);

const problems = [];
// Publishing expects a draft; a send-only run expects it already live. Either
// way the body below is re-checked, because the point of this block is the
// copy and not the status.
const expected = APPLY ? "draft" : "publish";
if (status !== expected) problems.push(`post is ${status}, expected ${expected}`);
if (slug !== SLUG) problems.push(`slug is ${slug}`);
if (!thumb || thumb === "0") problems.push("no featured image");
if (/Ballycastle/i.test(body)) problems.push("the sweep's wrong town is in the body");
for (const ghost of ["Dentally", "Practice Plan", "Patient Plan Direct", "DPAS", "Simplyhealth", "Kiroku", "Carestream"])
  if (new RegExp(ghost, "i").test(body)) problems.push(`invented supplier in the body: ${ghost}`);
const quotes = (body.match(/<blockquote/g) || []).length;
if (quotes !== 13) problems.push(`${quotes} blockquotes, expected 13`);
if (!/Larne/.test(body)) problems.push("Larne not in the body");
if (!/moyledentalcare\.co\.uk/.test(body)) problems.push("his backlink is gone");

console.log(`status ${status} · slug ${slug} · featured image ${thumb} · ${quotes} quotes · ${body.length} chars`);
if (problems.length) {
  console.error("REFUSING TO PUBLISH:");
  for (const p of problems) console.error("  -", p);
  await prisma.$disconnect();
  process.exit(1);
}
console.log("server copy checked: right town, no invented suppliers, photograph attached");

if (!APPLY && !SEND) {
  console.log("DRY RUN, nothing published. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

// ---- publish -------------------------------------------------------------
let url = null;
if (APPLY) {
  // Dated now rather than keeping yesterday's draft timestamp, so it leads the
  // homepage instead of arriving already a day old.
  const local = ssh(`TZ=Europe/London date '+%Y-%m-%d %H:%M:%S'`);
  const gmt = ssh(`date -u '+%Y-%m-%d %H:%M:%S'`);
  wp(`post update ${POST_ID} --post_status=publish --post_date=${sq(local)} --post_date_gmt=${sq(gmt)}`);
  ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`);
  url = wp(`post url ${POST_ID}`);
  console.log(`\npublished: ${wp(`post get ${POST_ID} --field=post_status`)} at ${local} UK`);
  console.log(`url      : ${url}`);

  await db.article.update({
    where: { id: ARTICLE_ID },
    data: { status: "published", publishedAt: new Date() },
  });
  await db.interviewTarget.update({
    where: { id: TARGET_ID },
    data: { status: "published", publishedUrl: url, publishedAt: new Date() },
  });
  console.log("article and interview rows marked published");
}

// ---- send ----------------------------------------------------------------
if (SEND) {
  const t = await db.interviewTarget.findUnique({ where: { id: TARGET_ID } });
  if (t.notifiedAt) {
    console.log(`already sent at ${t.notifiedAt.toISOString()}, nothing to do`);
    await prisma.$disconnect();
    process.exit(0);
  }
  if (!t.publishedUrl) throw new Error("no published url on the row, publish first");

  const text = buildBacklinkAsk({
    personName: t.personName,
    company: t.company,
    titleName: site.name,
    url: t.publishedUrl,
    senderName: outreach?.fromName || "James Burke",
    siteUrl: siteUrl(site),
  });
  const subject = stripEmDashes(`Your ${site.name} piece is live`);

  // Threaded onto his own reply so it lands in the conversation he is already
  // in, rather than as a fresh mail from the same address.
  const [theirs] = await inboundMatching(outreach, "from:contact@moyledentalcare.co.uk newer_than:7d", 5);

  console.log(`\nto      : ${t.email}`);
  console.log(`subject : ${subject}`);
  console.log(`thread  : ${theirs?.threadId || "(new thread)"}`);
  console.log(`\n${text}\n`);

  await sendGmail({
    outreach,
    to: t.email,
    toName: t.personName,
    subject,
    text,
    html: htmlise(text),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { notifiedAt: new Date() } });
  console.log("sent, and notifiedAt set so the sweep will not send it again");
}

await prisma.$disconnect();
