import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
const prisma = new PrismaClient();
const [slug, id] = process.argv.slice(2);
const site = await prisma.site.findUnique({ where: { slug } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const args = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
const out = execFileSync("ssh", [...args, `${s.username}@${s.host}`,
  `cd '${docroot}' && wp post get ${id} --fields=ID,post_status,post_title --format=csv`], { encoding: "utf8", timeout: 120000 });
console.log(out.trim());
await prisma.$disconnect();
