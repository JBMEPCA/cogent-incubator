/**
 * One-off, 16 Sep 2026: SME Leaders questions for Arran Turner, founder and
 * Managing Director of Sorbus Finance. Lucas Payne arranged it by email on
 * 15 Sep (Arran said yes at 14:59), so this skips the pre-ask and goes straight
 * to the questions, cc Lucas.
 *
 * Creates the InterviewTarget row at "questioned" with agreedAt set, so the
 * hourly sweep drafts the article when the answers come back under this
 * subject, and the silence nudge never fires on someone Lucas is handling.
 * Own MIME, so no List-Unsubscribe on a one-to-one mail.
 *
 * Questions are sourced from sorbusfinance.co.uk: /team (founder, MD),
 * /about/our-journey (founded Sept 2022 in Chesterfield, Moorgate Broker
 * Network, specialist hires for prestige assets, construction and fleet, new
 * office Aug 2026), /about/credit-team, and the free Business Finance Health
 * Check on the homepage.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_send-sorbus-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "Arran Turner <arran.turner@sorbusfinance.co.uk>";
const CC = "Lucas Payne <lucas@cimltd.co.uk>";
const SUBJECT = "Seven questions for Sorbus Finance";
const AGREED_AT = new Date("2026-09-15T13:59:00Z"); // 14:59 UK, his yes to Lucas

const QUESTIONS = [
  "You set up Sorbus Finance in Chesterfield in 2022. What did you see in the way small businesses were getting finance that made you want to start a brokerage?",
  "Plenty of owners still go straight to their own bank. What do they most often miss by doing that?",
  "What turns a perfectly fundable business into an application a lender says no to?",
  "You built a free finance health check for SME owners. What does it tend to show them that they did not expect?",
  "You have hired specialists for fleet, construction and prestige assets rather than generalists. Why build the team that way at your size?",
  "You moved into a new office this summer after outgrowing the last one. What has been the hardest part of growing the team?",
  "What is the one thing you would tell an owner to do six months before they need to borrow?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

const BODY = `Hi Arran,

Lucas tells me you are happy to be interviewed for SME Leaders, our series on the people building Britain's small businesses. Thank you. As he said, there is no cost and no advertising attached to it.

It is all done by email. The seven questions are below, answered in your own words. 100 to 150 words per answer is plenty, and skip any that do not suit you. If you can get them back to me by Friday 25 September, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

Please send a high resolution headshot with your answers. We will send you the live link the day it publishes.

Best,

James Burke
Publisher, Smart SME
https://smartsme.co.uk`;

if (/[—–]/.test(BODY)) {
  console.error("Dash in the copy.");
  process.exit(1);
}
const existing = await prisma.interviewTarget.findFirst({ where: { companyDomain: "sorbusfinance.co.uk" } });
if (existing && existing.questionsSentAt) {
  console.error(`Already sent (${existing.status}, ${existing.questionsSentAt.toISOString()}). Not sending again.`);
  process.exit(1);
}

const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const part = (b, type, body) =>
  [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [
  [`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Cc: ${CC}`, `Subject: ${SUBJECT}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "",
  part(b, "text/plain", BODY),
  part(b, "text/html", HTML),
  `--${b}--`,
  "",
].join("\r\n");

console.log(raw.split("\r\n\r\n")[0] + "\n\n" + BODY);
if (!SEND) {
  console.log("\nDRY RUN");
  process.exit(0);
}

const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw) }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", out?.error?.message || res.status);
  process.exit(1);
}
console.log(`\nSENT id=${out.id} thread=${out.threadId}`);

const now = new Date();
const data = {
  siteId: site.id,
  personName: "Arran Turner",
  personRole: "Managing Director, Sorbus Finance",
  company: "Sorbus Finance",
  companyDomain: "sorbusfinance.co.uk",
  newsHook: "Founded an independent commercial finance brokerage in Chesterfield in 2022 and has grown it into a specialist team. Arranged by Lucas Payne.",
  hookUrl: "https://sorbusfinance.co.uk/team",
  email: "arran.turner@sorbusfinance.co.uk",
  emailSource: "published",
  triedEmails: "arran.turner@sorbusfinance.co.uk",
  status: "questioned",
  askSubject: SUBJECT,
  askBody: BODY,
  questions: QUESTIONS.join("\n"),
  askedAt: now,
  agreedAt: AGREED_AT,
  questionsSentAt: now,
};
const row = existing
  ? await prisma.interviewTarget.update({ where: { id: existing.id }, data })
  : await prisma.interviewTarget.create({ data });
console.log("row", row.id, row.status);
await prisma.$disconnect();
