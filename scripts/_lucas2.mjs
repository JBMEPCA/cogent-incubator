import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); const t = await r.text(); const j=t?JSON.parse(t):{}; if(!r.ok) throw new Error(`${r.status}`); return j; };
const hdr = (m,n) => m.payload?.headers?.find(h=>h.name.toLowerCase()===n)?.value || "";
const l = await api(`/messages?q=${encodeURIComponent("from:lucas@cimltd.co.uk in:anywhere after:2026/09/01")}&maxResults=100`);
let hub = 0, press = 0;
const hubRows = [];
for (const {id} of (l.messages||[])) {
  const m = await api(`/messages/${id}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`);
  const t = (hdr(m,"to")+" "+hdr(m,"cc")).toLowerCase();
  const toPress = /press@/.test(t);
  if (toPress) press++; else { hub++; hubRows.push(`${hdr(m,"date").slice(5,16).padEnd(13)} ${hdr(m,"subject").slice(0,64)}`); }
}
console.log(`Lucas, since 1 September: ${press} addressed to a press@ address, ${hub} to the hub only\n`);
console.log("the ones that went to the hub only, which the engine never sees:");
for (const r of hubRows) console.log("  " + r);
