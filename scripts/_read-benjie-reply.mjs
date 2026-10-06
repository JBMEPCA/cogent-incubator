/**
 * One-off: print Dean Butt's latest reply in full from the Smart SME mailbox.
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_read-dean-reply.mjs
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const FROM = "benjie@hugsandco.com";
const READ = ["https://www.googleapis.com/auth/gmail.readonly"];

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

const token = await getGoogleAccessToken(READ, sender.email);
const list = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent(`from:${FROM}`)}`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());

const msg = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=full`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());

const h = Object.fromEntries((msg.payload.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
console.log(`Subject: ${h.subject}`);
console.log(`Date:    ${h.date}`);
console.log(`Thread:  ${msg.threadId}\n`);

function textOf(part) {
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64").toString("utf-8");
  for (const p of part.parts || []) {
    const t = textOf(p);
    if (t) return t;
  }
  return "";
}
// Trim the quoted copy of our own mail off the bottom.
const body = textOf(msg.payload).split(/\r?\n(?:On .*wrote:|>.*)/)[0];
console.log(body.trim());

// What he actually attached, so the download ask can name files and sizes.
const atts = [];
(function walk(p) {
  if (p.filename && p.body?.attachmentId)
    atts.push({ name: p.filename, bytes: p.body.size, type: p.mimeType, id: p.body.attachmentId });
  for (const c of p.parts || []) walk(c);
})(msg.payload);
console.log("\n--- attachments ---");
for (const a of atts) console.log(`${a.name}  ${a.type}  ${(a.bytes / 1024).toFixed(0)} KB`);
