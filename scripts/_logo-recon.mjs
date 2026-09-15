// One-off, read-only: what each title's live site currently carries for its
// logo, before the September 2026 mastheads go live. Nothing is written.
//
//   node --import ./scripts/_register.mjs scripts/_logo-recon.mjs
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

const CHILD_DIRS = {
  "smart-sme": "smart-sme-website",
  "fleet-magazine": "fleet-magazine-website",
  "golf-resort-magazine": "golf-resort-magazine-website",
  "barbering-business": "barbering-business-website",
  "airport-business-magazine": "airport-business-magazine-website",
};
const md5 = (s) => crypto.createHash("md5").update(s.replace(/\r\n/g, "\n")).digest("hex");

const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const site of sites) {
  console.log(`\n=== ${site.slug} ===`);
  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { console.log("  no sftp credential"); continue; }
  const key = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const child = path.basename(sftp.themePath);
  const ssh = (cmd) => {
    try {
      return execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new",
        "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd], { encoding: "utf8", timeout: 90000 }).trim();
    } catch (e) { return `ERR ${String(e.stderr || e.message).slice(0, 160)}`; }
  };

  console.log(`  child theme: ${child}`);
  console.log(`  live versions: ${ssh(`cd '${docroot}' && wp theme list --fields=name,version,status --format=csv 2>/dev/null | grep -E 'cogent|${child}'`).replace(/\n/g, " | ")}`);

  const dir = CHILD_DIRS[site.slug];
  if (dir) {
    for (const f of ["style.css", "functions.php", "parts/header.html", "parts/footer.html", "templates/home.html"]) {
      const local = path.resolve("..", dir, "child", f);
      if (!fs.existsSync(local)) continue;
      const remote = ssh(`md5sum '${sftp.themePath}/${f}' 2>/dev/null | cut -d' ' -f1; cat '${sftp.themePath}/${f}' | tr -d '\\r' | md5sum | cut -d' ' -f1`).split("\n").pop();
      const same = remote === md5(fs.readFileSync(local, "utf8"));
      console.log(`  ${f.padEnd(22)} live ${same ? "MATCHES" : "DIFFERS from"} local working tree`);
    }
  }

  console.log(`  header/footer overridden in DB: ${ssh(`cd '${docroot}' && wp post list --post_type=wp_template_part --fields=post_name --format=csv 2>/dev/null | tail -n +2 | tr '\\n' ' '`) || "none"}`);
  console.log(`  site_icon: ${ssh(`cd '${docroot}' && id=$(wp option get site_icon 2>/dev/null); echo "#$id $(wp post get $id --field=guid 2>/dev/null)"`)}`);
  console.log(`  yoast company_logo: ${ssh(`cd '${docroot}' && wp option get wpseo_titles --format=json 2>/dev/null | tr ',' '\\n' | grep -o '"company_logo":"[^"]*"' | head -1`)}`);
  console.log(`  yoast social image default: ${ssh(`cd '${docroot}' && wp option get wpseo_social --format=json 2>/dev/null | tr ',' '\\n' | grep -o '"og_default_image":"[^"]*"' | head -1`)}`);
}
await prisma.$disconnect();
process.exit(0);
