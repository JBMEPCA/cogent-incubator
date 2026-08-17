// Push a title's theme to its live site over SFTP. Replaces the zip-and-upload
// dance, which is survivable at one title and absurd at twenty-five.
//
//   node scripts/deploy-theme.mjs --site=fleet-magazine --from=../fleet-magazine-website/theme
//   node scripts/deploy-theme.mjs --site=fleet-magazine --dry-run
//
// Uses the system `sftp` binary rather than an npm dependency, and authenticates
// with a key whose private half never leaves this machine — the sftp credential
// stores only the PATH to it. There is deliberately no password field.
//
// Not a sync: it uploads, it never deletes. Removing a file from the theme means
// removing it on the server by hand, which is the safe default when the target
// is a live site and a stray delete takes the front page down.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const slug = arg("site");
const DRY = process.argv.includes("--dry-run");
if (!slug) {
  console.error("Usage: node scripts/deploy-theme.mjs --site=<slug> [--from=<dir>] [--dry-run]");
  process.exit(1);
}

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug } });
if (!site) { console.error(`No title "${slug}"`); process.exit(1); }
const { creds } = await siteCredentials(site.id);
const cfg = creds.sftp;

if (!cfg?.host) {
  console.error(`${site.name} has no SFTP credential stored.`);
  console.error("Add it at /s/" + slug + "/settings — host, port, username, themePath, privateKeyPath.");
  process.exit(1);
}

const from = path.resolve(arg("from") || `../${slug}-website/theme`);
if (!fs.existsSync(path.join(from, "style.css"))) {
  console.error(`No theme at ${from} (expected a style.css there).`);
  process.exit(1);
}

const keyPath = cfg.privateKeyPath.replace(/^~/, os.homedir());
if (!fs.existsSync(keyPath)) {
  console.error(`Private key not found at ${keyPath}`);
  process.exit(1);
}

// Walk the theme, skipping anything that must never reach a live site.
const SKIP = /(^|\/)(\.git|node_modules|\.DS_Store|\.dev-seed|dev-seed\.php|.*\.bak)$/;
function walk(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const rel = base ? `${base}/${name}` : name;
    if (SKIP.test(rel) || SKIP.test(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const files = walk(from);
const dirs = [...new Set(files.map((f) => path.posix.dirname(f)).filter((d) => d !== "."))].sort();
const remote = cfg.themePath.replace(/\/$/, "");

console.log(`${site.name}`);
console.log(`  from   ${from}`);
console.log(`  to     ${cfg.username}@${cfg.host}:${remote}`);
console.log(`  files  ${files.length} in ${dirs.length + 1} directories\n`);

if (DRY) {
  for (const f of files) console.log(`  would upload  ${f}`);
  console.log("\n--- DRY RUN, nothing sent ---");
  await prisma.$disconnect();
  process.exit(0);
}

// One batch file, one connection. `-mkdir` and `-` prefixes mean "carry on if
// this fails", which is what we want for directories that already exist.
const batch = [
  `-mkdir ${remote}`,
  ...dirs.map((d) => `-mkdir ${remote}/${d}`),
  ...files.map((f) => `put "${path.join(from, f)}" "${remote}/${f}"`),
  "quit",
].join("\n");

const batchFile = path.join(os.tmpdir(), `cogent-deploy-${slug}.batch`);
fs.writeFileSync(batchFile, batch + "\n");

try {
  execFileSync(
    "sftp",
    [
      "-b", batchFile,
      "-i", keyPath,
      "-P", String(cfg.port || 18765),
      "-o", "StrictHostKeyChecking=accept-new",
      "-o", "BatchMode=yes",
      `${cfg.username}@${cfg.host}`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], timeout: 300000 }
  );
  console.log(`  uploaded ${files.length} files`);
  console.log("\nDone. Purge the host cache if the change is in <head> or CSS.");
} catch (e) {
  const err = (e.stderr?.toString() || e.stdout?.toString() || e.message).trim();
  console.error("FAILED:\n" + err.split("\n").slice(-12).join("\n"));
  process.exitCode = 1;
} finally {
  fs.rmSync(batchFile, { force: true });
  await prisma.$disconnect();
}
