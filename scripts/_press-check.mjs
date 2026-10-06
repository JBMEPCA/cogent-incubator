// Did anything actually arrive at the press@ aliases, and where did it land?
// Searches in:anywhere on purpose: a filter that archives, or Gmail's spam,
// both look exactly like "nothing came through".
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SLUGS = ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business", "airport-business-magazine"];

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();
const titles = creds.map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) })).filter((t) => t.fromEmail && SLUGS.includes(t.slug));

async function api(token, path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${res.status} ${json?.error?.message || text.slice(0, 160)}`);
  return json;
}

const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";

for (const t of titles) {
  const alias = `press@${t.fromEmail.split("@")[1]}`;
  let token;
  try {
    token = await getGoogleAccessToken(SCOPES, t.fromEmail);
  } catch (e) {
    console.log(`${t.name}: no read token — ${e.message.slice(0, 120)}`);
    continue;
  }
  const q = encodeURIComponent(`(to:${alias} OR deliveredto:${alias} OR cc:${alias}) in:anywhere newer_than:2d`);
  const list = await api(token, `/messages?q=${q}&maxResults=10`).catch((e) => ({ error: e.message }));
  if (list.error) {
    console.log(`${t.name}: search failed — ${list.error}`);
    continue;
  }
  const ids = list.messages || [];
  if (!ids.length) {
    console.log(`${alias}: nothing in the last 2 days (searched inbox, archive, spam and trash)`);
    continue;
  }
  console.log(`${alias}: ${ids.length} message(s)`);
  for (const { id } of ids.slice(0, 5)) {
    const m = await api(token, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`);
    console.log(`   from ${hdr(m, "from")} | to ${hdr(m, "to")} | "${hdr(m, "subject")}" | labels: ${(m.labelIds || []).join(",")}`);
  }
}
