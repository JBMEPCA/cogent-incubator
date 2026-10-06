/**
 * One-off: reply to Dean Butt (APPLE & BEARS) from the Smart SME mailbox.
 *
 * Not the outreach engine. sendGmail() always stamps a List-Unsubscribe header
 * (unsubscribeMailto falls back to sender.replyTo), which is right for cold
 * outreach and wrong for a one-to-one editorial reply — Gmail renders an
 * "Unsubscribe" chip next to the sender's name. So this builds its own MIME and
 * calls the API directly, reusing only the delegation and the credential.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_send-dean-reply.mjs [--send]
 * Without --send it prints what it would do and sends nothing.
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender, isGmailConfigured, gmailSetupHint } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "dean@appleandbears.com";
const TO_NAME = "Dean Butt";

const SUBJECT_FALLBACK = "Re: Thought leadership for Smart SME";

const BODY = `Hi Dean,

Thanks for getting in touch, and for sending the Press Room over.

I have read through the four pieces and I would like to publish "Sustainability Without Pretending to Be Perfect" on Smart SME.

It was the one that stood out. Most sustainability writing we get sent is a list of claims. Yours is about the trade-offs an independent business actually has to make, and the section on overproduction is the part I think our readers will recognise straight away. The point that ordering 10,000 units to cut the unit price can quietly turn into a working capital problem is one a lot of small manufacturers learn the expensive way. Being straight about the push pumps rather than leaving that detail out is what makes the rest of it credible.

I have deliberately not gone for the UK manufacturing piece, good as it is, purely because SME Today have already run it and I would rather give you a piece that is working for you rather than competing with itself in search.

A few practical things before we schedule it:

1. Can you confirm the sustainability piece has not been published anywhere else, and that you are happy for Smart SME to be the only publisher of it outside your own site?

2. We will run it as a founder byline with your name, title and a link back to appleandbears.com in the author credit.

3. One thing I would ask in return. When it goes live, please add a link to the Smart SME article from your Press Room page, alongside the SME Today one. A standard followed link is all we need, no rel="nofollow" or rel="sponsored". It costs you nothing, it makes your Press Room more useful to anyone checking you out, and it means the piece works harder for both of us. If you are happy to share it from your own LinkedIn as well, even better. Founder-shared pieces travel much further than anything the publication posts on its own.

4. If you can send a headshot and one product or brand image at a decent resolution, I will use them in the article.

I will send you the live URL as soon as it is scheduled so you have it for the Press Room.

Best regards,

JB
Editor, Smart SME`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(
  /\n\n+/
)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Headers are latin-1 on the wire. Reusing a sender's own subject line means
// inheriting their punctuation, and an em dash passed through raw arrives as
// mojibake in Outlook. lib/gmail.js has always done this; dropping it when this
// script was split out was a mistake, and it showed.
function encodeHeader(value) {
  const v = String(value || "");
  if (/^[\x20-\x7E]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
}

function buildMime({ from, to, subject, text, html, inReplyTo, references }) {
  const boundary = `mime-${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const part = (type, body) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
      "",
    ].join("\r\n");
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join(
    "\r\n"
  );
}

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });
const site = sites.find((s) => /smart/i.test(s.slug) || /smart.?sme/i.test(s.name));
if (!site) {
  console.error("No Smart SME site. Slugs:", sites.map((s) => s.slug).join(", "));
  process.exit(1);
}
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const outreach = creds.outreach;
if (!isGmailConfigured(outreach)) {
  console.error("Gmail not configured:", gmailSetupHint(outreach));
  process.exit(1);
}
const sender = outreachSender(outreach);
console.log(`title:  ${site.name} (${site.slug})`);
console.log(`from:   ${sender.name} <${sender.email}>`);
console.log(`to:     ${TO_NAME} <${TO}>`);

// Find his original so the reply threads instead of arriving cold.
let threadId = null,
  inReplyTo = null,
  references = null,
  subject = SUBJECT_FALLBACK;
try {
  const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
  const q = encodeURIComponent(`from:${TO}`);
  const list = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${q}`,
    { headers: { Authorization: `Bearer ${rt}` } }
  ).then((r) => r.json());
  const id = list?.messages?.[0]?.id;
  if (id) {
    const msg = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
      { headers: { Authorization: `Bearer ${rt}` } }
    ).then((r) => r.json());
    const h = Object.fromEntries((msg?.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    threadId = msg.threadId;
    inReplyTo = h["message-id"] || null;
    references = [h["references"], h["message-id"]].filter(Boolean).join(" ") || null;
    if (h["subject"]) subject = /^re:/i.test(h["subject"]) ? h["subject"] : `Re: ${h["subject"]}`;
    console.log(`thread: ${threadId}  (replying in thread)`);
    console.log(`subject:${subject}`);
  } else {
    console.log("thread: none found, will send as a fresh email");
  }
} catch (e) {
  console.log(`thread: readonly scope unavailable (${e.message.slice(0, 80)}), sending fresh`);
}

const raw = buildMime({
  from: `${sender.name} <${sender.email}>`,
  to: `${TO_NAME} <${TO}>`,
  subject,
  text: BODY,
  html: HTML,
  inReplyTo,
  references,
});

if (!SEND) {
  console.log("\n--- DRY RUN, nothing sent. Headers: ---");
  console.log(raw.split("\r\n\r\n")[0]);
  await prisma.$disconnect();
  process.exit(0);
}

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), ...(threadId ? { threadId } : {}) }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", body?.error?.message || `HTTP ${res.status}`);
  process.exit(1);
}
console.log(`\nSENT  id=${body.id}  thread=${body.threadId}`);
await prisma.$disconnect();
