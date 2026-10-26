/**
 * One-off, 22 Oct 2026: SME Leaders questions for Lisa Morris, owner of Wye
 * Knot, an independent gift and card shop in Builth Wells. Pitched by Ian
 * Morris on her behalf on 21 Oct (cc Lisa), and JB said send the questions,
 * so this skips the pre-ask. To Lisa, cc Ian.
 *
 * The subject carries the company name so the sweep's matchTarget finds her
 * reply whichever of them sends it. Creates the InterviewTarget row at
 * "questioned" with agreedAt set.
 *
 * Facts are from Ian's pitch only: opened 29 June 2026, online shop mid-August,
 * no previous retail experience, Highland cows outsold Welsh sheep and dragons,
 * 65 greeting card designs added, Welsh birthday cards popular.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-wye-knot-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "Lisa Morris <lisa@wye-knot.co.uk>";
const CC = "Ian Morris <ianmorriswebdesign@gmail.com>";
const SUBJECT = "Seven questions for Wye Knot";
const AGREED_AT = new Date("2026-10-21T15:56:33Z"); // Ian's pitch, cc Lisa

const QUESTIONS = [
  "You opened Wye Knot in Builth Wells on 29 June with no previous retail experience. What made you take the leap, and what surprised you most in the first few weeks?",
  "You expected Welsh sheep and dragon gifts to lead sales, but Highland cow products sold more strongly. When did you notice, and what did you change as a result?",
  "Now that you have real sales to go on, how do you decide what to reorder, what to try and what to drop?",
  "Every new shop has to balance buying enough stock against keeping money back for reorders. How have you handled that, and what would you do differently?",
  "You have added 65 greeting card designs, and Welsh birthday cards are especially popular. Why lean into cards, and what have they done for the shop?",
  "You launched an online shop in mid-August, alongside the physical one. What works differently online, and has it been worth the effort so far?",
  "What would you tell someone opening their first shop next year, and what is next for Wye Knot?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

const BODY = `Hi Lisa,

Thank you to Ian for getting in touch. Yes, Wye Knot is a great fit for SME Leaders, our series on the people building Britain's small businesses. There is no cost and no advertising attached to it.

It is all done by email. The seven questions are below, answered in your own words. 100 to 150 words per answer is plenty, and skip any that do not suit you. If you can get them back to me by Friday 30 October, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

Please send a high resolution photo of yourself with your answers, ideally in the shop, plus a picture of the shop front if you have one. We will send you the live link the day it publishes.

Best,

James Burke
Publisher, Smart SME
https://smartsme.co.uk`;

if (/[—–]/.test(BODY)) {
  console.error("Dash in the copy.");
  process.exit(1);
}
const existing = await prisma.interviewTarget.findFirst({ where: { companyDomain: "wye-knot.co.uk" } });
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
  personName: "Lisa Morris",
  personRole: "Owner, Wye Knot",
  company: "Wye Knot",
  companyDomain: "wye-knot.co.uk",
  newsHook: "First-time retailer who opened an independent gift and card shop in Builth Wells on 29 June 2026 and found Highland cows outsold the Welsh gifts she expected to lead. Pitched by Ian Morris on her behalf.",
  hookUrl: "https://wye-knot.co.uk/",
  email: "lisa@wye-knot.co.uk",
  emailSource: "published",
  triedEmails: "lisa@wye-knot.co.uk",
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
