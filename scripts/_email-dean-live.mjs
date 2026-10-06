/**
 * One-off: tell Dean Butt his piece is live, in his own thread, with the
 * Press Room link and canonical asks. Refuses to send unless post 1017 is
 * actually published, so it cannot mail a draft URL.
 *
 * Same clean MIME as _send-dean-reply.mjs: no List-Unsubscribe, RFC 2047
 * subject, threaded to his last message.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-dean-live.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "dean@appleandbears.com";
const TO_NAME = "Dean Butt";
const POST_ID = 1017;

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const wp = creds.wordpress;
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

// The live URL, from WordPress itself, and only if it is really published.
const base = (wp.baseUrl || wp.url || "").replace(/\/$/, "");
const auth = Buffer.from(`${wp.username || wp.user}:${wp.appPassword || wp.password}`).toString("base64");
const post = await fetch(`${base}/wp-json/wp/v2/posts/${POST_ID}?_fields=id,status,link`, {
  headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
}).then((r) => r.json());
if (post.status !== "publish") {
  console.error(`post ${POST_ID} is "${post.status}", not publish. Not sending.`);
  process.exit(1);
}
const URL = post.link;
console.log(`live url: ${URL}`);

const BODY = `Hi Dean,

Your piece is live on Smart SME:

${URL}

Thanks for the headshot and the image, both are in. One thing to flag so it is not a surprise: I have added a short "What this means for your business" section at the end, four practical takeaways for a small manufacturer reading it. That part is the editor's addition rather than yours, and it is marked as such.

Two things when you have a moment:

1. The Press Room link, as agreed. A standard followed link to the URL above, alongside the SME Today one.

2. A canonical tag on your own version of the article, pointing at the Smart SME URL. It is one line in the head of your page:

<link rel="canonical" href="${URL}">

The reason: both pages now carry the same text, and Google will only rank one of them. The canonical tells it which. Pointing it at the Smart SME version means the piece is put in front of a new audience and ranks once, rather than the two copies competing with each other and neither doing well. It changes nothing your own visitors see. If you would rather keep your version as the primary, that is completely fine, just say so and we will leave it.

When you share it on LinkedIn, tag Smart SME Magazine and we will reshare it from the company page.

Thanks again, Dean. Good piece to run.

Best regards,

JB
Editor, Smart SME`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

// Thread onto his reply.
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const list = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(`from:${TO}`)}`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
const last = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject || "Sustainability Without Pretending to Be Perfect"}`;
const references = [h.references, h["message-id"]].filter(Boolean).join(" ");

const raw = buildMime({
  from: `${sender.name} <${sender.email}>`,
  to: `${TO_NAME} <${TO}>`,
  subject,
  text: BODY,
  html: HTML,
  inReplyTo: h["message-id"],
  references,
});
console.log(`to:      ${TO}\nsubject: ${subject}\nthread:  ${last.threadId}`);

if (!SEND) {
  console.log("\n--- DRY RUN, nothing sent ---\n" + BODY);
  process.exit(0);
}

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), threadId: last.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", out?.error?.message || `HTTP ${res.status}`);
  process.exit(1);
}
console.log(`SENT id=${out.id} thread=${out.threadId}`);
