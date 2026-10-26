/**
 * Reply to Emma Mugizi at MPS. The crop is already fixed and live.
 *
 * Her attachment came through as a screenshot of our own page rather than a
 * replacement photograph, so the reply does not thank her for a photo she may
 * not have sent. The fix came from re-cropping the original her office
 * supplied, which was a 2560x2560 full-length shot with his whole head in it.
 *
 * This is the third thing she has had to tell us in a fortnight: the wrong
 * photograph on the Gillian Leng story, the two paragraphs we added to it, and
 * now a crop. So the reply says what has changed in the system rather than
 * just apologising again, because a third apology with nothing behind it is
 * worth less than the first.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_emma-crop-reply.mjs [--send]
 */
const SEND = process.argv.includes("--send");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");

const TO = "emma.mugizi@medicalprotection.org";
const URL_ = "https://dentalbusinessnews.com/dental-protection-warns-of-ai-liability-gap-for-dentists/";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;

const body = [
  "Hello Emma,",
  "",
  "Fixed, and live now: " + URL_,
  "",
  "Dr Wright's whole head is in frame, and the picture that goes out with any share of the piece has been rebuilt too, so the old crop will not follow it around.",
  "",
  "What happened is worth telling you, because it was our fault and not the photograph's. Your office sent a tall, full-length portrait. Our article template crops every lead picture to a wide letterbox and, until this morning, it took the middle of whatever it was given. On a tall portrait the middle starts below the eyes. The photograph was fine; the machinery around it was not.",
  "",
  "I have changed that today across all ten of our titles. Lead pictures are now cropped to find the face before they are published, rather than cropped blind to the centre. I have also gone back over everything already published to catch any other picture this has happened to.",
  "",
  "Thank you for telling me, and for being specific about it. That is three things you have had to point out this month and I would rather you did not have to.",
  "",
  "Best,",
  outreach?.fromName || "James Burke",
  "Publisher, Dental Business News",
  "https://dentalbusinessnews.com",
].join("\n");

const subject = "Re: Dental Protection warns of AI liability gap for dentists";
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
