/**
 * One-off: reply to Susan Jansen van Rensburg (Novo Cabelo) from the Barbering Business
 * mailbox, threaded onto our original 10 Sep ask. JB, 14 Sep 2026: do not mention the
 * Smart SME chase, carry on as normal. Built from _send-dean-reply.mjs.
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-novo-reply.mjs [--send]
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender, isGmailConfigured, gmailSetupHint } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "susan@novocabelo.co.uk";
const TO_NAME = "Susan Jansen van Rensburg";

const SUBJECT_FALLBACK = "Re: Seven questions for Novo Cabelo HQ";

const BODY = `Hi Susan,

Thank you for passing it on, and there is no rush at all.

When Rob has a moment, he does not need to answer all seven. A few lines on the ones that interest him is plenty, plus a headshot if he has one to hand. I will send you both the link the day it goes live.

Best,
James Burke
Publisher, Barbering Business
https://barberingbusiness.com`;

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
const site = sites.find((s) => s.slug === "barbering-business");
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
  const q = encodeURIComponent(`in:sent to:support@novocabelo.co.uk subject:"Seven questions for Novo Cabelo HQ"`);
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
