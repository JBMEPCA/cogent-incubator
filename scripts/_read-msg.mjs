import { PrismaClient } from "@prisma/client"; import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js"; import { getGoogleAccessToken } from "../lib/google.js";
const prisma = new PrismaClient(); const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug)); const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])); const sender = outreachSender(creds.outreach); await prisma.$disconnect();
const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const d = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${process.argv[2]}?format=full`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json());
function textOf(p) { if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64").toString("utf8"); for (const c of p.parts || []) { const s = textOf(c); if (s) return s; } return ""; }
console.log(textOf(d.payload).split(/\r?\n(?:On .*wrote:|From: James Burke|>.*)/)[0].trim().slice(0, 2500));
