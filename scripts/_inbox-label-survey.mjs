// What labels the hub has, and which combinations its recent mail carries.
// Read-only.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_inbox-label-survey.mjs [days]
import { getGoogleAccessToken } from "../lib/google.js";
import { HUB } from "../lib/inbox-labels.js";
const days = Number(process.argv[2] || 14);
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], HUB);
const api = async (p) => (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${p}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const labels = (await api("/labels")).labels.filter((l) => l.type === "user");
const name = new Map(labels.map((l) => [l.id, l.name]));
console.log("USER LABELS:");
for (const l of labels.sort((a, b) => a.name.localeCompare(b.name))) console.log(`  ${l.name.padEnd(28)} list=${l.messageListVisibility || "-"} color=${l.color ? l.color.backgroundColor : "-"}`);
let ids = [], page = "";
do {
  const r = await api(`/messages?q=${encodeURIComponent(`newer_than:${days}d -in:chats -in:sent`)}&maxResults=500${page ? `&pageToken=${page}` : ""}`);
  ids.push(...(r.messages || []).map((m) => m.id)); page = r.nextPageToken;
} while (page && ids.length < 1500);
const combos = new Map(), perCount = new Map();
for (const id of ids) {
  const m = await api(`/messages/${id}?format=minimal`);
  const mine = (m.labelIds || []).map((x) => name.get(x)).filter(Boolean).sort();
  const k = mine.join(" + ") || "(none)";
  combos.set(k, (combos.get(k) || 0) + 1);
  perCount.set(mine.length, (perCount.get(mine.length) || 0) + 1);
}
console.log(`\n${ids.length} messages in ${days} days; by number of user labels:`, Object.fromEntries([...perCount].sort()));
console.log("\nCOMBINATIONS:");
for (const [k, n] of [...combos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
