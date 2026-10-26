/**
 * Reply to Emma Mugizi at MPS. Both paragraphs are already off the article.
 *
 * She was right on the merits, not just on message discipline. Those two
 * paragraphs raised a doubt nobody had raised: whether a change of President
 * alters membership terms, discretionary benefits or indemnity. Nothing in the
 * release suggested it, and inventing the question then answering "nothing to
 * action" leaves the question hanging behind. That is our "what this means for
 * owners" habit firing on a story that does not have one.
 *
 * So the reply agrees because the copy was wrong, and does not offer her a
 * standing right of approval over what we publish. The photograph is mentioned
 * because her office supplied one and we ran a stock image of a stranger until
 * this morning, which she will see if she looks.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_mps-emma-reply.mjs [--send]
 */
const SEND = process.argv.includes("--send");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const TO = "emma.mugizi@medicalprotection.org";
const URL_ = "https://dentalbusinessnews.com/gillian-leng-becomes-president-of-medical-protection-society/";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const body = [
  "Hello Emma,",
  "",
  "Both paragraphs are removed. The article is updated and live now: " + URL_,
  "",
  "You were right to flag them. They raised a question your release never raised, about whether a change of President affects membership terms or indemnity, and then answered it with nothing to action, which leaves the question hanging about regardless. That was our editing, not your announcement, and it should not have run.",
  "",
  "One other thing you may have noticed and should know about. Your release came with a photograph of Professor Leng attached, and for the first hour this morning we published it with the wrong image. That is corrected and her photograph is on it now.",
  "",
  "Please do keep sending releases. We cover appointments, results, research and policy for dental practice owners and managers, and we link to the organisation on every piece.",
  "",
  "Thank you for telling me rather than leaving it.",
  "",
  "Best,",
  outreach?.fromName || "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

const subject = "Re: Gillian Leng named as new Medical Protection Society President";
const [theirs] = await inboundMatching(outreach, "from:emma.mugizi@medicalprotection.org newer_than:3d", 5);

console.log(`to      : ${TO}`);
console.log(`subject : ${subject}`);
console.log(`thread  : ${theirs?.threadId || "(new thread)"}`);
console.log(`\n${body}\n`);

if (!SEND) {
  console.log("--- dry run, nothing sent. add --send ---");
} else {
  await sendGmail({
    outreach,
    to: TO,
    toName: "Emma Mugizi",
    subject,
    text: body,
    html: htmlise(body),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  console.log("sent");
}
await prisma.$disconnect();
