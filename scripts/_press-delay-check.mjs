// Does the delay actually land where JB asked, 20 to 40 minutes after the
// piece goes live? The wait itself is base + jitter, but delivery happens on
// the next press tick after that, and the cron runs every 15 minutes, so the
// tick granularity is part of the answer.
//
//   node scripts/_press-delay-check.mjs
// Pulled out of the real source rather than imported, because press-intake.js
// drags in the Anthropic SDK and this worktree has no node_modules. The
// function under test is the shipped text, not a copy.
import fs from "node:fs";
const src = fs.readFileSync(new URL("../lib/press-intake.js", import.meta.url), "utf8");
const fn = src.match(/export function replyJitterMins[\s\S]*?\n}/);
if (!fn) throw new Error("replyJitterMins not found in lib/press-intake.js");
const replyJitterMins = new Function(`${fn[0].replace(/^export /, "")}; return replyJitterMins;`)();
console.log(`testing the shipped function, ${fn[0].split("\n").length} lines:\n${fn[0]}\n`);

const BASE = 20; // the default in replyDelayMins()
const TICK = 15; // */15 on the Cloudflare trigger

const ids = Array.from({ length: 20000 }, (_, i) => `19a${(i * 2654435761 % 0xffffffff).toString(16)}f${i}`);

const jitters = new Map();
const delays = [];
for (const id of ids) {
  const j = replyJitterMins(id);
  jitters.set(j, (jitters.get(j) || 0) + 1);

  // Publication can fall anywhere inside a tick window.
  const publishOffset = Math.random() * TICK;
  const owed = BASE + j;
  // The next tick strictly after the wait is up.
  let tick = TICK - publishOffset;
  while (tick < owed) tick += TICK;
  delays.push(tick);
}

const min = Math.min(...delays);
const max = Math.max(...delays);
const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
const sorted = [...delays].sort((a, b) => a - b);
const pct = (p) => sorted[Math.floor((sorted.length - 1) * p)];

console.log(`jitter spread (expect 0-5, roughly even):`);
for (const j of [...jitters.keys()].sort((a, b) => a - b)) {
  console.log(`  +${j} min  ${String(jitters.get(j)).padStart(5)}`);
}
console.log(`\nstability: same id twice -> ${replyJitterMins(ids[0])} and ${replyJitterMins(ids[0])}`);

console.log(`\ndelivery, minutes after the article went live:`);
console.log(`  min    ${min.toFixed(1)}`);
console.log(`  median ${pct(0.5).toFixed(1)}`);
console.log(`  mean   ${mean.toFixed(1)}`);
console.log(`  p95    ${pct(0.95).toFixed(1)}`);
console.log(`  max    ${max.toFixed(1)}`);

const inRange = delays.filter((d) => d >= 20 && d <= 40).length;
console.log(`\ninside 20-40 minutes: ${((inRange / delays.length) * 100).toFixed(1)}%`);
console.log(`under 20 minutes:     ${((delays.filter((d) => d < 20).length / delays.length) * 100).toFixed(1)}%`);
console.log(`over 40 minutes:      ${((delays.filter((d) => d > 40).length / delays.length) * 100).toFixed(1)}%`);
