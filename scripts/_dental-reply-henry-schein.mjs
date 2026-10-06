/**
 * Reply to Aarti Sareen at Henry Schein UK, who asked for our deadline.
 *
 * She answered the Behind the Mask questions sent to Vikki Goodall on 25 Sep.
 * The row is "questioned", which is the status the nudge fires on: seven or
 * eight days after questionsSentAt it would have written to Henry Schein on 2
 * or 3 October saying the questions may have gone astray and that there is no
 * deadline, which is wrong twice over and would have gone to the customer
 * services inbox rather than to Aarti. So this also repoints the row at her
 * and marks the chase used.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_dental-reply-henry-schein.mjs [--send]
 */
const SEND = process.argv.includes("--send");

// forSite, not prisma, for InterviewTarget: the tenant guard rejects an
// unscoped query on it, and the first run of this script sent the mail and then
// threw on the row update.
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const [msg] = await inboundMatching(outreach, "from:Aarti.Sareen@henryschein.co.uk newer_than:14d", 5);
if (!msg) throw new Error("Aarti's message was not found in the mailbox");

const body = [
  "Hi Aarti,",
  "",
  "Thank you, and a straight answer on timing.",
  "",
  "If the answers can reach me by Tuesday 6 October, I will run the piece during Dentistry Show London on 9 and 10 October, when the readership for it is at its largest. If the internal review needs longer than that, Friday 24 October works just as well and nothing is lost by taking it.",
  "",
  "Two things worth saying plainly, because they are usually the next questions. There is no cost and no advertising attached: this is an editorial feature and nothing is being sold. And there is no need to answer all seven. Four good answers make a better piece than seven short ones, and anything Henry Schein would rather not put a number on can simply be skipped.",
  "",
  "The questions went to Vikki Goodall, but I am glad to take them from whoever is best placed to answer, or from more than one person if that suits you better. If writing them up is the awkward part, I can do it as a twenty minute call instead and send the answers back to you as they will appear, so you can check we have not misread anything.",
  "",
  "If you can include a photograph of whoever answers and the exact job title they want used, I will use those. I will send you the live link on the day it publishes.",
  "",
  "Best,",
  "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

console.log(`to      : ${msg.from}`);
console.log(`subject : Re: Seven questions for Henry Schein UK`);
console.log(`thread  : ${msg.threadId}`);
console.log(`\n${body}\n`);

if (!SEND) {
  console.log("--- dry run, nothing sent. Add --send ---");
} else {
  const res = await sendGmail({
    outreach,
    to: "Aarti.Sareen@henryschein.co.uk",
    toName: "Aarti Sareen",
    subject: "Re: Seven questions for Henry Schein UK",
    text: body,
    html: htmlise(body),
    inReplyTo: msg.messageId,
    threadId: msg.threadId,
  });
  console.log(`sent, message ${res.id} in thread ${res.threadId}`);

  const target = await db.interviewTarget.findFirst({ where: { personName: "Vikki Goodall" } });
  await db.interviewTarget.update({
    where: { id: target.id },
    data: {
      email: "Aarti.Sareen@henryschein.co.uk",
      emailSource: "published",
      triedEmails: [target.triedEmails, "Aarti.Sareen@henryschein.co.uk"].filter(Boolean).join("\n"),
      replyBody: msg.body.slice(0, 60000),
      // Not a chase, a stop. The conversation is live and answered, and the
      // nudge copy would contradict the deadline this mail just gave.
      followUpSentAt: new Date(),
    },
  });
  console.log("row repointed at Aarti and the automatic nudge suppressed");
}

await prisma.$disconnect();
