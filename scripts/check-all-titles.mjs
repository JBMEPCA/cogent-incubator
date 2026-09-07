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
    // Exit 2 means the checker never got to look: the host served a bot
    // challenge to this IP. That is not a failing title and must not be counted
    // as one, or a deploy that went out perfectly reads as five broken sites
    // and somebody reverts it.
    const blocked = code === 2;
    const ok = code === 0;
    results.push({ site: s.name, label, ok, blocked, summary });
    const tag = ok ? "PASS" : blocked ? "SKIP" : "FAIL";
    console.log(`  ${tag}  ${s.name.padEnd(20)} ${label}  ${blocked ? "not checked, host challenged this IP" : summary}`);
    if (!ok && !blocked) {
      for (const line of out.split("\n").filter((l) => /FAIL/.test(l))) {
        console.log(`          ${line.trim()}`);
      }
    }
  }
}

const failed = results.filter((r) => !r.ok && !r.blocked);
const blocked = results.filter((r) => r.blocked);
console.log("\n  " + results.filter((r) => r.ok).length + "/" + results.length + " checks passed");

if (failed.length) {
  console.log("  BROKEN: " + failed.map((r) => r.site + " (" + r.label.trim() + ")").join(", "));
}

// Kept apart from BROKEN on purpose. "I could not see the site" and "the site
// is down" look identical in a status code and mean opposite things: the first
// is a reason to wait, the second is a reason to roll back.
if (blocked.length) {
  console.log("  NOT CHECKED: " + blocked.map((r) => r.site + " (" + r.label.trim() + ")").join(", "));
  console.log("  The host is challenging this IP, which a deploy's own SSH and HTTP traffic");
  console.log("  is enough to trigger. Nothing above says these titles are unhealthy.");
  console.log("  Wait for the challenge to lapse and re-run, or have each server fetch its");
  console.log("  own homepage with wp eval-file, which comes from the server's IP.");
}

if (failed.length) {
  process.exitCode = 1;
} else if (blocked.length) {
  process.exitCode = 2;
} else {
  console.log("  Every title healthy.");
}
