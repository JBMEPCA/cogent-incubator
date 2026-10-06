import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
const prisma = new PrismaClient();
const PINS = {
  "smart-sme": 1295,
  "golf-resort-magazine": 814,
  "airport-business-magazine": 793,
  "gym-business-news": 62,
  "dental-business-news": 186,
  "barbering-business": 662,
  "nursery-daily": 229,
};
for (const [slug, id] of Object.entries(PINS)) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  if (!s) { console.log(`${slug.padEnd(28)} no sftp credential`); continue; }
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
  const args = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
  try {
    const out = execFileSync("ssh", [...args, `${s.username}@${s.host}`,
      `cd '${docroot}' && echo -n "thumb="; wp post meta get ${id} _thumbnail_id 2>/dev/null || echo NONE; echo -n "status="; wp post get ${id} --field=post_status`],
      { encoding: "utf8", timeout: 120000 });
    console.log(`${slug.padEnd(28)} ${id} ${out.replace(/\s+/g, " ").trim()}`);
  } catch (e) {
    console.log(`${slug.padEnd(28)} ${id} ssh failed: ${String(e.message).slice(0, 60)}`);
  }
}
await prisma.$disconnect();
