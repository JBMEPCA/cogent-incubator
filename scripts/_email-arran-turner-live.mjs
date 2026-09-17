/**
 * Tell Arran Turner his SME Leaders piece is live. JB, 17 Sep 2026: "publish,
 * and send to him at 3:30pm".
 *
 * The franchise's usual live email: thanks, the link, a line to share, and the
 * one ask for a link from a news page. Threaded as a reply to his answers.
 *
 * Runs unattended on a scheduled task, so it refuses rather than guesses:
 * not published, already notified, or outside sending hours.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-arran-turner-live.mjs [--send]
 */
const SEND = process.argv.includes("--send");
const TO = "arran.turner@sorbusfinance.co.uk";
const THREAD_ID = "1a0a9400d1d7057c";
const IN_REPLY_TO = "<LO4P123MB5011C7C3F59C15E4B42713AFC0B82@LO4P123MB5011.GBRP123.PROD.OUTLOOK.COM>";
const SUBJECT = "RE: Seven questions for Sorbus Finance";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail } = await import("../lib/gmail.js");
const { htmlise, nextSendableTime } = await import("../lib/interviews.js");
const { stripEmDashes } = await import("../lib/drafting.js");

const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "sorbusfinance.co.uk" } });
const url = target.publishedUrl;
const sender = creds?.outreach?.fromName || "James Burke";

const text = stripEmDashes(
  [
    "Hi Arran,",
    "",
    "Thank you again for such thoughtful answers, and for the photo. Your piece is now live on Smart SME:",
    url,
    "",
    "Two things that would help, both of them thirty seconds:",
    "",
    `1. Share it. If it is useful, here is a line you are welcome to lift: "We spoke to Smart SME about getting a business ready to borrow. ${url}"`,
    "2. If you keep a news or press page, a link to it from there is genuinely valuable to us, and it is the only thing I will ask you for.",
    "",
    "Please pass my thanks to Lucas too.",
    "",
    "Best,",
    sender,
    "Publisher, Smart SME",
    "smartsme.co.uk",
  ].join("\n")
);

console.log(`to      : ${TO}\nsubject : ${SUBJECT}\nrow     : ${target.status} notifiedAt=${target.notifiedAt}\n\n${text}\n`);
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
if (target.status !== "published" || !url) await refuse(`row is ${target.status} with url ${url}`);
if (target.notifiedAt) await refuse(`already notified at ${target.notifiedAt.toISOString()}`);
const now = new Date();
if (nextSendableTime(now) > now) await refuse(`outside sending hours; next sendable ${nextSendableTime(now).toISOString()}`);

const res = await sendGmail({ outreach: creds.outreach, to: TO, toName: "Arran Turner", subject: SUBJECT, text, html: htmlise(text), inReplyTo: IN_REPLY_TO, threadId: THREAD_ID });
await db.interviewTarget.update({ where: { id: target.id }, data: { notifiedAt: new Date(), email: TO } });
console.log(`SENT: gmail id ${res.id}, thread ${res.threadId}. notifiedAt set.`);
await prisma.$disconnect();
