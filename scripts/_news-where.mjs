import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process";
for (const f of [".env.local", ".env"]) { const p = path.join(process.cwd(), f); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ""); } }
const { prisma } = await import("../lib/prisma.js"); const { siteCredentials } = await import("../lib/site.js");
const want = { "fleet-magazine": "news@thefleetmagazine.co.uk", "golf-resort-magazine": "news@golfresortmagazine.com" };
for (const [slug, addr] of Object.entries(want)) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const { creds } = await siteCredentials(site.id); const sftp = creds.sftp;
  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const ssh = (cmd) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd], { encoding: "utf8", timeout: 180000 }).trim();
  console.log(`\n## ${site.name}`);
  console.log(ssh(`cd '${docroot}' && wp db search '${addr}' --all-tables-with-prefix --before_context=40 --after_context=40 | head -40`));
}
await prisma.$disconnect();
