// Has anything ever arrived at the news@ address each site publishes?
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SLUGS = ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business", "airport-business-magazine"];
const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({ where: { kind: "outreach" }, select: { payloadEnc: true, site: { select: { name: true, slug: true } } } });
await prisma.$disconnect();
const titles = creds.map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) })).filter((t) => t.fromEmail && SLUGS.includes(t.slug));
for (const t of titles) {
  const domain = t.fromEmail.split("@")[1];
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], t.fromEmail);
  const api = async (p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); const x = await r.text(); const j = x ? JSON.parse(x) : {}; if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || ""}`); return j; };
  const q = encodeURIComponent(`(to:news@${domain} OR deliveredto:news@${domain}) in:anywhere`);
  const list = await api(`/messages?q=${q}&maxResults=5`).catch((e) => ({ error: e.message }));
  console.log(`news@${domain}: ${list.error ? "search failed " + list.error : (list.messages?.length || 0) + " message(s) ever"}`);
}
