// Run a WP-CLI command on a title's host over the deploy SSH key.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_wp.mjs <slug> <wp args...>
// Useful when SiteGround's captcha is challenging this IP on the REST API.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const [slug, ...args] = process.argv.slice(2);
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
await prisma.$disconnect();
const q = (s) => `'${String(s).replace(/'/g, `'\''`)}'`;
const root = cfg.themePath.split("/wp-content/")[0];
const out = execFileSync("ssh", ["-i", cfg.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(cfg.port || 18765),
  `${cfg.username}@${cfg.host}`, `cd ${q(root)} && wp ${args.map(q).join(" ")}`], { encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(out);
