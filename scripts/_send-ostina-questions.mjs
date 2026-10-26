/**
 * One-off, 26 Oct 2026: SME Leaders questions for Dan Clarke, CEO and founder
 * of Ostina Ltd (ostina.ai). Pitched from dan@ostina.ai on 25 Oct 13:22 UK;
 * JB: "Sort 7 questions interview with this guy". Replies in his thread and
 * creates the InterviewTarget row at "questioned".
 *
 * His pitch is a design aim, not a result: treating reclaimed personal time as
 * a legitimate outcome of AI rather than more work or a smaller team. He says
 * answers are AI-assisted with his review, so the mail asks for his own words
 * and real examples, and the questions press on how it is checked.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-ostina-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "dan@ostina.ai";
const THREAD_QUERY = `from:${TO} newer_than:3d`;

const QUESTIONS = [
  "Tell us about Ostina in plain terms: what it does, who it is for, and what made you start it.",
  "Most AI pitches promise more output or a smaller team. You are arguing that reclaimed personal time is a legitimate outcome in its own right. Where did that view come from?",
  "For a sole trader, how should they decide what the saved time is for, whether that is a predictable finish, more family time or growth, and stop it quietly turning into more work?",
  "For an owner with a team, how do you use AI to support the people already doing the work rather than to justify needing fewer of them?",
  "Which decisions should always stay with a human, however good the tools get, and how does an owner draw that line?",
  "Checking and correcting AI output can eat the time it was meant to save. How should an owner measure whether they are really getting time back?",
  "You describe these as design aims rather than proven results. What would you need to see to know it is working, and what is next for Ostina?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

const BODY = `Hi Dan,

Thanks for getting in touch. Yes, this is a good fit for SME Leaders, our series on the people building Britain's small businesses. There is no cost and no advertising attached to it.

It is all done by email. The seven questions are below. 100 to 150 words per answer is plenty, and skip any that do not suit you. If you can get them back to me by Friday 6 November, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

The answers run as direct quotes in your own words, so they work best in your own voice, with real examples from your own work or the owners you talk to, rather than polished copy. Being clear that these are aims rather than proven results, as you were in your email, is exactly right.

Please send a high resolution photo of yourself with your answers. We will send you the live link the day it publishes.

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
  personName: "Dan Clarke",
  personRole: "CEO and Founder, Ostina",
  company: "Ostina",
  companyDomain: "ostina.ai",
  newsHook: "Building Ostina around treating reclaimed personal time as a legitimate outcome of AI, rather than turning every saved hour into more work or a smaller team. Design aims, not proven results.",
  hookUrl: "https://ostina.ai/",
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
const existing = await db.interviewTarget.findFirst({ where: { companyDomain: "ostina.ai" } });
const row = existing ? await db.interviewTarget.update({ where: { id: existing.id }, data }) : await db.interviewTarget.create({ data });
console.log("row", row.id, row.status);
await db.$disconnect();
