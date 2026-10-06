// Purge SiteGround and object cache on one title or all of them.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_purge-title-cache.mjs <slug>|--all
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const arg = process.argv[2];
const prisma = new PrismaClient();
const sites = arg === "--all" ? await prisma.site.findMany({ orderBy: { id: "asc" } }) : [await prisma.site.findUnique({ where: { slug: arg } })];
for (const site of sites) {
  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
  if (!cfg?.host) { console.log(`${site.slug}: no sftp credential`); continue; }
  const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
  try {
    const out = execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-p", String(cfg.port || 18765), `${cfg.username}@${cfg.host}`,
      `cd "${cfg.themePath.split("/wp-content/")[0]}" && wp sg purge && wp cache flush`], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] });
    console.log(`${site.slug}: ${out.trim().split("\n").join(" | ")}`);
  } catch (e) {
    console.log(`${site.slug}: FAILED ${String(e.stderr || e.message).slice(0, 200)}`);
  }
}
await prisma.$disconnect();
