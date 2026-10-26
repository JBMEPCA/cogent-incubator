/**
 * Reply to Ben Hutchings, Atlas Kids Gym, who asked on 9 Oct 2026 10:26 UK
 * "As we are a start up, what is the offering?" after our chase. JB: "please
 * reply to this guy". Answers that there is no offering to buy, says what he
 * gets, and repeats the seven questions. Replies in his own thread from the
 * Gym outreach mailbox; refuses if we already wrote after his message.
 */
import fs from "node:fs";
import { siteCredentials } from "../lib/site.js";
const { prisma } = await import("../lib/prisma.js");
const { outreachSender } = await import("../lib/gmail.js");
const { getGoogleAccessToken } = await import("../lib/google.js");
const EMAIL = "team@atlaskidsgym.co.uk";

// --body-file=<txt> overrides the first reply (9 Oct 10:30); the 10:50 headshot ask uses it.
const BF = (process.argv.find((x) => x.startsWith("--body-file=")) || "").slice(12);
const BODY = BF ? fs.readFileSync(BF, "utf8").trim() : `Hi Ben,

Good question, and the short answer is that there isn't one. Nothing is for sale. This is editorial, not advertising: there is no fee, no package and nothing to sign up to, whether you are a start up or not.

What you get is a profile of Atlas Kids Gym in our Gym Champions series, which features independent gym and fitness business owners across the UK, written from your own answers. It carries your photo, a short panel about the business with a link to your website, and I send you the live link the day it publishes so you can share it. Being a Gym Innovation of the Year finalist with a HYROX inspired kids club is exactly what our readers, who run gyms and studios themselves, want to hear about.

All I need from you is answers to as many of these as you like, in your own words, plus a photo of you if you have one:

1. You run kids classes out of halls and partner gyms rather than your own building. Was that a choice or a starting point?
2. Your customer is the child but the parent pays. Who are you really selling to?
3. Becoming an official HYROX Training Club ties you to a big brand. What does that bring in, and what does it cost you?
4. Children's fitness has school holidays and term times. How do you keep revenue steady across the year?
5. Coaching kids needs a different kind of coach. How do you find and keep good ones?
6. What is the least glamorous part of running a kids fitness business that nobody warns you about?
7. Where does Atlas Kids Gym go from here?

Best,
James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`;
if (/[—–]/.test(BODY)) throw new Error("dash");
const SEND = process.argv.includes("--send");
if (!SEND) { console.log(BODY); process.exit(0); }

const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const last = (await G(`messages?maxResults=1&q=${encodeURIComponent(`from:${EMAIL}`)}`)).messages?.[0];
if (!last) throw new Error("no message from Ben");
const msg = await G(`messages/${last.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
for (const m of (await G(`messages?maxResults=5&q=${encodeURIComponent(`in:sent to:${EMAIL}`)}`)).messages || []) {
  const d = await G(`messages/${m.id}?format=minimal`);
  if (Number(d.internalDate) > Number(msg.internalDate)) throw new Error(`NOT SENT: already replied after his message (${m.id})`);
}
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const bd = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: Ben Hutchings <${EMAIL}>`, `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${bd}"`].join("\r\n"),
  "", part(bd, "text/plain", BODY), part(bd, "text/html", HTML), `--${bd}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(`NOT SENT: gmail ${out?.error?.message || res.status}`);
console.log(`SENT from ${sender.email} to ${EMAIL}: gmail ${out.id}, thread ${out.threadId}, "${subject}"`);
await prisma.$disconnect();
