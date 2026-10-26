/**
 * Ship Gym child style.css 0.3.1 (every interview answer in a speech bubble,
 * same block Barbering got 8 Oct 2026). One file only, the live copy backed up
 * first; live and local were byte-identical at 0.3.0 before the edit.
 * JB, 8 Oct 2026: "all should be speech bubbles ... get the speech bubbles working".
 */
import os from "node:os"; import fs from "node:fs"; import { execFileSync } from "node:child_process";
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id); const s = creds.sftp;
const ssh = (a, input) => execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, a], { encoding: "utf8", timeout: 120000, input }).trim();
const dir = s.themePath.replace(/\/$/, "");
const docroot = dir.replace(/\/wp-content\/themes\/.*$/, "");
const css = fs.readFileSync("../gym-business-news-website/child/style.css");
const stamp = Date.now();
ssh(`cp '${dir}/style.css' '${dir}/style.css.bak-${stamp}' && base64 -d > '${dir}/style.css'`, css.toString("base64"));
console.log(ssh(`grep -m1 Version '${dir}/style.css'; grep -c 'interview-quote::after' '${dir}/style.css'`));
console.log(ssh(`cd '${docroot}' && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; curl -s -A 'Mozilla/5.0 (CogentCheck)' 'https://gymbusinessnews.com/gym-champions-stefan-white-and-kevin-furlong-on-the-big-move/?nc=${stamp}' | grep -o 'gym-business-news/style.css?ver=[0-9.]*' | head -1`));
await prisma.$disconnect();
