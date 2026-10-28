// What the two-label pass would do to the hub, without changing anything.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_inbox-two-labels-dry.mjs [days]
import { runInboxLabels } from "../lib/inbox-labels.js";
const days = Number(process.argv[2] || 14);
const r = await runInboxLabels({ days, maxMessages: 2000, budgetMs: 15 * 60000, dryRun: true });
if (!r.available) { console.log(r); process.exit(1); }
const combos = new Map();
for (const p of r.preview) { const k = `${p.title || "(no title)"} + ${p.display || "(sent: title only)"}`; combos.set(k, (combos.get(k) || 0) + 1); }
console.log(`${r.messages} messages, truncated=${r.truncated}\n\nAFTER (title + what is it):`);
for (const [k, n] of [...combos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
console.log("\nNO TITLE:");
for (const p of r.preview.filter((p) => !p.title).slice(0, 15)) console.log(`  ${p.from.padEnd(36)} ${p.subject}`);
console.log("\nPRESS SAMPLE:");
for (const p of r.preview.filter((p) => /^PR/.test(p.display || "")).slice(0, 25)) console.log(`  ${(p.title || "-").padEnd(16)} ${p.display.padEnd(14)} ${p.subject}`);
console.log("\nLABEL CHANGES:", r.changes);
