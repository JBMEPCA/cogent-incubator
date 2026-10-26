/**
 * One-off, 22 Oct 2026: SME Leaders questions for Molly Edgecombe, founder of
 * Strategy Studio (email marketing). She pitched herself from
 * team@strategy-studio.co.uk (the mailbox shows as Nick Patrozos) at 15:08 UK;
 * JB said send her questions. Replies in her thread and creates the
 * InterviewTarget row at "questioned" so the sweep matches the answers by domain.
 *
 * Facts from her pitch only: years inside brands running content, email and
 * customer journeys; five Christmas emails made £17,853 for one small brand;
 * another client's attributed revenue up 1,409% in month one after flows were
 * fixed (strategy-studio.co.uk/client-results). Clients anonymised.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-strategy-studio-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "team@strategy-studio.co.uk";
const THREAD_QUERY = `from:${TO} newer_than:2d`;

const QUESTIONS = [
  "You spent years inside brands running content, email and customer journeys. What did you keep seeing that made you build a studio around the email journey rather than more content?",
  "You talk about talented owners who show up online and still do not get consistent customers. Where does it usually break down between someone seeing a post and actually buying?",
  "Five Christmas emails made £17,853 for one small brand. What was in those emails, and what would most owners have done differently?",
  "Another client's attributed revenue rose 1,409% in the first month once their flows were fixed. What was broken, and what did fixing it involve?",
  "Attributed revenue can flatter email, because a sale might have happened anyway. How do you and your clients judge whether email is genuinely driving the sale?",
  "For a small business owner with almost no time, which one email flow should they set up this week, and why that one?",
  "What is next for Strategy Studio?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

const BODY = `Hi Molly,

Thanks for getting in touch. Yes, Strategy Studio is a good fit for SME Leaders, our series on the people building Britain's small businesses. There is no cost and no advertising attached to it.

It is all done by email. The seven questions are below, answered in your own words. 100 to 150 words per answer is plenty, and skip any that do not suit you. If you can get them back to me by Friday 30 October, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

Please send a high resolution headshot with your answers. Anonymised client examples are fine. We will send you the live link the day it publishes.

Best,

James Burke
Publisher, Smart SME
https://smartsme.co.uk`;

if (/[—–]/.test(BODY)) { console.error("Dash in the copy."); process.exit(1); }

const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(THREAD_QUERY)}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
if (!list.messages?.length) throw new Error(`no message matches ${THREAD_QUERY}`);
const last = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=From`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
if (!h.from?.toLowerCase().includes(TO)) throw new Error(`newest match is from ${h.from}; refusing to thread onto it`);
const subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject}`;
const references = [h.references, h["message-id"]].filter(Boolean).join(" ");

const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeHeader = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [
  [`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${encodeHeader(subject)}`, `In-Reply-To: ${h["message-id"]}`, `References: ${references}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "",
  part(b, "text/plain", BODY),
  part(b, "text/html", HTML),
  `--${b}--`,
  "",
].join("\r\n");

console.log(`to: ${TO}\nsubject: ${subject}\nthread: ${last.threadId}\n\n${BODY}`);
if (!SEND) { console.log("\nDRY RUN"); process.exit(0); }
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64url(raw), threadId: last.threadId }) });
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || res.status); process.exit(1); }
console.log(`\nSENT id=${out.id} thread=${out.threadId}`);

const db = new PrismaClient();
const now = new Date();
const data = {
  siteId: site.id,
  personName: "Molly Edgecombe",
  personRole: "Founder, Strategy Studio",
  company: "Strategy Studio",
  companyDomain: "strategy-studio.co.uk",
  newsHook: "Built an email-led studio after years inside brands, because owners kept showing up online without getting consistent customers. Five Christmas emails made £17,853 for one small brand.",
  hookUrl: "https://strategy-studio.co.uk/client-results",
  email: TO,
  emailSource: "published",
  triedEmails: TO,
  status: "questioned",
  askSubject: subject,
  askBody: BODY,
  questions: QUESTIONS.join("\n"),
  askedAt: now,
  agreedAt: now,
  questionsSentAt: now,
};
const existing = await db.interviewTarget.findFirst({ where: { companyDomain: "strategy-studio.co.uk" } });
const row = existing ? await db.interviewTarget.update({ where: { id: existing.id }, data }) : await db.interviewTarget.create({ data });
console.log("row", row.id, row.status);
await db.$disconnect();
