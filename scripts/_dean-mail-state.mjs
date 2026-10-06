/** One-off: did the 3 Sep live-URL email go, and what is Dean's latest message? */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";
const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();
const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const H = { Authorization: `Bearer ${t}` };
async function list(q, n = 10) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${n}&q=${encodeURIComponent(q)}`, { headers: H }).then((r) => r.json());
  const out = [];
  for (const m of r.messages || []) {
    const d = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=From&metadataHeaders=Message-Id&metadataHeaders=References`, { headers: H }).then((r) => r.json());
    const h = Object.fromEntries((d.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    out.push({ id: m.id, thread: d.threadId, date: h.date, from: h.from, subject: h.subject, mid: h["message-id"], refs: h.references, snippet: (d.snippet || "").slice(0, 120) });
  }
  return out;
}
console.log("=== SENT to Dean ===");
for (const m of await list("to:dean@appleandbears.com in:sent")) console.log(`${m.date} | ${m.subject} | thread ${m.thread}\n   ${m.snippet}`);
console.log("\n=== FROM Dean (newest first) ===");
for (const m of await list("from:dean@appleandbears.com", 5)) console.log(`${m.date} | ${m.subject} | thread ${m.thread} | id ${m.id}\n   mid ${m.mid}\n   ${m.snippet}`);
