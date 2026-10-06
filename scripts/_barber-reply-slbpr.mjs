/**
 * One-off, 23 Sep 2026: tell SLB PR both LFW SS27 pieces are live.
 *
 * The desk never sent its own "you're live" reply for this release, so this is
 * the first answer Eva gets. Sends in her own thread (inReplyTo + threadId) so
 * it lands as a reply rather than a new conversation. Barbering's outreach
 * sender is jb@barberingbusiness.com under JB's name, not press@.
 *
 * Deliberately NOT recorded as an OutreachEmail row: that table drives the
 * backlink chase sweep, and Eva does not want chasing.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_barber-reply-slbpr.mjs [--send]
 */
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { outreachSender, sendGmail, inboundMatching } from "../lib/gmail.js";

const SEND = process.argv.includes("--send");

const CASSIN = "https://barberingbusiness.com/sid-da-barber-leads-hair-justin-cassin-lfw-ss27/";
const LOVEBIRDS = "https://barberingbusiness.com/danilo-giangreco-soft-glamour-lovebirds-lfw-debut/";

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

// Find her original so the reply threads properly.
const [orig] = await inboundMatching(creds.outreach, "from:slbpr.co.uk subject:LFW", 5);
if (!orig) throw new Error("could not find Eva's original message to reply to");

const to = "eva@slbpr.co.uk";
const toName = "Eva Richards";
const subject = orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`;

const text = `Hi Eva,

Thanks for sending these over. Both are live on Barbering Business. We ran them as two separate pieces so each show has its own page and its own pictures:

Sid Da Barber at Justin Cassin
${CASSIN}

Danilo Giangreco at Lovebirds
${LOVEBIRDS}

The Lovebirds images are credited to Matteo Valle as you flagged. The Justin Cassin set did not come with a photographer credit, so those are down to SLB PR for now. Happy to change that if there is a name that should be on them.

One small thing for next time: the Lovebirds Drive folder asks for a Google sign-in, while the Justin Cassin one opens straight up. If both can be set to "anyone with the link" it saves us chasing the pictures.

Thanks again,
James`;

const html = `<p>Hi Eva,</p>
<p>Thanks for sending these over. Both are live on Barbering Business. We ran them as two separate pieces so each show has its own page and its own pictures:</p>
<p><a href="${CASSIN}">Sid Da Barber at Justin Cassin</a><br>
<a href="${LOVEBIRDS}">Danilo Giangreco at Lovebirds</a></p>
<p>The Lovebirds images are credited to Matteo Valle as you flagged. The Justin Cassin set did not come with a photographer credit, so those are down to SLB PR for now. Happy to change that if there is a name that should be on them.</p>
<p>One small thing for next time: the Lovebirds Drive folder asks for a Google sign-in, while the Justin Cassin one opens straight up. If both can be set to "anyone with the link" it saves us chasing the pictures.</p>
<p>Thanks again,<br>James</p>`;

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
await prisma.$disconnect();
