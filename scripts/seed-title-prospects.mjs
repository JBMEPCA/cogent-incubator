/**
 * Load a title's ranked prospect list into NewsletterProspect.
 *
 * The multi-title successor to seed-prospects.mjs, which was a Smart SME
 * one-off: it set no siteId (now required) and refused to run if the table held
 * any rows at all, which across a fleet means "refuse after the first title".
 * This one scopes both the refusal and the write to one site.
 *
 * Carries across what is already known so nothing is paid for twice:
 *   - rows the ranker suppressed (catch-all, no-mx, dupes) arrive suppressed
 *   - the MillionVerifier bulk report, if present, decides the head of the list:
 *     good becomes verified-and-ready-to-import, anything else is suppressed
 *   - everything below the verified slice is left unverified for the daily drip
 *
 * Nothing is written to Mailchimp here. Import is runDrip()'s job, so the
 * bounce-rate gate and tranche tagging stay in one place.
 *
 * Run: node --env-file=.env scripts/seed-title-prospects.mjs <slug> [--force]
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DIR = path.resolve("assets/mailchimpdata");
const slug = process.argv[2];
const force = process.argv.includes("--force");
if (!slug) {
  console.error("usage: node --env-file=.env scripts/seed-title-prospects.mjs <slug> [--force]");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const asObjects = (rows) => {
  const h = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((c, i) => [c, (r[i] ?? "").trim()])));
};

const ranked = asObjects(parseCSV(fs.readFileSync(path.join(DIR, `ranked-${slug}.csv`), "utf8")));
console.log(`${site.name}: ${ranked.length} ranked rows`);

// The bulk verification report for this title's first tranche, if it has run.
const verdicts = new Map();
const reportPath = path.join(DIR, `mv-report-${slug}.csv`);
if (fs.existsSync(reportPath)) {
  const rep = asObjects(parseCSV(fs.readFileSync(reportPath, "utf8")));
  const cols = Object.keys(rep[0] ?? {});
  const emailCol = cols.find((c) => /^email$/i.test(c)) ?? cols[0];
  const qualityCol = cols.find((c) => /quality/i.test(c));
  const resultCol = cols.find((c) => /^result$/i.test(c)) ?? qualityCol;
  for (const r of rep) {
    const email = (r[emailCol] || "").toLowerCase();
    if (email) verdicts.set(email, { quality: (r[qualityCol] || "").toLowerCase(), result: r[resultCol] || "" });
  }
  console.log(`  verification verdicts loaded: ${verdicts.size}`);
} else {
  console.log("  no MillionVerifier report yet — seeding unverified, the daily drip will work down the list");
}

const now = new Date();
let rank = 0;
const records = ranked.map((r) => {
  rank++;
  const email = r.email.toLowerCase();
  let verifyStatus = null, verifyResult = null, verifiedAt = null;
  let suppressed = r.suppressed === "1";
  let suppressReason = suppressed ? r.suppressReason || "ranker" : null;

  const v = verdicts.get(email);
  if (!suppressed && v?.quality) {
    verifyStatus = v.quality;
    verifyResult = v.result;
    verifiedAt = now;
    if (v.quality !== "good") { suppressed = true; suppressReason = `verify:${v.result}`; }
  }

  return {
    siteId: site.id,
    email, rank,
    firstName: r.firstName || null,
    lastName: r.lastName || null,
    title: r.title || null,
    company: r.company || null,
    companyCountry: r.companyCountry || null,
    domain: r.domain || null,
    sic: r.sic || null,
    score: Number(r.score) || 0,
    verifyStatus, verifyResult, verifiedAt,
    // importedAt stays null for every row: nothing is in Mailchimp until
    // runDrip() puts it there and stamps the tranche itself.
    importedAt: null, tranche: null,
    suppressed, suppressReason,
  };
});

const existing = await prisma.newsletterProspect.count({ where: { siteId: site.id } });
if (existing && !force) {
  console.log(`${slug} already holds ${existing} prospect rows — refusing to double-seed (pass --force to replace)`);
  process.exit(1);
}
if (existing && force) {
  const del = await prisma.newsletterProspect.deleteMany({ where: { siteId: site.id } });
  console.log(`  --force: removed ${del.count} existing rows for this title`);
}

let written = 0;
for (let i = 0; i < records.length; i += 2000) {
  const res = await prisma.newsletterProspect.createMany({ data: records.slice(i, i + 2000), skipDuplicates: true });
  written += res.count;
  console.log(`  ${written}/${records.length}`);
}

const where = { siteId: site.id };
const [total, suppressed, good, unverified] = await Promise.all([
  prisma.newsletterProspect.count({ where }),
  prisma.newsletterProspect.count({ where: { ...where, suppressed: true } }),
  prisma.newsletterProspect.count({ where: { ...where, suppressed: false, verifyStatus: "good", importedAt: null } }),
  prisma.newsletterProspect.count({ where: { ...where, suppressed: false, verifyStatus: null } }),
]);
console.log(`\n${site.name}`);
console.log(`  total           : ${total}`);
console.log(`  suppressed      : ${suppressed}`);
console.log(`  ready to import : ${good}`);
console.log(`  awaiting verify : ${unverified}`);
await prisma.$disconnect();
