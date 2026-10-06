/**
 * Monday 21 Sep 2026 check: confirm Mark Williams (1333) is the live pinned
 * lead, purge caches, and confirm the homepage HTML leads with him. Read-only
 * apart from the cache purge.
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 90000, maxBuffer: 50 * 1024 * 1024 }).trim();

const lead = ssh(`cd '${docroot}' && wp eval 'echo cogent_pinned_lead();'`);
console.log("pinned lead:", lead);
if (lead !== "1333") { console.log("STOP: pinned lead is not 1333"); process.exit(0); }

console.log(ssh(`cd '${docroot}' && (wp sg purge || true) && wp cache flush`));

const html = ssh(`curl -sL 'https://smartsme.co.uk/?nocache=${Date.now()}'`);
const mark = html.indexOf("sme-leaders-mark-williams-on-the-leg-nobody-should-hide");
const penny = html.indexOf("sme-leaders-penny-joyner-platt-on-finding-the-real-story");
console.log({ length: html.length, mark, penny });
console.log(mark >= 0 && (penny < 0 || mark < penny) ? "OK: Mark leads" : "FAIL: Mark does not lead");
