// Purge a title's host cache after a deploy.
//
//   node scripts/purge-cache.mjs --site=golf-resort-magazine
//   node scripts/purge-cache.mjs --all
//
// SiteGround caches hard enough to fake a bug — the playbook has a whole entry
// on it — so "the change did not work" is not a safe conclusion until this has
// run. Uses the SFTP credential's host, user and key, so no path or hostname
// has to be typed, and none of them are printed.
//
// `wp sg purge` only exists when the SG Optimizer plugin is active, so a
// non-zero exit from that half is reported and not treated as fatal; the
// object-cache flush is the part that always applies.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

for (const f of [".env.local", ".env"]) {
  const p = path.join(repo, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const ALL = process.argv.includes("--all");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const slugs = ALL
  ? (await prisma.site.findMany({ orderBy: { id: "asc" } })).map((s) => s.slug)
  : [arg("site")].filter(Boolean);

if (!slugs.length) {
  console.error("Usage: node scripts/purge-cache.mjs --site=<slug> | --all");
  await prisma.$disconnect();
  process.exit(1);
}

for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.error(`No title "${slug}"`); continue; }
  const { creds } = await siteCredentials(site.id);
  const cfg = creds?.sftp;
  if (!cfg?.host) { console.error(`${site.name}: no SFTP credential.`); continue; }

  const keyPath = cfg.privateKeyPath.replace(/^~/, os.homedir());
  // The document root is derived from the stored theme path rather than a glob,
  // so a host with more than one site under ~/www cannot have the wrong one
  // flushed.
  const docroot = cfg.themePath.replace(/\/wp-content\/themes\/.*$/, "");

  const run = (cmd) =>
    execFileSync(
      "ssh",
      ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
       "-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`, cmd],
      { encoding: "utf8", timeout: 120000 }
    ).trim();

  process.stdout.write(`${site.name.padEnd(24)} `);
  try {
    let out = "";
    try { out += run(`cd '${docroot}' && wp sg purge 2>&1 | tail -2`); }
    catch (e) { out += "sg purge unavailable"; }
    try { out += " | " + run(`cd '${docroot}' && wp cache flush 2>&1 | tail -1`); }
    catch (e) { out += " | cache flush failed"; }
    console.log(out.replace(/\s+/g, " "));
  } catch (e) {
    console.log("FAILED: " + (e.stderr || e.message).toString().split("\n").slice(-2).join(" "));
  }
}

await prisma.$disconnect();
