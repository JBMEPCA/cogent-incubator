import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
const prisma = new PrismaClient();
const [slug, term] = process.argv.slice(2);
const site = await prisma.site.findUnique({ where: { slug } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
if (!s) { console.log(slug, "no sftp credential"); process.exit(1); }
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const args = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
const out = execFileSync("ssh", [...args, `${s.username}@${s.host}`,
  `cd '${docroot}' && wp post list --post_type=post --post_status=publish --s='${term}' --fields=ID,post_title,post_date --format=csv`],
  { encoding: "utf8", timeout: 180000 });
console.log(out.trim());
await prisma.$disconnect();
