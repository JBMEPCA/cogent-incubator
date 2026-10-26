// Load the hand-built Senior Living / retirement contacts into the newsletter
// drip for Senior Lifestyle Business.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_import-senior-living-contacts.mjs [--write]
//
// The title's queue has run dry: 2,295 prospects, every one already imported,
// nothing waiting. These 171 are hand-researched and role-matched rather than
// bulk, so they are ranked by fit within themselves and appended after the
// existing ranks.
//
// xlsx is not a dependency of this repo, so the sheet is read with the copy in
// MEPCA Hub. The CJS build does NOT need set_fs; only the ESM one does.
import { createRequire } from "node:module";
import { prisma, forSite } from "../lib/prisma.js";

const require = createRequire("C:/Users/CIM Ltd/.claude/Claude Code Projects/MEPCA Hub/package.json");
const XLSX = require("xlsx");

const WRITE = process.argv.includes("--write");
const FILE = "C:/Users/CIM Ltd/AppData/Local/Temp/Senior_Living_Retirement_Contacts.xlsx";

const wb = XLSX.readFile(FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Senior living contacts"], { defval: "" });

const clean = (v) => String(v || "").trim();
const domainOf = (url) =>
  clean(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() || null;

// Fit order, best first. Purest-fit organisations lead, then by how close the
// job is to the retirement living business rather than the care side of it.
const seniority = (t) => {
  const s = clean(t).toLowerCase();
  if (/chief|ceo|managing director|founder|owner|partner/.test(s)) return 0;
  if (/\bdirector\b/.test(s)) return 1;
  if (/head of/.test(s)) return 2;
  if (/care home|dementia|nursing/.test(s)) return 9; // the far side of the front-door rule
  if (/general manager|village manager|operations/.test(s)) return 3;
  if (/manager|lead/.test(s)) return 4;
  return 5;
};

const parsed = rows
  .map((r) => ({
    email: clean(r["Email Address"]).toLowerCase(),
    firstName: clean(r["First Name"]) || null,
    title: clean(r["Job Title"]) || null,
    company: clean(r["Company Name"]) || null,
    domain: domainOf(r["Website"]),
    location: clean(r["Location"]) || null,
    services: clean(r["Services offered"]),
  }))
  .filter((p) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email));

parsed.sort((a, b) => {
  const pure = (p) => (/only/i.test(p.services) ? 0 : 1);
  return (
    pure(a) - pure(b) ||
    seniority(a.title) - seniority(b.title) ||
    (a.company || "").localeCompare(b.company || "") ||
    a.email.localeCompare(b.email)
  );
});

const site = await prisma.site.findUnique({ where: { slug: "senior-lifestyle-business" } });
const db = forSite(site.id);

const existing = new Set(
  (await db.newsletterProspect.findMany({ select: { email: true } })).map((p) => p.email.toLowerCase()),
);
const fresh = parsed.filter((p) => !existing.has(p.email));
const dupes = parsed.length - fresh.length;

const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

console.log(`sheet         ${rows.length} rows, ${parsed.length} with a valid address`);
console.log(`already held  ${dupes}`);
console.log(`to add        ${fresh.length}, ranks ${rank} to ${rank + fresh.length - 1}`);
console.log(`companies     ${new Set(fresh.map((p) => p.company)).size}`);
console.log(`locations     ${new Set(fresh.map((p) => p.location)).size} distinct (all look UK)`);
const care = fresh.filter((p) => seniority(p.title) === 9);
console.log(`care-side     ${care.length} contacts whose job is the care home, not the village:`);
for (const c of care) console.log(`                ${c.title} at ${c.company} (${c.email})`);
console.log(`\nfirst five by fit:`);
for (const p of fresh.slice(0, 5)) console.log(`  ${p.title} at ${p.company}  ${p.email}`);

if (!WRITE) {
  console.log("\nDRY RUN. Nothing written. Re-run with --write.");
  await prisma.$disconnect();
  process.exit(0);
}

let made = 0;
for (const p of fresh) {
  await db.newsletterProspect.create({
    data: {
      siteId: site.id,
      email: p.email,
      firstName: p.firstName,
      title: p.title,
      company: p.company,
      domain: p.domain,
      companyCountry: "United Kingdom",
      score: 0,
      rank: rank++,
    },
  });
  made++;
}
console.log(`\ncreated ${made} prospects`);

const { prospectStats } = await import("../lib/prospects.js");
console.log(JSON.stringify(await prospectStats(site.id), null, 1));
await prisma.$disconnect();
