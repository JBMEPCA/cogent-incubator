// One-off: syntax-check PHP files on a live host before they are deployed.
// There is no PHP on this machine, so each file is piped over SSH into a temp
// file, run through php -l, and removed. Nothing on the site is touched.
//
//   node --import ./scripts/_register.mjs scripts/_lint-php-remote.mjs <file> [<file> ...]
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

const files = process.argv.slice(2);
const site = await prisma.site.findFirst({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();
const s = creds.sftp;
const key = s.privateKeyPath.replace(/^~/, os.homedir());

let failed = 0;
for (const f of files) {
  const tmp = `/tmp/_lint_${process.pid}_${path.basename(f)}`;
  let out;
  try {
    out = execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`,
      `cat > '${tmp}' && php -l '${tmp}' 2>&1; rm -f '${tmp}'`], { input: fs.readFileSync(f), encoding: "utf8", timeout: 60000 }).trim();
  } catch (e) {
    out = String(e.stdout || e.message).trim();
  }
  const ok = /No syntax errors detected/.test(out);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${f}${ok ? "" : `\n     ${out}`}`);
}
process.exit(failed ? 1 : 0);
