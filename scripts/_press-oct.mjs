// What actually arrived at each press@ address in October, straight from the hub.
import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || t.slice(0,160)}`);
  return j;
};
const ADDR = [
  ["smart-sme", "press@smartsme.co.uk"],
  ["fleet", "press@thefleetmagazine.co.uk"],
  ["golf", "press@golfresortmagazine.com"],
  ["barbering", "press@barberingbusiness.com"],
  ["airport", "press@airportbusinessmagazine.com"],
  ["gym", "press@gymbusinessnews.com"],
  ["nursery", "press@nurserydaily.com"],
  ["senior", "press@seniorlifestylebusiness.com"],
  ["dental", "press@dentalbusinessnews.com"],
  ["farming", "press@smartfarmingnews.com"],
];
console.log("messages delivered to each press@ address since 1 October (hub view):");
for (const [slug, addr] of ADDR) {
  const q = `deliveredto:${addr} after:2026/10/01 in:anywhere`;
  let n = 0;
  try { const l = await api(`/messages?q=${encodeURIComponent(q)}&maxResults=200`); n = (l.messages||[]).length; }
  catch (e) { console.log(`  ${slug.padEnd(10)} query failed: ${e.message}`); continue; }
  // fall back to to: in case Delivered-To is not indexed for an alias
  let n2 = 0;
  try { const l2 = await api(`/messages?q=${encodeURIComponent(`to:${addr} after:2026/10/01 in:anywhere`)}&maxResults=200`); n2 = (l2.messages||[]).length; } catch {}
  console.log(`  ${slug.padEnd(10)} ${addr.padEnd(42)} delivered-to ${String(n).padStart(3)}   to: ${String(n2).padStart(3)}`);
}
