// Read-only: how many "you're live" replies are parked in each title's press
// mailbox? press_link_ask has never been written to GlobalSetting, so
// linkAskMode() returns "draft" and nothing has left the building since the
// desk went live on 21 Sep 2026.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();

const titles = creds
  .map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) }))
  .filter((t) => t.fromEmail)
  .sort((a, b) => a.name.localeCompare(b.name));

const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";
let total = 0;
let external = 0;

for (const t of titles) {
  let token;
  try {
    token = await getGoogleAccessToken(SCOPES, t.fromEmail);
  } catch (e) {
    console.log(`${t.name.padEnd(28)} no token (${e.message.slice(0, 60)})`);
    continue;
  }
  const api = async (p) => {
    const res = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const txt = await res.text();
    const j = txt ? JSON.parse(txt) : {};
    if (!res.ok) throw new Error(`${res.status} ${j?.error?.message || txt.slice(0, 120)}`);
    return j;
  };
  let list;
  try {
    list = await api("/drafts?maxResults=60");
  } catch (e) {
    console.log(`${t.name.padEnd(28)} drafts unreadable (${e.message.slice(0, 70)})`);
    continue;
  }
  const ids = list.drafts || [];
  const rows = [];
  for (const d of ids) {
    try {
      const full = await api(`/drafts/${d.id}?format=metadata`);
      const to = hdr(full.message, "to");
      rows.push({ to, subject: hdr(full.message, "subject"), date: hdr(full.message, "date") });
    } catch { /* ignore one bad draft */ }
  }
  const ours = rows.filter((r) => /@(cimltd\.co\.uk|smartsme\.co\.uk)/i.test(r.to)).length;
  total += rows.length;
  external += rows.length - ours;
  console.log(`${t.name.padEnd(28)} ${String(rows.length).padStart(3)} parked   (${rows.length - ours} external, ${ours} to our own people)`);
  for (const r of rows) console.log(`      ${r.to.padEnd(34)} ${r.subject.slice(0, 68)}`);
}

console.log(`\nTOTAL ${total} parked replies, ${external} of them to outside senders.`);
