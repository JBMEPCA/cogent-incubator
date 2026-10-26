/**
 * Diagnose and recover the two photos HARE sent on 26 Oct 2026.
 *
 * JB cannot see them in Gmail and they are named image0.png / image1.png,
 * which is what Apple Mail calls inline photos sent from an iPhone. That name
 * is also exactly what lib/gmail.js imageAttachments() throws away as a
 * signature image, so this walks the MIME tree itself with no filters.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_hare-photos-fetch.mjs [--save=<dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";

const SAVE = (process.argv.find((a) => a.startsWith("--save=")) || "").slice(7);

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);

// Reuse the module's own token path by importing its internals indirectly:
// getGoogleAccessToken is not exported, so go through a tiny re-implementation
// using the same service account the lib uses.
const { getGoogleAccessToken } = await import("../lib/google.js");

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const token = await getGoogleAccessToken(SCOPES, sender.email);
const auth = { headers: { Authorization: `Bearer ${token}` } };

const q = "from:(harestudio.co.uk OR hareoxford@gmail.com) has:attachment newer_than:3d";
const list = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(q)}`,
  auth
).then((r) => r.json());
console.log("matching messages:", list.messages?.length || 0);
if (!list.messages?.length) {
  const alt = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent("from:hare newer_than:3d")}`,
    auth
  ).then((r) => r.json());
  console.log("fallback 'from:hare':", alt.messages?.length || 0);
  if (alt.messages) list.messages = alt.messages;
}

for (const { id } of list.messages || []) {
  const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, auth).then((r) => r.json());
  const hdr = (n) => msg.payload.headers.find((h) => h.name.toLowerCase() === n)?.value || "";
  console.log(`\n=== ${id} ===`);
  console.log("date   :", hdr("date"));
  console.log("from   :", hdr("from"));
  console.log("subject:", hdr("subject"));

  const parts = [];
  (function walk(p, depth = 0) {
    if (!p) return;
    const cid = (p.headers || []).find((h) => h.name.toLowerCase() === "content-id")?.value;
    const disp = (p.headers || []).find((h) => h.name.toLowerCase() === "content-disposition")?.value;
    console.log(
      `${"  ".repeat(depth)}- ${p.mimeType}` +
      `${p.filename ? ` file=${p.filename}` : ""}` +
      `${p.body?.size ? ` size=${(p.body.size / 1024).toFixed(0)}KB` : ""}` +
      `${cid ? ` cid=${cid}` : ""}` +
      `${disp ? ` disp=${disp.split(";")[0]}` : ""}` +
      `${p.body?.attachmentId ? " [has attachmentId]" : ""}`
    );
    if (p.mimeType?.startsWith("image/") && p.body?.attachmentId) parts.push(p);
    for (const c of p.parts || []) walk(c, depth + 1);
  })(msg.payload);

  if (!SAVE || !parts.length) continue;
  fs.mkdirSync(SAVE, { recursive: true });
  for (const p of parts) {
    const a = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${p.body.attachmentId}`,
      auth
    ).then((r) => r.json());
    if (!a.data) { console.log(`   ${p.filename}: no data returned`); continue; }
    const buf = Buffer.from(String(a.data).replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const out = path.join(SAVE, p.filename || `part-${p.partId}.bin`);
    fs.writeFileSync(out, buf);
    console.log(`   saved ${out} (${(buf.length / 1024).toFixed(0)}KB, magic ${buf.subarray(0, 4).toString("hex")})`);
  }
}
await prisma.$disconnect();
