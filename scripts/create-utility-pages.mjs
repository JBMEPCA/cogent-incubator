// Publish the footer/navigation utility pages on a title that is missing them.
//
//   node scripts/create-utility-pages.mjs --site=<slug> --dry
//   node scripts/create-utility-pages.mjs --all [--dry] [--force]
//
// Background: on 6 September 2026 all four of the newer titles linked to
// /about/, /contact/, /advertise/, /newsletter/, /editorial-standards/,
// /privacy-policy/ and /submit-news/ from the footer of every page, and had
// published none of them. Roughly 150 site-wide 404s across the four, no
// privacy policy behind a live consent banner and a live newsletter form, and
// no rate-card page on titles that exist to sell advertising.
//
// WHY SSH AND NOT THE REST API. The obvious implementation posts to
// /wp-json/wp/v2/pages with the stored WordPress app password. It returns 403
// on all four titles, and so does an authenticated GET: the SiteGround WAF in
// front of these sites rejects any wp-json request carrying an Authorization
// header, whatever the user agent. Anonymous reads work, which makes this look
// like a permissions problem when it is a host problem. The route that works on
// these hosts is key-based SSH plus wp-cli, the same path set-publisher-logo.mjs
// uses to patch Yoast options. Content goes over the wire base64-encoded so no
// HTML ever has to survive shell quoting.
//
// WHAT IT WILL NOT TOUCH. Every title carries a topic-hub page as a deliberate
// draft (create-hub-pages.mjs leaves the publish button to a human, because a
// machine-written editorial page going live under the masthead cannot be taken
// back). Those are editorial. These are furniture. Only the slugs in PAGE_ORDER
// are ever written, so the hub drafts, Fleet's tools pages and its calculator
// are all out of scope by construction.
//
// The privacy-policy page is the one exception to "create only". WordPress ships
// a draft stub at post ID 3 on a fresh install, full of "Suggested text:"
// tutorial placeholders. All four titles still had exactly that. It is replaced
// and published rather than skipped, because skipping it would leave the 404 in
// place, which is the actual harm.
//
// Idempotent. An already-published page at one of these slugs is left alone
// unless --force. Nothing is ever deleted.
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

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");
const ALL = process.argv.includes("--all");
const only = arg("site");

const { TITLES, buildPages, PAGE_ORDER } = await import("./utility-pages-content.mjs");

if (!only && !ALL) {
  console.error("Usage: node scripts/create-utility-pages.mjs --site=<slug> | --all  [--dry] [--force]");
  console.error("Known titles: " + Object.keys(TITLES).join(", "));
  process.exit(1);
}
const slugs = ALL ? Object.keys(TITLES) : [only];
for (const s of slugs) {
  if (!TITLES[s]) {
    console.error(`Unknown title "${s}". Known: ${Object.keys(TITLES).join(", ")}`);
    process.exit(1);
  }
}

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

// A WordPress default privacy stub still carries its tutorial markers. Only a
// page that still looks like the stub is safe to overwrite without --force.
const isWpStub = (html) =>
  /privacy-policy-tutorial/.test(html) || /Suggested text:/.test(html);

let created = 0, replaced = 0, skipped = 0, failed = 0;

for (const slug of slugs) {
  const t = TITLES[slug];
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.log(`\n## ${slug}: no Site row, skipping`); failed++; continue; }

  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { console.log(`\n## ${site.name}: no sftp credential, skipping`); failed++; continue; }

  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const ssh = (cmd) =>
    execFileSync(
      "ssh",
      ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
       "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd],
      { encoding: "utf8", timeout: 120000 }
    ).trim();

  console.log(`\n## ${site.name}  (${sftp.host})`);

  // Existing pages, any status, so a draft stub is visible.
  const listing = ssh(
    `cd '${docroot}' && wp post list --post_type=page --post_status=any --fields=ID,post_name,post_status --format=csv`
  );
  const bySlug = new Map();
  for (const line of listing.split("\n").slice(1)) {
    const [id, name, status] = line.split(",").map((x) => (x || "").replace(/^"|"$/g, "").trim());
    if (name) bySlug.set(name, { id, status });
  }

  const pages = buildPages(t);

  for (const pslug of PAGE_ORDER) {
    const page = pages[pslug];
    if (!page) { console.log(`   ${pslug.padEnd(20)} not applicable for this title`); continue; }

    const found = bySlug.get(pslug);
    let mode = "create";

    if (found) {
      if (found.status === "publish" && !FORCE) {
        console.log(`   ${pslug.padEnd(20)} already published (id ${found.id}), left alone`);
        skipped++;
        continue;
      }
      // A draft at one of these slugs is either the WordPress stub or an
      // abandoned start. Replace the stub freely; anything else needs --force.
      let body = "";
      try {
        body = ssh(`cd '${docroot}' && wp post get ${found.id} --field=post_content`);
      } catch { body = ""; }
      if (!isWpStub(body) && !FORCE) {
        console.log(
          `   ${pslug.padEnd(20)} draft id ${found.id} is NOT the WordPress stub, left alone (--force to replace)`
        );
        skipped++;
        continue;
      }
      mode = "replace";
    }

    if (DRY) {
      console.log(
        `   ${pslug.padEnd(20)} would ${mode.toUpperCase()}${found ? " id " + found.id : ""}  "${page.title}"  ${page.content.length} chars`
      );
      continue;
    }

    const b64 = Buffer.from(page.content, "utf8").toString("base64");
    const tmp = `/tmp/cogent-page-${pslug}-${Date.now()}.html`;
    try {
      // Content travels base64 so no HTML has to survive shell quoting.
      ssh(`printf '%s' '${b64}' | base64 -d > '${tmp}'`);
      if (mode === "replace") {
        ssh(
          `cd '${docroot}' && wp post update ${found.id} '${tmp}' ` +
            `--post_title='${page.title}' --post_name='${pslug}' --post_status=publish`
        );
      } else {
        ssh(
          `cd '${docroot}' && wp post create '${tmp}' --post_type=page ` +
            `--post_title='${page.title}' --post_name='${pslug}' --post_status=publish --porcelain`
        );
      }
      ssh(`rm -f '${tmp}'`);
      console.log(`   ${pslug.padEnd(20)} ${mode === "replace" ? "replaced and published" : "created"}`);
      mode === "replace" ? replaced++ : created++;
    } catch (e) {
      const msg = (e.stderr || e.stdout || e.message || "").toString().trim().split("\n")[0];
      console.log(`   ${pslug.padEnd(20)} FAILED  ${msg.slice(0, 180)}`);
      failed++;
    }
  }
}

console.log(
  `\n${DRY ? "DRY RUN. " : ""}created ${created}, replaced ${replaced}, left alone ${skipped}, failed ${failed}`
);
await prisma.$disconnect();
