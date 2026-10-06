/**
 * Tell David Drew his interview is live.
 *
 * JB, 5 Oct 2026, chose the plain version: the live link and nothing about the
 * fabricated article that stood on the site under his name from 4 October until
 * it was replaced. I recommended disclosing it and he decided otherwise, which
 * is his call as publisher.
 *
 * Threaded onto his own email so it lands in the conversation he already has,
 * and sent to the address he actually wrote from (david@) rather than the
 * generic inbox the original ask went to.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_dental-drew-live-link.mjs [--send]
 */
const SEND = process.argv.includes("--send");

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const TO = "david@thedentalbarns.com";
const URL_ = "https://dentalbusinessnews.com/behind-the-mask-david-drew-the-dental-barns/";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const t = await db.interviewTarget.findFirst({ where: { company: "The Dental Barns" } });
if (t?.notifiedAt) {
  console.log(`already told on ${t.notifiedAt.toISOString()}, nothing to do`);
  await prisma.$disconnect();
  process.exit(0);
}

const body = [
  "Hi David,",
  "",
  `Your Dental Business News piece is live: ${URL_}`,
  "",
  "Thank you for the answers. The detail is what made it: the doc station and what it had to earn, the Starlink and 5G pairing, and the point about letting go of a skilled person whose values do not fit. Those are the parts I think other owners will take something from.",
  "",
  "Your link to thedentalbarns.co.uk is in the piece, as you asked.",
  "",
  `If it is useful, here is a line you are welcome to lift: "We spoke to Dental Business News about how we built The Dental Barns. ${URL_}"`,
  "",
  "Thank you again for taking part.",
  "",
  "Best,",
  outreach?.fromName || "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

const subject = "Your Dental Business News piece is live";
const [theirs] = await inboundMatching(outreach, "from:david@thedentalbarns.com newer_than:14d", 5);

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
  if (t) {
    await db.interviewTarget.update({
      where: { id: t.id },
      data: { notifiedAt: new Date(), email: TO, emailSource: "published" },
    });
  }
  console.log("sent, and notifiedAt set so the sweep will not send its own");
}

await prisma.$disconnect();
