import { PrismaClient } from "@prisma/client"; import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js"; import { getGoogleAccessToken } from "../lib/google.js";
const prisma = new PrismaClient(); const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug)); const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])); const sender = outreachSender(creds.outreach); await prisma.$disconnect();
const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email); const H = { Authorization: `Bearer ${t}` };
const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=${encodeURIComponent("Magentic")}`, { headers: H }).then((r) => r.json());
console.log("hits:", (r.messages || []).length);
for (const m of r.messages || []) {
  const d = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: H }).then((r) => r.json());
  const h = Object.fromEntries((d.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const atts = []; (function walk(p) { if (p.filename && p.body?.attachmentId) atts.push(`${p.filename} (${p.mimeType}, ${(p.body.size / 1024).toFixed(0)} KB)`); for (const c of p.parts || []) walk(c); })(d.payload);
  console.log(`\n${h.date} | from ${h.from} | to ${h.to}\n  subject: ${h.subject}\n  thread ${d.threadId} id ${m.id}\n  mid ${h["message-id"]}\n  attachments: ${atts.join(" | ") || "none"}`);
}
