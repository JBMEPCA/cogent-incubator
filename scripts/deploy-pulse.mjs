/**
 * Install or update Cogent Pulse on every title.
 *
 * It goes in mu-plugins rather than the theme on purpose. Measurement should
 * not be able to die because somebody switches a theme or a child overrides a
 * template, mu-plugins load before themes and cannot be deactivated by accident
 * in wp-admin, and it keeps a thing that writes to the database separate from
 * the things that render pages.
 *
 * Over SSH with base64, like every other write to these sites: the SiteGround
 * WAF answers 403 to wp-json requests carrying an Authorization header, so the
 * REST route is not an option for deploying.
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/deploy-pulse.mjs [--site=<slug>] [--dry-run]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const SRC = path.resolve("../cogent-base-theme/mu-plugins/cogent-pulse.php");
const TOKEN = (process.env.PULSE_TOKEN || "").trim();
if (!TOKEN) console.warn("No PULSE_TOKEN in the environment: the report route will stay closed.");

if (!fs.existsSync(SRC)) {
  console.error(`No plugin at ${SRC}`);
  process.exit(1);
}
const php = fs.readFileSync(SRC);
const version = (php.toString("utf8").match(/^ \* Version: (.+)$/m) || [])[1] || "?";
console.log(`cogent-pulse ${version}, ${php.length} bytes${DRY ? "  [DRY RUN]" : ""}\n`);

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] }, ...(ONLY ? { slug: ONLY } : {}) },
  orderBy: { slug: "asc" },
});

let done = 0;
const failed = [];
for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  if (!s?.host) {
    console.log(`${site.slug.padEnd(28)} no sftp credential, skipped`);
    continue;
  }
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = [
    "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(s.port || 18765),
    `${s.username}@${s.host}`,
  ];
  const ssh = (cmd, input) =>
    execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();

  try {
    if (DRY) {
      const present = ssh(`test -f ${docroot}/wp-content/mu-plugins/cogent-pulse.php && echo yes || echo no`);
      console.log(`${site.slug.padEnd(28)} would install, already present: ${present}`);
      continue;
    }
    ssh(`mkdir -p ${docroot}/wp-content/mu-plugins`);
    ssh(`base64 -d > ${docroot}/wp-content/mu-plugins/cogent-pulse.php`, php.toString("base64"));
    // Touching the file is not enough: the table is created on the first init
    // after install, so prod it once and read the version back.
    ssh(`cd ${docroot} && wp eval 'do_action("init");' --skip-themes >/dev/null 2>&1 || true`);
    // The same token on every title, matching PULSE_TOKEN in the app, so the
    // dashboard can read all ten with one secret. Without it the report route
    // answers 404 rather than serving the numbers to anybody who asks.
    if (TOKEN) {
      ssh(`cd ${docroot} && wp option update cogent_pulse_token ${TOKEN} --skip-themes >/dev/null`);
    }
    const dbv = ssh(`cd ${docroot} && wp option get cogent_pulse_db_version --skip-themes 2>/dev/null || echo "-"`);
    // The prefix is randomised per SiteGround install (njm_, not wp_), so ask
    // for it rather than assuming, or this reports a healthy table as missing.
    const prefix = ssh(`cd ${docroot} && wp db prefix --skip-themes --skip-plugins`).trim();
    const table = ssh(`cd ${docroot} && wp db query "SHOW TABLES LIKE '${prefix}cogent_pulse'" --skip-themes --skip-plugins 2>/dev/null | tail -1`);
    console.log(`${site.slug.padEnd(28)} installed · db version ${dbv} · table ${table || "NOT CREATED"}`);
    done++;
  } catch (e) {
    console.log(`${site.slug.padEnd(28)} FAILED: ${String(e.message).slice(0, 110)}`);
    failed.push(site.slug);
  }
}

console.log(`\n${done} installed, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
await prisma.$disconnect();
