import { getGoogleAccessToken } from "../lib/google.js";
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.settings.basic","https://www.googleapis.com/auth/gmail.labels"], HUB);
const api = async (p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } }); const t = await r.text(); const j = t ? JSON.parse(t) : {}; if (!r.ok) throw new Error(`${r.status} ${j?.error?.message}`); return j; };
const labels = new Map(((await api("/labels")).labels || []).map((l) => [l.id, l.name]));
const f = (await api("/settings/filters")).filter || [];
console.log(`${f.length} filters on ${HUB}\n`);
for (const x of f) {
  const add = (x.action?.addLabelIds || []).map((i) => labels.get(i) || i).join("+") || "-";
  const rm = (x.action?.removeLabelIds || []).map((i) => labels.get(i) || i).join("+") || "-";
  console.log(`add:${add} | remove:${rm} | ${(x.criteria?.query || JSON.stringify(x.criteria)).slice(0, 110)}`);
}
