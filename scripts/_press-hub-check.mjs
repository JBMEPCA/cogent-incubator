// Where did the forwarded copy of a press@ message land in the HUB?
import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || t.slice(0, 160)}`);
  return j;
};
const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";
const labels = new Map(((await api("/labels")).labels || []).map((l) => [l.id, l.name]));
for (const q of ["to:press in:anywhere newer_than:2d", "press in:anywhere newer_than:2d"]) {
  const list = await api(`/messages?q=${encodeURIComponent(q)}&maxResults=10`);
  const ids = list.messages || [];
  console.log(`\nHUB query [${q}] -> ${ids.length} message(s)`);
  for (const { id } of ids.slice(0, 6)) {
    const m = await api(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Delivered-To&metadataHeaders=Date`);
    console.log(`  to ${hdr(m, "to")} | delivered-to ${hdr(m, "delivered-to")} | from ${hdr(m, "from")} | "${hdr(m, "subject")}" | ${(m.labelIds || []).map((i) => labels.get(i) || i).join(",")}`);
  }
}
