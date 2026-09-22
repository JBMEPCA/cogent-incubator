/**
 * One-off, 22 Sep 2026: Nursery Leaders questions for Tim McLachlan, chief
 * executive of the National Day Nurseries Association, sent to Rosey James
 * (NDNA PR and Policy Manager), cc Christopher Jackson (her colleague) and
 * Lucas Payne, who arranged it. Rosey said yes to Lucas at 12:17 UK and offered
 * dates; JB asked for an email explaining it is all by email, with the
 * questions.
 *
 * Also names the Nursery Daily interview series. Until this, Nursery Daily had
 * no `interview_franchise` setting and the sweep falls back to "SME Leaders",
 * so Tim's answers would have been drafted under Smart SME's franchise name.
 *
 * Creates the InterviewTarget row at "questioned" with agreedAt set, so the
 * hourly sweep drafts the article when the answers come back under this
 * subject, and the silence nudge never fires on someone Lucas is handling.
 * Own MIME for the cc list.
 *
 * Questions sourced from: ndna.org.uk (new chief executive from 31 Mar 2025,
 * previously IFST and the Natasha Allergy Research Foundation; Millie's Mark
 * tenth anniversary; UK-wide remit), and NMT, 12 Feb 2026 (business rates
 * letter to the Chancellor: average nursery pays £21,034 a year, exempt in
 * Scotland and Wales, government funding around 80% of nursery income).
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-ndna-questions.mjs [--send]
 */
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "Rosey James <rosey.james@ndna.org.uk>";
const CC = "Christopher Jackson <Christopher.Jackson@ndna.org.uk>, Lucas Payne <lucas@cimltd.co.uk>";
const SUBJECT = "Seven questions for NDNA";
const AGREED_AT = new Date("2026-09-22T11:17:00Z"); // 12:17 UK, Rosey's yes to Lucas
const FRANCHISE = "Nursery Leaders";

const QUESTIONS = [
  "You became chief executive of NDNA in March 2025 after leading the Institute of Food Science and Technology and the Natasha Allergy Research Foundation. What did you bring with you from outside early years, and what surprised you most once you arrived?",
  "Government funding now makes up around 80% of a typical nursery's income. What does that dependence change about how an owner has to run the business?",
  "You have told the Chancellor that business rates are not fit for purpose for nurseries in England, where the average setting pays £21,034 a year and nurseries in Scotland and Wales pay nothing. What would an exemption actually change for a nursery on the ground?",
  "What are the nurseries that recruit and keep good staff doing differently from the rest?",
  "NDNA works across England, Scotland, Wales and Northern Ireland, and the funding systems now look very different in each. What could each nation learn from the others?",
  "Millie's Mark, the paediatric first aid accreditation, has just marked its tenth anniversary. What has it changed in nurseries, and what should an owner thinking about it know?",
  "What is the one piece of advice you would give someone opening or buying their first nursery today?",
];

const { prisma, forSite } = await import("../lib/prisma.js");
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const db = forSite(site.id);

const BODY = `Hi Rosey,

Thank you for saying yes to Lucas, and I am delighted Tim is happy to take part. I am the publisher of Nursery Daily, our business title for the people who run nurseries across the UK, and the interview will run in Nursery Leaders, our series on the people shaping the sector.

There is no need to find a date, because the whole thing is done by email and it is very easy:

1. Tim answers the seven questions below in his own words. 100 to 150 words per answer is plenty, and he can skip any that do not suit him.
2. You send the answers back by replying to this email, with a high resolution photo of Tim we are free to use.
3. We write the piece around his answers, using his words as he gave them, lightly edited for clarity only, and send you the live link the day it publishes.

There is no cost and no advertising attached to it. If you can get the answers back to me by Friday 2 October, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

Any questions at all, just reply here.

Best,

James Burke
Publisher, Nursery Daily
https://nurserydaily.com`;

if (/[—–]/.test(BODY)) {
  console.error("Dash in the copy.");
  process.exit(1);
}
const existing = await db.interviewTarget.findFirst({ where: { companyDomain: "ndna.org.uk" } });
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
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
console.log(`\ngmail.send token for ${sender.email}: ${token ? "ok" : "MISSING"}`);
if (!SEND) {
  console.log("DRY RUN");
  await prisma.$disconnect();
  process.exit(0);
}

// Name the series first, so nothing drafted from this reply can land under
// another title's franchise.
await db.engineSetting.upsert({
  where: { key: "interview_franchise" },
  update: { value: FRANCHISE },
  create: { siteId: site.id, key: "interview_franchise", value: FRANCHISE },
});

const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  personName: "Tim McLachlan",
  personRole: "Chief Executive, National Day Nurseries Association",
  company: "National Day Nurseries Association",
  companyDomain: "ndna.org.uk",
  newsHook: "Chief executive of NDNA since March 2025; campaigning on business rates and funding for PVI nurseries. Arranged by Lucas Payne via Rosey James (PR and Policy Manager), who handles the reply.",
  hookUrl: "https://ndna.org.uk/new-incoming-chief-executive-for-ndna/",
  email: "rosey.james@ndna.org.uk",
  emailSource: "published",
  triedEmails: "rosey.james@ndna.org.uk",
  status: "questioned",
  askSubject: SUBJECT,
  askBody: BODY,
  questions: QUESTIONS.join("\n"),
  askedAt: now,
  agreedAt: AGREED_AT,
  questionsSentAt: now,
};
const row = existing
  ? await db.interviewTarget.update({ where: { id: existing.id }, data })
  : await db.interviewTarget.create({ data });
console.log("row", row.id, row.status, "| franchise:", (await db.engineSetting.findUnique({ where: { key: "interview_franchise" } }))?.value);
await prisma.$disconnect();
