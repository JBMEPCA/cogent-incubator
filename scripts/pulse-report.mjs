/**
 * What Cogent Pulse has counted, per title.
 *
 * Doubles as the install check: if the table answers, the plugin is live.
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/pulse-report.mjs [--days=7]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const DAYS = Number((process.argv.find((a) => a.startsWith("--days=")) || "").split("=")[1] || 7);

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  orderBy: { slug: "asc" },
});

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
console.log(`Cogent Pulse, since ${since}\n`);
console.log("title".padEnd(28) + "human".padStart(8) + "bots".padStart(8) + "  by source");

let totalHuman = 0;
let totalBots = 0;
for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  if (!s?.host) continue;
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = [
    "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
    "-o", "BatchMode=yes",
    "-p", String(s.port || 18765),
    `${s.username}@${s.host}`,
  ];
  const ssh = (cmd) => {
    try {
      return execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 150000 }).trim();
    } catch (e) {
      return null;
    }
  };

  const prefix = ssh(`cd ${docroot} && wp db prefix --skip-themes --skip-plugins`);
  if (!prefix) {
    console.log(site.slug.padEnd(28) + "  could not reach wp-cli");
    continue;
  }
  // Single quotes inside, double outside: the query is one argument and the
  // shell never sees a quote it has to think about.
  const sql = `SELECT source, SUM(views) AS v FROM ${prefix.trim()}cogent_pulse WHERE day >= '${since}' GROUP BY source`;
  const out = ssh(`cd ${docroot} && wp db query "${sql}" --skip-themes --skip-plugins`);
  if (out === null) {
    console.log(site.slug.padEnd(28) + "  no table yet (nothing counted)");
    continue;
  }
  const rows = out
    .split("\n")
    .slice(1)
    .map((l) => l.split("\t"))
    .filter((c) => c.length === 2);
  const by = Object.fromEntries(rows.map(([k, v]) => [k, Number(v)]));
  const bots = by.bot || 0;
  const human = Object.entries(by).reduce((a, [k, v]) => (k === "bot" ? a : a + v), 0);
  totalHuman += human;
  totalBots += bots;
  const detail = Object.entries(by)
    .filter(([k]) => k !== "bot")
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  console.log(
    site.slug.padEnd(28) + String(human).padStart(8) + String(bots).padStart(8) + "  " + (detail || "—")
  );
}

console.log("-".repeat(60));
console.log("FLEET".padEnd(28) + String(totalHuman).padStart(8) + String(totalBots).padStart(8));
await prisma.$disconnect();
