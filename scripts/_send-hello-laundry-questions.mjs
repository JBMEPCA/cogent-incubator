/**
 * One-off, 23 Oct 2026: SME Leaders questions for the founder of Hello Laundry
 * (named only as "Mr Roy" in the pitch from info@hellolaundry.co.uk, 02:06 UK).
 * JB: "sort this for SME". Replies in their thread and creates the
 * InterviewTarget row at "questioned".
 *
 * The pitch offers "a clearly labelled AI-edited promotional portrait". Person
 * stories need a real photo of the person, so the mail asks for an unedited
 * one, and for the founder's full name, which the pitch never gives.
 *
 * Facts from the pitch only, all founder-provided: launched 2019 after a
 * five-day blanket-cleaning wait; founder did deliveries himself at first;
 * about 25,000 customers and 1,000+ business clients; about 37 staff across the
 * UK, India, Pakistan and Bangladesh, plus about 12 drivers; Greater London,
 * Essex, Birmingham and Coventry.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-hello-laundry-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "info@hellolaundry.co.uk";
const THREAD_QUERY = `from:${TO} newer_than:3d`;

const QUESTIONS = [
  "Hello Laundry started with a five-day wait to get a blanket cleaned. What happened, and what made you think it was a business rather than just a bad experience?",
  "In the early days you made the deliveries yourself while building the booking platform. What did doing the driving teach you that you could not have learned from a spreadsheet?",
  "You do not run your own cleaning plant; you work with cleaning partners. How do you choose them, and how do you keep quality consistent when the cleaning happens somewhere else?",
  "More than 1,000 of your clients are businesses rather than households. How different is that side of the business, and which has been the better one to grow?",
  "Your team of around 37 is spread across the UK, India, Pakistan and Bangladesh. Why build it that way, and what has been hardest about running a team across time zones?",
  "Laundry is a low-margin, high-volume business. Where does the money actually get made, and where have you seen it leak away?",
  "You cover Greater London, Essex, Birmingham and Coventry. How do you decide when a new area is worth opening, and what is next for Hello Laundry?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

const BODY = `Hello,

Thanks for getting in touch. Yes, Hello Laundry's story is a good fit for SME Leaders, our series on the people building Britain's small businesses. There is no cost and no advertising attached to it.

The interview is with the founder, in his own words, by email. The seven questions are below. 100 to 150 words per answer is plenty, and he can skip any that do not suit him. If you can get them back to me by Friday 6 November, I will have the piece live the week after.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

Two things we will need with the answers:

- The founder's full name and job title, as he would like them to appear
- A real, unedited high resolution photo of him. We are not able to use AI-edited or AI-generated portraits, even labelled ones, because the piece is about a real person. A recent phone photo is fine if that is all there is.

We will send the live link the day it publishes.

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
  // Full name not given in the pitch; update when the answers arrive.
  personName: "Mr Roy",
  personRole: "Founder, Hello Laundry",
  company: "Hello Laundry",
  companyDomain: "hellolaundry.co.uk",
  newsHook: "Launched Hello Laundry in 2019 after a five-day wait to get a blanket cleaned, did the deliveries himself at first, and has grown to about 37 staff across four countries and 25,000 customers (founder-provided figures).",
  hookUrl: "https://hellolaundry.co.uk",
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
const existing = await db.interviewTarget.findFirst({ where: { companyDomain: "hellolaundry.co.uk" } });
const row = existing ? await db.interviewTarget.update({ where: { id: existing.id }, data }) : await db.interviewTarget.create({ data });
console.log("row", row.id, row.status);
await db.$disconnect();
