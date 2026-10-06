/**
 * One-off: tell Eyal (Miloosh) the pricing piece is live, in his thread, and
 * ask for a followed link back. The live URL and status come over SSH + wp-cli
 * because the REST API is walled off by SiteGround. Refuses to send unless the
 * post is really published, so it cannot mail a draft URL.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-eyal-live.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "lahman00@gmail.com";
const TO_NAME = "Eyal";
const POST_ID = 1112;

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

// The live URL, from WordPress itself over SSH, and only if it is really published.
const sftp = creds.sftp;
const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const row = execFileSync(
  "ssh",
  ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`,
   `cd '${docroot}' && wp post list --post__in=${POST_ID} --post_status=any --fields=post_status,url --format=json`],
  { encoding: "utf8", timeout: 120000 }
).trim();
const post = JSON.parse(row)[0] || {};
if (post.post_status !== "publish") {
  console.error(`post ${POST_ID} is "${post.post_status}", not publish. Not sending.`);
  process.exit(1);
}
const URL = post.url;
console.log(`live url: ${URL}`);

const BODY = `Hi Eyal,

Thanks for sending this over. It has gone up on Smart SME as a piece in its own right:

${URL}

The dataset is credited and linked, and the piece says we will fold the figures into the next update of the software stack guide.

One ask in return: a link to the article from Miloosh, from the research page or wherever you list coverage. A standard followed link is all we need. It is how we keep coverage of independent research like yours free.

When you next refresh the dataset, send the new figures over and we will update the piece.

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

// Thread onto his email.
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const list = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(`from:${TO}`)}`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
if (!list.messages?.length) {
  console.error(`no message from ${TO} in the mailbox. Not sending.`);
  process.exit(1);
}
const last = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject || "2026 pricing dataset"}`;
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
