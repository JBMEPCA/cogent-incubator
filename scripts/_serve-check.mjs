import os from "node:os"; import { execFileSync } from "node:child_process";
const url = process.argv[2];
const { prisma } = await import("../lib/prisma.js"); const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } }); const { creds } = await siteCredentials(site.id); await prisma.$disconnect();
const s = creds.sftp; const key = s.privateKeyPath.replace(/^~/, os.homedir());
const page = execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `curl -s -o /dev/null -w '%{http_code} %{size_download}' -A 'Mozilla/5.0 (CogentCheck)' '${url}'`], { encoding: "utf8", timeout: 60000 }).trim();
console.log("server-side:", page);
