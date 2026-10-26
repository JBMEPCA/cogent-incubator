/**
 * Reply to Cosmin-Andrei Musat. The changes are already live.
 *
 * He asked carefully and he was right, so the reply says yes without hedging,
 * and says plainly which words were ours rather than letting him think he had
 * been indiscreet. It also says what stayed in and why, because a reply that
 * only agrees invites the next ask, and what stayed in is his own account of
 * what he took on, which is the reason anyone reads the piece.
 *
 * It does not offer him approval over our copy. He has not asked for that.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_musat-soften-reply.mjs [--send]
 */
const SEND = process.argv.includes("--send");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const TO = "contact@moyledentalcare.co.uk";
const URL_ = "https://dentalbusinessnews.com/behind-the-mask-cosmin-andrei-musat-moyle-dental-care/";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const body = [
  "Hi Cosmin-Andrei,",
  "",
  "Done, and it is live now: " + URL_,
  "",
  "You were right to ask, and I want to be clear that the problem was my writing rather than your answers. You stated the condition of the building once and factually. I turned that into phrases like a tired surgery and a practice winding down, put a heading on it, and added a line about it being hard to believe in 2026. None of that judgement came from you, and read together it pointed at your predecessor in a way I did not intend either. That is all out.",
  "",
  "I have also taken out the sentence of yours about the previous dentist's hours and patient numbers. It was the only line that described him rather than the premises, and it is your quote to withdraw.",
  "",
  "What I have kept is that you bought an established practice with about 400 patients, that the building and much of the equipment needed replacing, and that it was running on paper with no internet connection. That is your own account, it is the reason the piece is worth reading, and without it the growth has no explanation. It now reads as the state of a building rather than a verdict on anyone.",
  "",
  "If anything still reads wrong to you when you look at it, tell me.",
  "",
  "Best,",
  outreach?.fromName || "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

const subject = "Re: Your Dental Business News piece is live";
const [theirs] = await inboundMatching(outreach, "from:contact@moyledentalcare.co.uk newer_than:3d", 5);

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
    toName: "Cosmin-Andrei Musat",
    subject,
    text: body,
    html: htmlise(body),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  console.log("sent");
}
await prisma.$disconnect();
