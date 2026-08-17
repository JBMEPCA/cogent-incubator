// Sweep EVERY title. Run this after touching anything shared — the parent
// theme, an agent prompt, a gate, a script.
//
//   node scripts/check-all-titles.mjs
//
// Exists because the same mistake happened three times in one day: shared code
// changed to suit the title in front of me, and the other title silently wore
// it. Agent prompts naming one title, a tools list holding one title's
// editorial choice, and a masthead pointing at one title's accent colour, which
// turned a live site orange. Checking the other title was always a thing to
// remember, so it was forgotten. Now it is one command.
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { prisma } = await import("../lib/prisma.js");
const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  select: { slug: true, name: true },
  orderBy: { createdAt: "asc" },
});
await prisma.$disconnect();

if (!sites.length) {
  console.log("No live titles.");
  process.exit(0);
}

const run = (args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });

console.log(`Sweeping ${sites.length} live title(s): ${sites.map((s) => s.name).join(", ")}\n`);

const results = [];
for (const s of sites) {
  for (const [label, script, extra] of [
    ["config", "scripts/verify-title.mjs", []],
    ["pages ", "scripts/check-pages.mjs", ["--mobile"]],
  ]) {
    const { code, out } = await run([script, `--site=${s.slug}`, ...extra]);
    const summary =
      out.split("\n").reverse().find((l) => /\d+\/\d+/.test(l))?.trim() || "no summary";
    const ok = code === 0;
    results.push({ site: s.name, label, ok, summary });
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${s.name.padEnd(20)} ${label}  ${summary}`);
    if (!ok) {
      for (const line of out.split("\n").filter((l) => /FAIL/.test(l))) {
        console.log(`          ${line.trim()}`);
      }
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log(`  BROKEN: ${failed.map((r) => `${r.site} (${r.label.trim()})`).join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("  Every title healthy.");
}
