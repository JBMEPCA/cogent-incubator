// Swap the published editorial intake address from news@<domain> to press@<domain>
// on every title, and report every other address the sites publish.
//
//   node scripts/_press-address-swap.mjs            dry run, reports only
//   node scripts/_press-address-swap.mjs --apply    do the replacement
//
// The exact string news@<domain> is targeted deliberately. A loose "news@"
// replace would also hit news@news.<domain>, which is the real SiteGround
// mailbox Mailchimp sends from, and breaking that breaks every newsletter.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const APPLY = process.argv.includes("--apply");
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const sites = await prisma.site.findMany({ select: { id: true, name: true, slug: true } });
for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { console.log(`\n## ${site.name}: no sftp credential, skipped`); continue; }
  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const themes = `${docroot}/wp-content/themes`;
  const ssh = (cmd) =>
    execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
      "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd], { encoding: "utf8", timeout: 180000 }).trim();

  let domain = "";
  try { domain = ssh(`cd '${docroot}' && wp option get siteurl`).replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""); }
  catch (e) { console.log(`\n## ${site.name}: ssh failed - ${String(e.message).slice(0, 120)}`); continue; }

  const from = `news@${domain}`;
  const to = `press@${domain}`;
  console.log(`\n## ${site.name}  (${domain})`);

  // 1. the database
  try {
    const out = ssh(`cd '${docroot}' && wp search-replace '${from}' '${to}' --all-tables-with-prefix --precise --report-changed-only ${APPLY ? "" : "--dry-run"} --format=count`);
    console.log(`   database: ${out || 0} replacement(s) ${APPLY ? "made" : "would be made"}`);
  } catch (e) { console.log(`   database: FAILED ${String(e.message).slice(0, 160)}`); }

  // 2. theme files
  try {
    const hits = ssh(`grep -rl '${from}' '${themes}' 2>/dev/null || true`);
    if (!hits) console.log("   theme files: none");
    else {
      console.log(`   theme files: ${hits.split("\n").length} file(s)`);
      for (const f of hits.split("\n")) console.log(`      ${f.replace(themes + "/", "")}`);
      if (APPLY) { ssh(`grep -rl '${from}' '${themes}' | xargs sed -i 's/${from}/${to}/g'`); console.log("      replaced"); }
    }
  } catch (e) { console.log(`   theme files: FAILED ${String(e.message).slice(0, 120)}`); }

  // 3. every other address on the site
  try {
    const admin = ssh(`cd '${docroot}' && wp option get admin_email`);
    const inThemes = ssh(`grep -rhoE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' '${themes}' 2>/dev/null | sort -u | head -40 || true`);
    console.log(`   admin_email: ${admin}`);
    const list = [...new Set(inThemes.split("\n").map((s) => s.trim()).filter(Boolean))].filter((a) => !/\.(png|jpg|svg|gif|css|js)$/i.test(a));
    console.log(`   addresses in theme files: ${list.length ? list.join(", ") : "none"}`);
  } catch (e) { console.log(`   address audit: FAILED ${String(e.message).slice(0, 120)}`); }
}
await prisma.$disconnect();
