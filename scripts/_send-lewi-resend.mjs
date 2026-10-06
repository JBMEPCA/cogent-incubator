/**
 * One-off, 14 Sep 2026: resend the Aegis Energy brief to Lewi Stokes at Stand.
 *
 * Lewi chased twice (10 and 14 Sep) as though nothing had come back. Two
 * replies had: to Will Paxton on 8 Sep, and to Lewi on 10 Sep. The 10 Sep one
 * went through sendGmail(), so it carried List-Unsubscribe, which on a Microsoft
 * 365 tenant is a good way to land in junk, and it dropped the Aegis cc. This
 * one builds its own MIME, answers Lewi's latest message in thread, and copies
 * both Aegis@thisisstand.com and Will so more than one mailbox has it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_send-lewi-resend.mjs [--send]
 */

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const REPLY_TO_MSG = "1a09f0e75f8e3365"; // Lewi, 14 Sep 09:34
const TO = "Lewi Stokes <Lewi@thisisstand.com>";
const CC = "Aegis <Aegis@thisisstand.com>, Will Paxton <will@thisisstand.com>";

const BODY = `Hi Lewi,

Apologies, you should have had this already. I replied to you on 10 September and to Will on 8 September, so I suspect both went to a filter. I have copied Will in here so everything is in one place.

It is a straight Q&A: seven questions, 100 to 150 words per answer, so around 900 words in total. It runs under Eddie's name with his photograph and a short card about Aegis. There is no cost and no advertising attached to it.

Deadline: Friday 18 September for the answers and a high resolution headshot of Eddie. If that is too tight, tell me a date that works and I will fit round it. We will send you the live link the day it publishes.

The questions:

1. Operators have been told to decarbonise for years without anywhere to refuel. What is genuinely changing?

2. You are building for electric, hydrogen, bio-CNG and HVO at once. Why not pick one?

3. What has to be true about a site before it is worth building a hub there?

4. Hauliers plan in decades for depots and in months for contracts. How do you sell into that?

5. What is the most common misconception fleet managers have about alternative fuels?

6. What is the biggest constraint on the rollout right now?

7. Where is the network in three years?

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

if (/[\u2014\u2013]/.test(BODY)) { console.error("Dash in the copy."); process.exit(1); }

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function buildMime({ from, to, cc, subject, text, html, inReplyTo, references }) {
  const boundary = `mime-${Date.now().toString(36)}`;
  const headers = [`From: ${from}`, `To: ${to}`, `Cc: ${cc}`, `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`, `References: ${references}`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`];
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "",
    Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${REPLY_TO_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const raw = buildMime({
  from: `${sender.name} <${sender.email}>`, to: TO, cc: CC,
  subject: /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`,
  text: BODY, html: HTML, inReplyTo: h["message-id"],
  references: [h.references, h["message-id"]].filter(Boolean).join(" "),
});
console.log(raw.split("\r\n\r\n")[0]);
if (!SEND) { console.log("\nDRY RUN"); await prisma.$disconnect(); process.exit(0); }

const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || res.status); process.exit(1); }
console.log(`\nSENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
