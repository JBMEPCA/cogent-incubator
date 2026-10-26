/**
 * Tell James Talbot the HARE interview is live. JB, 26 Oct 2026.
 *
 * He asked twice for a proof before publication and JB chose to publish and
 * invite corrections instead, so this says plainly that anything wrong gets
 * changed straight away rather than presenting it as settled.
 *
 * Replies in his own thread (inReplyTo + threadId). Barbering's outreach sender
 * is jb@barberingbusiness.com under JB's name, not press@.
 *
 * Not recorded as an OutreachEmail row: that table drives the backlink chase
 * sweep and he does not want chasing.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_hare-email-live.mjs [--send]
 */
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { outreachSender, sendGmail, inboundMatching } from "../lib/gmail.js";

const SEND = process.argv.includes("--send");
const URL = "https://barberingbusiness.com/in-the-chair-james-talbot-on-making-the-wash-optional/";
const HUB = "https://barberingbusiness.com/in-the-chair/";

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

const [orig] = await inboundMatching(creds.outreach, "from:hareoxford@gmail.com newer_than:3d", 5);
if (!orig) throw new Error("could not find Talbot's message to reply to");

const to = "hareoxford@gmail.com";
const toName = "James Talbot";
const subject = orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`;

const text = `Hi James,

Thanks for the photos, both came through perfectly. Your piece is live:

${URL}

The link to harestudio.co.uk is in the panel at the top and in the opening paragraph. I have used the shot of you and George as the main picture and your portrait further down, and it is leading our In the Chair series: ${HUB}

Have a proper read through. If anything is wrong, or reads in a way you are not happy with, tell me and I will change it straight away. That includes the quotes, which I have trimmed but not reworded, and the picture captions.

Thanks again for the time you put into the answers. The pricing structure in particular is the part our readers will take something from.

Best,
James`;

const html = `<p>Hi James,</p>
<p>Thanks for the photos, both came through perfectly. Your piece is live:</p>
<p><a href="${URL}">In the Chair: James Talbot on making the wash optional</a></p>
<p>The link to harestudio.co.uk is in the panel at the top and in the opening paragraph. I have used the shot of you and George as the main picture and your portrait further down, and it is leading our <a href="${HUB}">In the Chair</a> series.</p>
<p>Have a proper read through. If anything is wrong, or reads in a way you are not happy with, tell me and I will change it straight away. That includes the quotes, which I have trimmed but not reworded, and the picture captions.</p>
<p>Thanks again for the time you put into the answers. The pricing structure in particular is the part our readers will take something from.</p>
<p>Best,<br>James</p>`;

console.log(`from:    ${sender.name} <${sender.email}>`);
console.log(`to:      ${toName} <${to}>`);
console.log(`subject: ${subject}`);
console.log(`thread:  ${orig.threadId} (in reply to ${orig.messageId})`);
console.log(`\n${text}\n`);

if (!SEND) {
  console.log("-- dry run, nothing sent. add --send --");
  await prisma.$disconnect();
  process.exit(0);
}

const res = await sendGmail({
  outreach: creds.outreach,
  to,
  toName,
  subject,
  text,
  html,
  inReplyTo: orig.messageId,
  threadId: orig.threadId,
});
console.log("sent:", JSON.stringify(res));
// InterviewTarget is tenanted, so it must go through forSite(siteId).
// This update threw AFTER the Gmail send on 26 Oct and the retry sent a second
// copy. Anything that follows a send must not be able to fail the run.
try {
  await forSite(site.id).interviewTarget.update({
    where: { id: "cmvf0vcxa000j13xpp7qws6p0" },
    data: { notifiedAt: new Date() },
  });
} catch (e) {
  console.error("MAIL WAS SENT. Only the row update failed:", e.message);
}
await prisma.$disconnect();
