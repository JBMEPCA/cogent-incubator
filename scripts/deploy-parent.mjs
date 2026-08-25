// Push the SHARED PARENT theme (cogent-base) to a title's host.
//
//   node scripts/deploy-parent.mjs --site=golf-resort-magazine --dry-run
//   node scripts/deploy-parent.mjs --site=golf-resort-magazine
//   node scripts/deploy-parent.mjs --all
//
// deploy-theme.mjs already does the work; this exists because the parent lives
// BESIDE the title's own theme directory rather than inside it, so every parent
// deploy needs a --to path that is derived from the stored credential. Typing
// that path by hand is how the first parent deploy built an entire theme tree
// inside the server's home directory: Git Bash rewrites a Unix absolute path in
// an argument into a Windows one. Here the path is computed in Node and handed
// to execFileSync as an array element, so no shell ever sees it and there is
// nothing to mangle. It is also never printed, because it carries the hosting
// account name.
//
// Each title is a SEPARATE hosting account, so the parent has to go to all
// three. --all does them in sequence and stops on the first failure.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);

for (const f of [".env.local", ".env"]) {
  const p = path.join(repo, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
const PARENT_DIR = path.resolve(repo, "../cogent-base-theme/cogent-base");

if (!fs.existsSync(path.join(PARENT_DIR, "style.css"))) {
  console.error(`No parent theme at ${PARENT_DIR}`);
  process.exit(1);
}

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const slugs = ALL
  ? (await prisma.site.findMany({ orderBy: { id: "asc" } })).map((s) => s.slug)
  : [arg("site")].filter(Boolean);

if (!slugs.length) {
  console.error("Usage: node scripts/deploy-parent.mjs --site=<slug> | --all  [--dry-run]");
  await prisma.$disconnect();
  process.exit(1);
}

let failed = 0;
for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.error(`No title "${slug}"`); failed++; continue; }

  const { creds } = await siteCredentials(site.id);
  const themePath = creds?.sftp?.themePath;
  if (!themePath) { console.error(`${site.name}: no SFTP credential stored.`); failed++; continue; }

  // The parent sits next to the child, not inside it.
  const to = path.posix.join(path.posix.dirname(themePath.replace(/\/$/, "")), "cogent-base");
  if (!to.startsWith("/")) { console.error(`${site.name}: derived path is not absolute.`); failed++; continue; }

  console.log(`\n================ ${site.name} — shared parent ================`);
  try {
    execFileSync(
      process.execPath,
      [
        path.join(here, "deploy-theme.mjs"),
        `--site=${slug}`,
        `--from=${PARENT_DIR}`,
        `--to=${to}`,
        ...(DRY ? ["--dry-run"] : []),
      ],
      { cwd: repo, stdio: "inherit" }
    );
  } catch {
    console.error(`${site.name}: deploy FAILED`);
    failed++;
    if (ALL) break;
  }
}

await prisma.$disconnect();
process.exit(failed ? 1 : 0);
