import os from "node:os"; import fs from "node:fs"; import { execFileSync } from "node:child_process";
const { prisma } = await import("../lib/prisma.js"); const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } }); const { creds } = await siteCredentials(site.id); await prisma.$disconnect();
const s = creds.sftp; const key = s.privateKeyPath.replace(/^~/, os.homedir()); const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const b64 = execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && f=$(wp post get 1497 --field=_wp_attached_file 2>/dev/null || wp post meta get 1497 _wp_attached_file) && base64 -w0 "wp-content/uploads/$f"`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const out = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/9f9b30fb-af03-4f7b-a6f4-adf18b310b2c/scratchpad/allica-hero.jpg";
fs.writeFileSync(out, Buffer.from(b64, "base64")); console.log(out, fs.statSync(out).size, "bytes");
