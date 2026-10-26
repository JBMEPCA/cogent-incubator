import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); const t = await r.text(); const j = t?JSON.parse(t):{}; if(!r.ok) throw new Error(`${r.status} ${j?.error?.message||t.slice(0,120)}`); return j; };
const hdr = (m,n) => m.payload?.headers?.find(h=>h.name.toLowerCase()===n)?.value || "";
for (const q of [
  "deliveredto:press@smartsme.co.uk in:anywhere",
  "to:press@smartsme.co.uk in:anywhere",
  "press@smartsme.co.uk in:anywhere",
  "from:lucas@cimltd.co.uk in:anywhere newer_than:40d",
]) {
  let list;
  try { list = await api(`/messages?q=${encodeURIComponent(q)}&maxResults=25`); } catch(e){ console.log(`[${q}] failed ${e.message}`); continue; }
  const ids = list.messages||[];
  console.log(`\n[${q}] -> ${ids.length}${list.resultSizeEstimate ? ` (est ${list.resultSizeEstimate})` : ""}`);
  for (const {id} of ids.slice(0,10)) {
    const m = await api(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Delivered-To`);
    console.log(`   ${hdr(m,"date").slice(0,17).padEnd(18)} ${hdr(m,"from").slice(0,34).padEnd(36)} ${hdr(m,"subject").slice(0,58)}`);
  }
}
