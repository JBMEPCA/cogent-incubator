// Lint changed parent-theme PHP on a host before deploying (no PHP locally).
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_lint-parent-php.mjs <site-slug> <file>...
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const [slug, ...files] = process.argv.slice(2);
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
await prisma.$disconnect();

const key = cfg.privateKeyPath.replace(/^~/, os.homedir());
const port = String(cfg.port || 18765);
const target = `${cfg.username}@${cfg.host}`;
const common = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"];
const dir = `lint-${Date.now()}`;
const ssh = (cmd) => execFileSync("ssh", [...common, "-p", port, target, cmd], { encoding: "utf8", timeout: 60000 });
ssh(`mkdir -p ~/${dir}`);
for (const f of files) {
  execFileSync("scp", [...common, "-P", port, path.resolve(f).split(path.sep).join("/"), `${target}:${dir}/`], { timeout: 60000 });
}
try {
  console.log(ssh(`cd ~/${dir} && for f in *.php; do php -l "$f"; done`));
} finally {
  ssh(`rm -rf ~/${dir}`);
}
