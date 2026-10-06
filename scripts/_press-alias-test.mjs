// Send one test to each new press@ alias, then report where each copy landed.
import { getGoogleAccessToken } from "../lib/google.js";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const FROM = "jb@thefleetmagazine.co.uk";
const HUB = "jb@smartsme.co.uk";
const DOMAINS = ["gymbusinessnews.com", "nurserydaily.com", "smartfarmingnews.com", "seniorlifestylebusiness.com", "dentalbusinessnews.com"];
const tag = `Press alias test ${Date.now().toString(36)}`;
const call = async (tok, p, opt = {}) => {
  const r = await fetch(`${API}${p}`, { ...opt, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" } });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || t.slice(0, 160)}`);
  return j;
};
const send = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], FROM);
for (const d of DOMAINS) {
  const raw = [`From: ${FROM}`, `To: press@${d}`, `Subject: ${tag} ${d}`, "Content-Type: text/plain; charset=utf-8", "", "Internal test that the press@ alias delivers. Safe to ignore."].join("\r\n");
  await call(send, "/messages/send", { method: "POST", body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }) });
  console.log(`sent -> press@${d}`);
}
await new Promise((r) => setTimeout(r, 45000));
const where = async (user, q) => {
  const tok = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], user);
  const names = new Map(((await call(tok, "/labels")).labels || []).map((l) => [l.id, l.name]));
  const ids = (await call(tok, `/messages?includeSpamTrash=true&q=${encodeURIComponent(q)}`)).messages || [];
  if (!ids.length) return "NOT FOUND";
  const m = await call(tok, `/messages/${ids[0].id}?format=minimal`);
  return (m.labelIds || []).map((i) => names.get(i) || i).join(", ");
};
for (const d of DOMAINS) {
  console.log(`press@${d}: ${await where(`jb@${d}`, `subject:"${tag} ${d}"`)}`);
  console.log(`   hub copy: ${await where(HUB, `subject:"${tag} ${d}"`)}`);
}
console.log(`sender outbox in inbox? ${await where(FROM, `subject:"${tag}" in:inbox`)}`);
