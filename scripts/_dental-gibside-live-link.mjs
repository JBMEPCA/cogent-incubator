/**
 * Send Gibside Dental the link to Harriet Beaty's published interview.
 *
 * JB, 2 Oct 2026: "make live then send to her at 1pm ish". The piece went live
 * at about 10:50, so this is the same note the sweep would send, sent today
 * instead of tomorrow.
 *
 * The sweep's own backlink ask waits a full day after publication
 * (runInterviewSweep step 4 skips anything newer than 86400000ms), so without
 * this it would have gone out on 3 October. Setting notifiedAt here is what
 * stops it going twice.
 *
 * Idempotent on purpose, because a scheduled task can fire more than once: if
 * notifiedAt is already set it sends nothing and says so.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_dental-gibside-live-link.mjs [--send]
 */
const SEND = process.argv.includes("--send");

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

const t = await db.interviewTarget.findFirst({ where: { company: "Gibside Dental" } });
if (!t) throw new Error("no Gibside row");
if (t.notifiedAt) {
  console.log(`already sent at ${t.notifiedAt.toISOString()}, nothing to do`);
  await prisma.$disconnect();
  process.exit(0);
}
if (!t.publishedUrl) throw new Error("no published url on the row");

const body = buildBacklinkAsk({
  personName: t.personName,
  company: t.company,
  titleName: site.name,
  url: t.publishedUrl,
  senderName: outreach?.fromName || "James Burke",
  siteUrl: siteUrl(site),
});
const subject = stripEmDashes(`Your ${site.name} piece is live`);

// Threaded onto her answers so it lands in the conversation she already has,
// rather than as a cold mail from the same address.
const [theirs] = await inboundMatching(outreach, "from:reception@gibsidedental.co.uk newer_than:14d", 5);

console.log(`to      : ${t.email}`);
console.log(`subject : ${subject}`);
console.log(`thread  : ${theirs?.threadId || "(new thread)"}`);
console.log(`\n${body}\n`);

if (!SEND) {
  console.log("--- dry run, nothing sent. add --send ---");
} else {
  await sendGmail({
    outreach,
    to: t.email,
    toName: t.personName,
    subject,
    text: body,
    html: htmlise(body),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  await db.interviewTarget.update({ where: { id: t.id }, data: { notifiedAt: new Date() } });
  console.log("sent, and notifiedAt set so the sweep will not send it again");
}

await prisma.$disconnect();
