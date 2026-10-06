/**
 * One-off: push the Smart SME child functions.php live, but only past php -l.
 *
 * deploy-theme.mjs uploads straight over the live file. A syntax error in
 * functions.php takes the whole front end down, and there is no PHP on this
 * machine to lint with, so this uploads to a temp name, lints it ON THE HOST,
 * keeps a timestamped backup of the live file, and only then moves it into
 * place. Purges SiteGround's cache afterwards, which the playbook says is
 * mandatory before believing anything about a deploy, then smoke-tests the
 * homepage and rolls back on a fatal.
 *
 * Run from cogent-incubator:
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_deploy-functions-guarded.mjs
 */
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const LOCAL = path.resolve("../smart-sme-website/child/functions.php");

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
await prisma.$disconnect();

const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const port = String(cfg.port || 18765);
const target = `${cfg.username}@${cfg.host}`;
const common = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"];
const live = `${cfg.themePath}/functions.php`;
const tmp = `${cfg.themePath}/functions.php.incoming`;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `${cfg.themePath}/functions.php.bak-${stamp}`;

const ssh = (cmd) => execFileSync("ssh", [...common, "-p", port, target, cmd], { encoding: "utf8", timeout: 60000 });

console.log("upload -> .incoming");
execFileSync("scp", [...common, "-P", port, LOCAL, `${target}:${tmp}`], { encoding: "utf8", timeout: 60000 });

console.log("lint on host");
let lint;
try {
  lint = ssh(`php -l "${tmp}"`);
} catch (e) {
  console.error("LINT FAILED, live file untouched:\n" + (e.stdout || e.message));
  ssh(`rm -f "${tmp}"`);
  process.exit(1);
}
console.log("  " + lint.trim());

console.log("backup + swap");
console.log(ssh(`cp -p "${live}" "${backup}" && mv "${tmp}" "${live}" && ls -la "${live}" "${backup}"`));

console.log("purge cache");
const wpRoot = cfg.themePath.replace(/\/wp-content\/themes\/[^/]+$/, "");
try {
  console.log(ssh(`cd "${wpRoot}" && wp cache flush 2>&1; wp sg purge 2>&1 || echo "(sg purge unavailable)"`));
} catch (e) {
  console.log("purge reported: " + (e.stdout || e.message).trim());
}

console.log("homepage smoke test");
const res = await fetch("https://smartsme.co.uk/", { headers: { "user-agent": "Mozilla/5.0 (deploy-check)" } });
const html = await res.text();
const fatal = /There has been a critical error|Parse error|Fatal error/i.test(html);
console.log(`  HTTP ${res.status}, ${html.length} bytes, hero present: ${/hero-feature/.test(html)}, fatal: ${fatal}`);
if (!res.ok || fatal) {
  console.error("HOMEPAGE BROKEN, rolling back");
  console.log(ssh(`cp -p "${backup}" "${live}" && cd "${wpRoot}" && wp cache flush 2>&1`));
  process.exit(1);
}
console.log("deployed");
