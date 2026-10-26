/**
 * One-off, 22 Oct 2026: SME Leaders questions in reply to the Coffee Lady pitch.
 * JB: "reach out to these and send questions for interview".
 *
 * The pitch came from social@creativewebsol.com, an agency doing outreach for
 * Coffee Lady, and says no cafe owner is lined up yet. So the questions are for
 * an independent cafe owner they still have to find, and the mail says the
 * answers must come from that named owner. No InterviewTarget row: there is no
 * person to put in it, and an answered row with a placeholder name is how the
 * sweep has drafted articles about nobody. Build by hand when answers arrive.
 *
 * Replies in their thread. Own MIME, no List-Unsubscribe on a one-to-one mail.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-coffee-lady-questions.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "social@creativewebsol.com";
const THREAD_QUERY = `from:${TO} subject:"Maintenance Decisions Behind a Café Coffee Offer"`;

const QUESTIONS = [
  "Tell us about your café: where it is, when you opened and how many people work there. What made you go independent?",
  "Your espresso machine is probably the most expensive thing in the building. How did you choose it, and did you buy, lease or rent?",
  "What do you budget each year for maintenance and servicing, and how did you arrive at that figure?",
  "Tell us about a time the machine went down on a busy day. What did it cost you in sales, and what did you change afterwards?",
  "How do you decide whether to repair a machine or replace it? Where is your line?",
  "What would you tell someone opening their first café about equipment, before they sign anything?",
  "What is next for your café?",
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

const BODY = `Hi,

Thanks for getting in touch. Yes, an independent café owner talking honestly about equipment, downtime and the repair or replace decision would suit SME Leaders, our series on the people running Britain's small businesses.

How it works: the interview is with the café owner, in their own words, by email. The seven questions are below. 100 to 150 words per answer is plenty, and they can skip any that do not suit them.

We will need three things with the answers:

- The owner's full name and the café's name, town and website or social page
- A high resolution photo of the owner, ideally in the café
- A direct email address for the owner, so we can confirm the details with them before publishing

The piece is about the owner and their business. Coffee Lady can be mentioned where it is genuinely part of their story, for example as their supplier, but it will not be a promotional feature.

${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

There is no cost. Send the answers over whenever the owner is ready and we will have the piece live within the week.

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
