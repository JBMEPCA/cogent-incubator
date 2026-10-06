/**
 * Answer David Drew. He spotted the LinkedIn post and asked twice.
 *
 * JB, 5 Oct 2026: "that post is deleted, work it out, email him". He had
 * earlier decided not to volunteer the error; David has now raised it himself,
 * so that decision is overtaken and the only option left is a straight answer.
 *
 * What he saw: a LinkedIn post of 4 Oct 13:05, generated from an article the
 * engine wrote without using his answers. It put the practice in Hampshire,
 * said he had never hired a practice manager when he is the practice manager,
 * and attributed salary figures to him that he never gave. The post is deleted
 * and the article was replaced this morning with one built only from his email.
 *
 * Threaded onto his message. No marketing, no share request: he is owed an
 * answer, not an ask.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_dental-drew-correction.mjs [--send]
 */
const SEND = process.argv.includes("--send");

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const TO = "david@thedentalbarns.com";
const URL_ = "https://dentalbusinessnews.com/behind-the-mask-david-drew-the-dental-barns/";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const body = [
  "Hi David,",
  "",
  "You are right, and I am sorry. That post was wrong and it should never have gone out.",
  "",
  "It said you were in rural Hampshire, that you had never hired a practice manager, and it put salary figures in your mouth that you never gave me. You are in Lichfield, you are the practice manager, and those numbers came from nowhere. I have deleted it.",
  "",
  "What happened is that a draft was generated automatically from our original approach to you, before your answers were read, and it published and posted itself over the weekend without me seeing it. That is our failure and our process, not anything you did or said.",
  "",
  `The article on the site has been replaced. It is built only from the answers you sent me, every quote is your own words, and it is here: ${URL_}`,
  "",
  "Please do look at it, and if anything in it is still not right, tell me and I will change it or take it down, whichever you prefer. Your link to thedentalbarns.co.uk is in it, as you asked.",
  "",
  "You gave up real time to answer seven questions properly and you deserved better than this. Thank you for telling me rather than leaving it.",
  "",
  "Best,",
  outreach?.fromName || "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

const subject = "Re: Your Dental Business News piece is live";
const [theirs] = await inboundMatching(outreach, "from:david@thedentalbarns.com newer_than:3d", 5);

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
    toName: "David Drew",
    subject,
    text: body,
    html: htmlise(body),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  console.log("sent");
}

await prisma.$disconnect();
