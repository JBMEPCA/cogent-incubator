/**
 * Install or update the Cogent Ads mu-plugin on every title (or one).
 *
 * A mu-plugin for the same reasons as Pulse (scripts/deploy-pulse.mjs): it
 * cannot be switched off by accident in wp-admin, it survives a theme change,
 * and it keeps the thing that writes to the database apart from the templates.
 * The theme's slots (data-cogent-ad) are the other half and ship with the
 * parent theme from 1.33.0.
 *
 * Sets three options per site: where the incubator is (cogent_ads_source),
 * which title this is (cogent_ads_site, the incubator's slug) and the fleet
 * token Pulse already uses. Then pulls the feed once and reports what it got,
 * and lints the PHP on the server first, since nothing here can run PHP.
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/deploy-ads.mjs [--site=<slug>] [--dry-run]
 *
 * SOURCE defaults to production. A local dev server cannot be reached from
 * SiteGround, so do not point a live site at localhost.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const SOURCE = ((process.argv.find((a) => a.startsWith("--source=")) || "").split("=")[1] || "https://cogent-incubator.vercel.app").replace(/\/$/, "");
const SRC = path.resolve(process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] || "../cogent-base-theme/mu-plugins/cogent-ads.php");
const TOKEN = (process.env.PULSE_TOKEN || "").trim();

if (!fs.existsSync(SRC)) {
  console.error(`No plugin at ${SRC}`);
  process.exit(1);
}
if (!TOKEN) {
  console.error("No PULSE_TOKEN in the environment; the sites could not read the feed.");
  process.exit(1);
}
const php = fs.readFileSync(SRC);
const version = (php.toString("utf8").match(/^ \* Version: (.+)$/m) || [])[1] || "?";
console.log(`cogent-ads ${version}, ${php.length} bytes, source ${SOURCE}${DRY ? "  [DRY RUN]" : ""}\n`);

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
  const wp = (cmd) => ssh(`cd ${docroot} && wp ${cmd} --skip-themes`);

  try {
    if (DRY) {
      const present = ssh(`test -f ${docroot}/wp-content/mu-plugins/cogent-ads.php && echo yes || echo no`);
      console.log(`${site.slug.padEnd(28)} would install, already present: ${present}`);
      continue;
    }
    ssh(`mkdir -p ${docroot}/wp-content/mu-plugins`);
    // Into a temporary name, linted, then moved: a syntax error in a
    // mu-plugin takes the whole site down, and this cannot be undone fast
    // enough from here to make that acceptable.
    ssh(`base64 -d > ${docroot}/wp-content/mu-plugins/.cogent-ads.new`, php.toString("base64"));
    const lint = ssh(`php -l ${docroot}/wp-content/mu-plugins/.cogent-ads.new 2>&1 || true`);
    if (!/No syntax errors/.test(lint)) {
      ssh(`rm -f ${docroot}/wp-content/mu-plugins/.cogent-ads.new`);
      throw new Error(`php -l refused it: ${lint.slice(0, 200)}`);
    }
    ssh(`mv ${docroot}/wp-content/mu-plugins/.cogent-ads.new ${docroot}/wp-content/mu-plugins/cogent-ads.php`);
    wp(`option update cogent_ads_source ${SOURCE} >/dev/null`);
    wp(`option update cogent_ads_site ${site.slug} >/dev/null`);
    // The token is normally there already from Pulse; set it anyway so this
    // works on a title Pulse never reached.
    wp(`option update cogent_pulse_token ${TOKEN} >/dev/null`);
    // Creates the table on this init, then pulls the feed once.
    wp(`eval 'do_action("init"); $r = cogent_ads_sync(true); echo is_wp_error($r) ? "ERR ".$r->get_error_message() : "ok";'`);
    const ads = wp(`eval 'echo count((array) get_option("cogent_ads_feed", array()));'`);
    const err = ssh(`cd ${docroot} && (wp option get cogent_ads_last_error --skip-themes 2>/dev/null || echo -)`);
    // The prefix differs per SiteGround install (njm_ and so on), so match on the name.
    const table = ssh(`cd ${docroot} && (wp db tables --all-tables --skip-themes --skip-plugins 2>/dev/null | grep cogent_ads || true)`);
    console.log(`${site.slug.padEnd(28)} installed · ${ads} ads in feed · table ${table || "NOT CREATED"}${err && err !== "-" ? ` · last error: ${err}` : ""}`);
    done++;
  } catch (e) {
    console.log(`${site.slug.padEnd(28)} FAILED: ${String(e.message).slice(0, 160)}`);
    failed.push(site.slug);
  }
}

console.log(`\n${done} installed, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
await prisma.$disconnect();
