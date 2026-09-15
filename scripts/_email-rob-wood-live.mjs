/**
 * Tell Rob Wood his In the Chair piece is live. JB, 15 Sep 2026: publish now,
 * send to him two hours later.
 *
 * The copy is the franchise's own notification, buildBacklinkAsk, so it asks
 * for the same two things every subject is asked for: a share and a link from
 * their news page. Sent as a reply in Rob's own thread ("7 Questions -Rob
 * Wood") to the address he wrote from, rob@novocabelo.co.uk, rather than to the
 * support@ inbox the questions originally went to.
 *
 * Guards, because this runs unattended on a scheduled task:
 *   - refuses unless the row is published with a live URL
 *   - refuses if notifiedAt is already set, so it can never send twice, and
 *     setting it stops the hourly sweep sending its own copy at 24 hours
 *   - refuses outside sending hours rather than landing late at night
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-rob-wood-live.mjs [--send]
 */
const SEND = process.argv.includes("--send");
const TO = "rob@novocabelo.co.uk";
const THREAD_ID = "1a0a42e18b5d2bb1";
const IN_REPLY_TO = "<E37E10CC-0760-4767-8A27-D62A95346C25@novocabelo.co.uk>";
const SUBJECT = "Re: 7 Questions -Rob Wood";
// The row's company is "Novo Cabelo HQ", the awards listing's name for it. The
// business calls itself Novo Cabelo, and that is what the share line should say.
const COMPANY = "Novo Cabelo";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail } = await import("../lib/gmail.js");
const { buildBacklinkAsk, htmlise, nextSendableTime } = await import("../lib/interviews.js");
const { siteUrl } = await import("../lib/site-url.js");

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { personName: "Rob Wood" } });

const body = buildBacklinkAsk({
  personName: target.personName,
  company: COMPANY,
  titleName: site.name,
  url: target.publishedUrl,
  senderName: creds?.outreach?.fromName || "James Burke",
  siteUrl: siteUrl(site),
});

console.log(`to      : ${TO}\nsubject : ${SUBJECT}\nstatus  : ${target.status}  notifiedAt=${target.notifiedAt}\n\n${body}\n`);

if (!SEND) {
  console.log("DRY RUN: nothing sent. Add --send to send.");
  await prisma.$disconnect();
  process.exit(0);
}

const refuse = async (why) => {
  console.error(`NOT SENT: ${why}`);
  await prisma.$disconnect();
  process.exit(1);
};
if (target.status !== "published" || !target.publishedUrl) await refuse(`row is ${target.status} with url ${target.publishedUrl}`);
if (target.notifiedAt) await refuse(`already notified at ${target.notifiedAt.toISOString()}`);
const now = new Date();
if (nextSendableTime(now) > now) await refuse(`outside sending hours; next sendable ${nextSendableTime(now).toISOString()}`);

const res = await sendGmail({
  outreach: creds.outreach,
  to: TO,
  toName: target.personName,
  subject: SUBJECT,
  text: body,
  html: htmlise(body),
  inReplyTo: IN_REPLY_TO,
  threadId: THREAD_ID,
});
await db.interviewTarget.update({ where: { id: target.id }, data: { notifiedAt: new Date(), email: TO } });
console.log(`SENT: gmail id ${res.id}, thread ${res.threadId}. notifiedAt set.`);
await prisma.$disconnect();
