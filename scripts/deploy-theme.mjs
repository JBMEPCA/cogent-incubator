// Push a title's theme to its live site over SFTP. Replaces the zip-and-upload
// dance, which is survivable at one title and absurd at twenty-five.
//
//   node scripts/deploy-theme.mjs --site=fleet-magazine --from=../fleet-magazine-website/child
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

// Default to child/: every live title runs a child of cogent-base. The old
// default was theme/, which for smart-sme and fleet-magazine was the retired
// pre-split standalone fork — a bare `--site=` run would have pushed a stale
// fork over the live child and reintroduced its hardcoded branding.
const from = path.resolve(arg("from") || `../${slug}-website/child`);
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
// --to overrides the credential's themePath. The shared parent theme lives
// beside the title's own directory rather than inside it, so deploying it needs
// a sibling path on the same host and key.
//
// Guard against MSYS path mangling. Git Bash rewrites an argument that looks
// like a Unix absolute path into a Windows one, so `--to=/home/u18-.../themes/x`
// arrived as `C:/Program Files/Git/home/u18-.../themes/x` and the first run
// built that entire tree inside the server's home directory. Run the command
// with MSYS_NO_PATHCONV=1, or pass the path with a leading double slash.
const rawTo = arg("to");
if (rawTo && /^[A-Za-z]:[\\/]/.test(rawTo)) {
  console.error(`--to was mangled into a Windows path: ${rawTo}`);
  console.error("Git Bash rewrote it. Re-run with MSYS_NO_PATHCONV=1 prefixed to the command.");
  process.exit(1);
}
const remote = (rawTo || cfg.themePath).replace(/\/$/, "");
if (!remote.startsWith("/")) {
  console.error(`Remote path must be absolute, got: ${remote}`);
  process.exit(1);
}

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

const sshArgs = (extra) => [
  "-i", keyPath,
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "BatchMode=yes",
  ...extra,
];

// Directories first, over ssh rather than sftp. `mkdir -p` is idempotent and
// silent, where sftp's `-mkdir` prints a Failure line for every directory that
// already exists — which is all of them after the first deploy, and buries a
// real error in a wall of expected ones. It also leaves the sftp exit code
// meaning what it says.
const mkdirs = [remote, ...dirs.map((d) => `${remote}/${d}`)].map((d) => `'${d}'`).join(" ");

// Local paths MUST use forward slashes. sftp's batch parser treats a backslash
// as an escape, so a Windows path arrives with every separator eaten:
// C:\Users\CIM Ltd\... became C:UsersCIM Ltd... and every put failed.
const fwd = (p) => p.replace(/\\/g, "/");

const batchFile = path.join(os.tmpdir(), `cogent-deploy-${slug}.batch`);
fs.writeFileSync(
  batchFile,
  files.map((f) => `put "${fwd(path.join(from, f))}" "${remote}/${f}"`).join("\n") + "\nquit\n"
);

try {
  execFileSync("ssh", sshArgs(["-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`, `mkdir -p ${mkdirs}`]), {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });

  execFileSync(
    "sftp",
    sshArgs(["-b", batchFile, "-P", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`]),
    { stdio: ["ignore", "pipe", "pipe"], timeout: 300000 }
  );
  console.log(`  uploaded ${files.length} files`);

  // A parent deploy touches every title on this host, and the same mistake has
  // been made three times: shared code changed to suit the title in front of
  // you, and the other title silently wears it. Say so loudly, every time.
  const isParent = /cogent-base/.test(from) || /cogent-base$/.test(remote);
  if (isParent) {
    console.log("\n  ----------------------------------------------------------------");
    console.log("  THAT WAS THE SHARED PARENT THEME. It changes EVERY title here.");
    console.log("  Sweep them all before you call it done:");
    console.log("      node scripts/check-all-titles.mjs");
    console.log("  ----------------------------------------------------------------");
  }

  console.log("\nPurge the host cache before deciding a change had no effect:");
  console.log(`  ssh -i <key> -p ${cfg.port || 18765} ${cfg.username}@${cfg.host} \\`);
  console.log(`    "cd ~/www/*/public_html && wp sg purge && wp cache flush"`);
} catch (e) {
  const err = (e.stderr?.toString() || e.stdout?.toString() || e.message).trim();
  console.error("FAILED:\n" + err.split("\n").slice(-12).join("\n"));
  process.exitCode = 1;
} finally {
  fs.rmSync(batchFile, { force: true });
  await prisma.$disconnect();
}
