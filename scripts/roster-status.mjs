// One line per roster: how close each title is to a hundred usable people.
//
// Counting with awk does not work on these files. A role like "Founder, Kavee"
// is quoted and contains a comma, so a naive field split shifts every column
// after it and undercounts the addresses. This reads them with the same parser
// that wrote them.
//
//   node --import ./scripts/node-resolve-hook.mjs scripts/roster-status.mjs

import fs from "node:fs";
import path from "node:path";
import { readRoster } from "./lib/roster.mjs";

const DIR = process.argv[2] || "scripts/roster";
const TARGET = 100;

if (!fs.existsSync(DIR)) {
  console.error(`No ${DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".csv") && !f.includes(".clean") && !f.includes(".leads"));
if (!files.length) {
  console.log(`No rosters in ${DIR} yet.`);
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("title", 16)}${pad("named", 8)}${pad("emailed", 9)}${pad("flagged", 9)}to 100`);

let totalReady = 0;
for (const f of files.sort()) {
  const rows = readRoster(path.join(DIR, f));
  const named = rows.filter((r) => r.name && r.name.includes(" ")).length;
  const ready = rows.filter((r) => r.name && r.email).length;
  // Rows a person should glance at before sending: the domain was worked out
  // rather than published, or the address sits on another company's domain.
  const flagged = rows.filter((r) => r.email && /guessed|another domain/.test(r.source || "")).length;
  totalReady += ready;
  const short = Math.max(0, TARGET - ready);
  console.log(
    `${pad(f.replace(/\.csv$/, ""), 16)}${pad(named, 8)}${pad(ready, 9)}${pad(flagged, 9)}${short ? `${short} short` : "done"}`
  );
}
console.log(`\n${totalReady} people across ${files.length} titles have both a name and an address.`);
