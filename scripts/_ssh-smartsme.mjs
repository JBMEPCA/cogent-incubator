// One-off helper: run a wp-cli command on Smart SME over SSH.
import "./_env.mjs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: process.env.SITE || "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const key = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
console.log(execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && ${process.argv[2]}`], { encoding: "utf8" }).trim());
await prisma.$disconnect();
