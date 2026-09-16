/**
 * Tell Dr Mark Williams OBE his SME Leaders piece is live and will lead the
 * Smart SME homepage from Monday 21 September. JB, 16 Sep 2026: "email back
 * the guy, show him the article, and tell him this will be the main feature on
 * Monday. Email him in 30 mins".
 *
 * Built on the franchise's usual live email (share it, link from a news page)
 * with the Monday feature added, and a light ask for the investiture photo's
 * credit, since that photo arrived as a Facebook screenshot with none.
 *
 * Runs unattended on a scheduled task, so it refuses rather than guesses:
 * not published, already notified, or outside sending hours.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-mark-williams-live.mjs [--send]
 */
const SEND = process.argv.includes("--send");
const TO = "mark@limb-art.com";
const THREAD_ID = "1a05c3dd894bd528";
const IN_REPLY_TO = "<LO4P265MB3789ADCFBB588D95B80EF470E0B92@LO4P265MB3789.GBRP265.PROD.OUTLOOK.COM>";
const SUBJECT = "RE: Seven questions for Limb-art";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail } = await import("../lib/gmail.js");
const { htmlise, nextSendableTime } = await import("../lib/interviews.js");
const { stripEmDashes } = await import("../lib/drafting.js");

const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "limb-art.com" } });
const url = target.publishedUrl;
const sender = creds?.outreach?.fromName || "James Burke";

const text = stripEmDashes(
  [
    "Hi Mark,",
    "",
    "Thank you again for such brilliant answers. Your piece is now live on Smart SME:",
    url,
    "",
    "It will also be the main feature on the Smart SME homepage from Monday 21 September.",
    "",
    "Two things that would help, both of them thirty seconds:",
    "",
    `1. Share it. If it is useful, here is a line you are welcome to lift: "We spoke to Smart SME about how we built LIMB-art. ${url}"`,
    "2. If you keep a news or press page, a link to it from there is genuinely valuable to us, and it is the only thing I will ask you for.",
    "",
    "Thank you for the photos too. The one from your investiture sits alongside what you said about the OBE, and if you know who took it, send me their name and I will add the credit.",
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

const res = await sendGmail({ outreach: creds.outreach, to: TO, toName: "Mark Williams", subject: SUBJECT, text, html: htmlise(text), inReplyTo: IN_REPLY_TO, threadId: THREAD_ID });
await db.interviewTarget.update({ where: { id: target.id }, data: { notifiedAt: new Date(), email: TO } });
console.log(`SENT: gmail id ${res.id}, thread ${res.threadId}. notifiedAt set.`);
await prisma.$disconnect();
