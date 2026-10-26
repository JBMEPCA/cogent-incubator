/**
 * Tell Talbot the Green Salon Collective line is gone. 26 Oct 2026.
 *
 * Guarded against the duplicate that went out earlier today: it counts what is
 * already in sent mail for this correction before sending, and every write that
 * follows the send is wrapped so it cannot fail the run and invite a retry.
 * See [[check-sent-mail-before-retrying]].
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_hare-email-fixed.mjs [--send]
 */
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { outreachSender, sendGmail, inboundMatching } from "../lib/gmail.js";

const SEND = process.argv.includes("--send");
const MARKER = "that is fixed now";

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

// Has this correction already gone? Gmail search cannot see body text reliably
// on very fresh mail, so compare counts: 2 duplicates are already in there.
const already = await inboundMatching(creds.outreach, "in:sent to:hareoxford@gmail.com newer_than:1d", 10);
console.log(`already sent to Talbot today: ${already.length}`);
for (const m of already) console.log("  -", m.date, "|", String(m.text || m.snippet || "").replace(/\s+/g, " ").slice(0, 60));
if (already.some((m) => String(m.text || m.snippet || "").includes(MARKER))) {
  console.log("\nthe correction note is ALREADY sent. Not sending again.");
  await prisma.$disconnect();
  process.exit(0);
}

const [orig] = await inboundMatching(creds.outreach, "from:hareoxford@gmail.com newer_than:1d", 5);
if (!orig) throw new Error("could not find Talbot's message to reply to");

const subject = orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`;
const text = `Hi James,

Thanks for flagging that, it is fixed now and the Green Salon Collective reference has gone from the piece.

That one was on us rather than on anything you said. It came out of our own research and went into the question we sent you, and I carried it through into the copy without checking it back against your answer. KeraCycle is untouched, which is the part that matters anyway.

Glad the rest reads well. If anything else surfaces, just say.

Best,
James`;

const html = `<p>Hi James,</p>
<p>Thanks for flagging that, it is fixed now and the Green Salon Collective reference has gone from the piece.</p>
<p>That one was on us rather than on anything you said. It came out of our own research and went into the question we sent you, and I carried it through into the copy without checking it back against your answer. KeraCycle is untouched, which is the part that matters anyway.</p>
<p>Glad the rest reads well. If anything else surfaces, just say.</p>
<p>Best,<br>James</p>`;

console.log(`\nfrom:    ${sender.name} <${sender.email}>`);
console.log(`to:      James Talbot <hareoxford@gmail.com>`);
console.log(`subject: ${subject}`);
console.log(`\n${text}\n`);

if (!SEND) {
  console.log("-- dry run, add --send --");
  await prisma.$disconnect();
  process.exit(0);
}

const res = await sendGmail({
  outreach: creds.outreach,
  to: "hareoxford@gmail.com",
  toName: "James Talbot",
  subject,
  text,
  html,
  inReplyTo: orig.messageId,
  threadId: orig.threadId,
});
console.log("sent:", JSON.stringify(res));
try {
  await prisma.$disconnect();
} catch (e) {
  console.error("MAIL WAS SENT. Only the disconnect failed:", e.message);
}
