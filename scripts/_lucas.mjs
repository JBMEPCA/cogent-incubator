import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); const t = await r.text(); const j=t?JSON.parse(t):{}; if(!r.ok) throw new Error(`${r.status} ${j?.error?.message||t.slice(0,120)}`); return j; };
const hdr = (m,n) => m.payload?.headers?.find(h=>h.name.toLowerCase()===n)?.value || "";
let pageToken, ids = [];
do {
  const l = await api(`/messages?q=${encodeURIComponent("from:lucas@cimltd.co.uk in:anywhere after:2026/10/01")}&maxResults=100${pageToken?`&pageToken=${pageToken}`:""}`);
  ids.push(...(l.messages||[])); pageToken = l.nextPageToken;
} while (pageToken && ids.length < 300);
console.log(`Lucas, messages into the hub since 1 October: ${ids.length}\n`);
const to = {};
const rows = [];
for (const {id} of ids) {
  const m = await api(`/messages/${id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Delivered-To&metadataHeaders=Cc`);
  const t = (hdr(m,"to") + " " + hdr(m,"cc")).toLowerCase();
  for (const a of t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+/g) || ["(none)"]) to[a] = (to[a]||0)+1;
  rows.push({ d: hdr(m,"date").slice(5,16), to: hdr(m,"to").slice(0,46), s: hdr(m,"subject").slice(0,52) });
}
console.log("addressed to:");
for (const [a,n] of Object.entries(to).sort((x,y)=>y[1]-x[1])) console.log(`  ${String(n).padStart(3)}  ${a}`);
console.log("\nmost recent 30:");
for (const r of rows.slice(0,30)) console.log(`  ${r.d.padEnd(12)} ${r.to.padEnd(48)} ${r.s}`);
