/**
 * Thank Penny Joyner-Platt for her SME Leaders answers. JB, 16 Sep 2026:
 * "do this seven questions for Smart SME and reply".
 *
 * A thank-you only. The piece is still a draft awaiting JB's go, so this
 * promises the link when it is live and nothing more specific than that. The
 * "your piece is live" email follows publication, as for every subject.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-penny-thanks.mjs --email=<penny-email.json> [--send]
 */
import fs from "node:fs";

const SEND = process.argv.includes("--send");
const EMAIL_JSON = (process.argv.find((a) => a.startsWith("--email=")) || "").split("=")[1];
const src = JSON.parse(fs.readFileSync(EMAIL_JSON, "utf8"));

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail } = await import("../lib/gmail.js");
const { htmlise } = await import("../lib/interviews.js");
const { stripEmDashes } = await import("../lib/drafting.js");

const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = creds?.outreach?.fromName || "James Burke";

const subject = /^re:/i.test(src.subject) ? src.subject : `Re: ${src.subject}`;
const text = stripEmDashes(
  [
    "Hi Penny,",
    "",
    "Thank you, these are brilliant. Some of the most useful answers we have had, and the point about the real story sitting three questions underneath is one every founder should hear.",
    "",
    "I am writing it up now and will send you the link as soon as it is live. Thank you for the photos too.",
    "",
    "Best,",
    sender,
    "Publisher, Smart SME",
    "smartsme.co.uk",
  ].join("\n")
);

console.log(`to      : ${src.fromEmail}\nsubject : ${subject}\nthread  : ${src.threadId}\n\n${text}\n`);
if (!SEND) {
  console.log("DRY RUN: nothing sent.");
  await prisma.$disconnect();
  process.exit(0);
}
const res = await sendGmail({
  outreach: creds.outreach,
  to: src.fromEmail,
  toName: "Penny Joyner-Platt",
  subject,
  text,
  html: htmlise(text),
  inReplyTo: src.messageId,
  threadId: src.threadId,
});
console.log(`SENT: gmail id ${res.id}, thread ${res.threadId}`);
await prisma.$disconnect();
