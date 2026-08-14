/**
 * One-off: load the ranked Apollo list into NewsletterProspect.
 *
 * Carries across what we already know, so the drip does not re-verify or
 * re-import anything:
 *   - the 874 verified-good contacts already in Mailchimp are marked imported
 *     as tranche 1
 *   - the 126 that failed verification are suppressed with their reason
 *   - the dead domains found by the free MX pass are suppressed too
 *   - everything else is left unverified for the daily pass to work through
 *
 * Run: node scripts/seed-prospects.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DIR = "C:/Users/CIM Ltd/Desktop/Smart SME List - Ranked";
const REPORT = "C:/Users/CIM Ltd/Downloads/tranche-001_FULL_REPORT_MILLIONVERIFIER.COM.csv";
const prisma = new PrismaClient();

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

// What the first tranche's verification told us.
const verdicts = new Map();
if (fs.existsSync(REPORT)) {
  for (const r of asObjects(parseCSV(fs.readFileSync(REPORT, "utf8")))) {
    verdicts.set(r.email.toLowerCase(), { quality: r.quality, result: r.result });
  }
}
console.log(`verification verdicts loaded: ${verdicts.size}`);

// Domains with no mail route, from the free DNS pass.
const deadDomains = new Set();
const deadFile = path.join(DIR, "dead-domains.txt");
if (fs.existsSync(deadFile)) {
  fs.readFileSync(deadFile, "utf8").trim().split("\n").forEach((l) => { const d = l.split("\t")[0]; if (d) deadDomains.add(d.toLowerCase()); });
}
console.log(`dead domains loaded: ${deadDomains.size}`);

const ranked = asObjects(parseCSV(fs.readFileSync(path.join(DIR, "ranked-all.csv"), "utf8")));
console.log(`ranked contacts: ${ranked.length}\n`);

const now = new Date();
let rank = 0;
const records = ranked.map((r) => {
  rank++;
  const email = r.email.toLowerCase();
  const v = verdicts.get(email);
  const domainDead = deadDomains.has((r.domain || "").toLowerCase());

  let verifyStatus = null, verifyResult = null, verifiedAt = null;
  let suppressed = false, suppressReason = null, importedAt = null, tranche = null;

  if (v) {
    verifyStatus = v.quality;
    verifyResult = v.result;
    verifiedAt = now;
    if (v.quality === "good") { importedAt = now; tranche = 1; }
    else { suppressed = true; suppressReason = `verify:${v.result}`; }
  } else if (domainDead) {
    suppressed = true;
    suppressReason = "no-mx";
  }

  return {
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
    importedAt, tranche, suppressed, suppressReason,
  };
});

// createMany in chunks: a single 24k insert is a very large statement.
const existing = await prisma.newsletterProspect.count();
if (existing) {
  console.log(`table already holds ${existing} rows, refusing to double-seed`);
  process.exit(1);
}

let written = 0;
for (let i = 0; i < records.length; i += 2000) {
  const chunk = records.slice(i, i + 2000);
  const res = await prisma.newsletterProspect.createMany({ data: chunk, skipDuplicates: true });
  written += res.count;
  console.log(`  ${written}/${records.length}`);
}

const [total, imported, suppressed, unverified] = await Promise.all([
  prisma.newsletterProspect.count(),
  prisma.newsletterProspect.count({ where: { importedAt: { not: null } } }),
  prisma.newsletterProspect.count({ where: { suppressed: true } }),
  prisma.newsletterProspect.count({ where: { suppressed: false, verifyStatus: null } }),
]);
console.log(`\ntotal      : ${total}`);
console.log(`imported   : ${imported}   (tranche 1, already in Mailchimp)`);
console.log(`suppressed : ${suppressed}`);
console.log(`to verify  : ${unverified}`);
await prisma.$disconnect();
