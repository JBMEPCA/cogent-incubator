// Lint PHP without a local PHP binary, by borrowing the host's.
//
//   node scripts/lint-php.mjs ../cogent-base-theme/cogent-base/inc/directory.php [more...]
//
// There is no php on this machine, and a syntax error in cogent-base takes down
// all five titles at once, not one. So every parent-theme edit gets linted on a
// real PHP before deploy-theme.mjs is allowed anywhere near it. Exits non-zero
// on the first failure so it can gate a deploy in a one-liner.
//
// Source travels over STDIN, not as an argument: a base64 blob on the command
// line blows the Windows argv limit at around 32k, which is smaller than most
// real source files, and fails with a bare ENAMETOOLONG that says nothing.
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { execFileSync } from "node:child_process";
for (const f of [".env.local",".env"]) { const p=path.join(process.cwd(),f); if(!fs.existsSync(p))continue;
  for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");}}
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const sftp = creds.sftp;
const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const base = ["-i",keyPath,"-o","StrictHostKeyChecking=accept-new","-o","BatchMode=yes",
  "-p",String(sftp.port||18765), `${sftp.username}@${sftp.host}`];
// Content goes over STDIN. A base64 blob on the command line blows the
// Windows argv limit at about 32k, which is smaller than any real source file.
const sshIn = (cmd, input) => execFileSync("ssh", [...base, cmd],
  { encoding:"utf8", timeout:120000, maxBuffer: 20*1024*1024, input });

let bad = 0;
for (const rel of process.argv.slice(2)) {
  const src = fs.readFileSync(rel, "utf8");
  const tmp = `/tmp/lint-${Date.now()}-${Math.random().toString(36).slice(2)}.php`;
  sshIn(`cat > '${tmp}'`, src);
  let out;
  try { out = sshIn(`php -l '${tmp}'; rm -f '${tmp}'`, "").trim(); }
  catch (e) { out = ((e.stdout||"") + (e.stderr||"") + (e.message||"")).toString().trim(); }
  const ok = /No syntax errors/.test(out);
  if (!ok) bad++;
  console.log((ok ? "  OK   " : "  FAIL ") + path.basename(rel).padEnd(20) + out.replace(/ in \/tmp\/[^\s]+/g, "").replace(/\s+/g," ").trim());
}
console.log(bad ? `\n${bad} FILE(S) FAILED — do not deploy` : "\nall clean");
await prisma.$disconnect();
process.exit(bad ? 1 : 0);
