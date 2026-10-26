/**
 * Reply to Alex Hall (Capra Finance), who offered a data-led contributed piece
 * on FLA asset finance figures. JB, 23 Oct 2026: "reply to this email and ask
 * for the content".
 *
 * Says yes to the article rather than the quote, sets the terms Fleet's
 * editorial standard needs for a figures piece (named official source and
 * publication date beside every number, no promotional copy, byline link only),
 * asks for the data table, and makes the usual link request.
 *
 * He wrote to press@ from alex@caprafinance.co.uk; the reply goes from
 * jb@thefleetmagazine.co.uk in his own thread. Own MIME, so no
 * List-Unsubscribe chip on a one-to-one reply.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-capra-yes.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "Alex Hall <alex@caprafinance.co.uk>";
const REPLY_TO_MSG = "1a1692b827a5d94b";

const BODY = `Hi Alex,

Yes, that is useful. I would rather have the article than a comment, so please send it over.

What works for us:

1. Between 700 and 900 words, written for a fleet manager or an owner-operator deciding how to fund their next vehicle, not for other brokers.

2. Every figure needs the source named in the text, with the publication and the period it covers, so a reader can check it. For the FLA numbers that means naming the Finance and Leasing Association and the month the release covers, and the same for anything from the Bank of England or the ONS. We run a hard rule on this: if a number cannot be traced to a named official source, it comes out rather than going in unattributed.

3. The useful half, for our readers, is the second part of your pitch: the checks that matter when financing a used van, truck or specialist conversion. Growth figures set the scene, but what people act on is what to look for before signing. Lead with that if you can.

4. It runs under your name and job title with a photograph, and carries one link to caprafinance.co.uk from your byline. No sales copy in the body, and we will edit for house style.

5. It should not have run anywhere else, and should not go out elsewhere afterwards.

Yes please to the data table as well. Send it as a spreadsheet or a CSV and we will host it alongside the piece so readers can download it.

There is no fee either way, in either direction. The one thing we ask in return is a followed link to the published article from caprafinance.co.uk, from your news or insights page, once it is live.

If you can get it to me by Friday 30 October, I will aim to publish the following week. Any questions, just ask.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const refuse = async (why) => { console.error(`NOT SENT: ${why}`); await prisma.$disconnect(); process.exit(1); };
console.log(`to: ${TO}\nfrom: ${sender.name} <${sender.email}>\n\n${BODY}\n`);
if (/[—–]/.test(BODY)) await refuse("dash in copy");
if (!SEND) { console.log("DRY RUN: nothing sent."); await prisma.$disconnect(); process.exit(0); }

const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const already = await G(`messages?maxResults=3&q=${encodeURIComponent("in:sent to:alex@caprafinance.co.uk")}`);
if ((already.messages || []).length) await refuse(`already replied: ${already.messages.map((m) => m.id).join(",")}`);

const msg = await G(`messages/${REPLY_TO_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, text) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(text, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${/^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`}`,
  `In-Reply-To: ${h["message-id"]}`, `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`,
  "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "", part(b, "text/plain", BODY), part(b, "text/html", HTML), `--${b}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) await refuse(`gmail ${out?.error?.message || res.status}`);
console.log(`SENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
