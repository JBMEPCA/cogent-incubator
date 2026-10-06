/**
 * One-off, 21 Sep 2026: BDP's release was covered twice on Fleet. Keep JB's
 * 13:35 piece (1130), take the press desk's 14:01 duplicate (1137) back to
 * draft, and make 1137's URL redirect to 1130 through WordPress's own old-slug
 * redirect, so both links emailed to Adam at BDP land on the live article.
 * Pass --apply to change anything.
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
const APPLY = process.argv.includes("--apply");
const KEEP = 1130, DROP = 1137;
const OLD = "small-fleets-uk-two-thirds-run-fewer-than-50-vehicles";
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" }, select: { id: true } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
const wpRoot = cfg.themePath.split("/wp-content")[0];
const ssh = (cmd) => execFileSync("ssh", ["-i", cfg.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`, `cd "${wpRoot}" && ${cmd}`], { encoding: "utf8", timeout: 60000 }).trim();
console.log(ssh(`wp post list --post__in=${KEEP},${DROP} --post_status=any --fields=ID,post_status,post_name,post_title --format=table`));
console.log("1130 old slugs:", ssh(`wp post meta get ${KEEP} _wp_old_slug 2>/dev/null || echo none`));
if (APPLY) {
  console.log(ssh(`wp post update ${DROP} --post_status=draft`));
  console.log(ssh(`wp post meta add ${KEEP} _wp_old_slug ${OLD}`));
  console.log(ssh(`wp cache flush 2>&1; wp sg purge 2>&1 || true`));
  await prisma.$executeRawUnsafe(`update "Article" set status='idea' where "siteId"=$1 and "wpPostId"=$2`, site.id, DROP);
  console.log(ssh(`wp post list --post__in=${KEEP},${DROP} --post_status=any --fields=ID,post_status,post_name --format=table`));
}
await prisma.$disconnect();
for (const path of [OLD, "typical-uk-fleet-runs-just-five-vehicles-bdp-data-shows"]) {
  const r = await fetch(`https://thefleetmagazine.co.uk/${path}/?v=${Date.now()}`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (redirect-check)" } });
  console.log(`/${path}/ -> ${r.status} ${r.headers.get("location") || ""}`);
}
