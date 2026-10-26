// Load the Apollo "Fleet Contacts" export (26 Oct 2026) into the newsletter
// drip for The Fleet Magazine.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_import-fleet-contacts.mjs [--write]
//
// The title's queue is dry: 5,086 prospects, 3,568 imported, 1,518 suppressed,
// nothing waiting. This file holds about 20,000 rows.
//
// The export is NOT all fleet. It is an Apollo pull with the usual drift, so
// every row is scored on whether the person plausibly runs or buys for a
// fleet, from job title first and the company's own keywords second. Anything
// that scores nothing is suppressed rather than deleted, so the decision is
// visible and reversible.
//
// Ranking, best first: UK before the rest of the world, because this title
// writes UK tax, O-licence and DVSA copy; then by how close the job is to the
// fleet; then by a verified rather than catch-all address. JB's rule from
// 21 Sep stands, catch-all addresses are loaded, they just rank below
// confirmed ones.
//
// The source file is NEVER copied into this repo. A cleaned master lives in
// ~/.claude/data, as with the barber database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma, forSite } from "../lib/prisma.js";

const WRITE = process.argv.includes("--write");
const FILE = path.join(os.homedir(), "Downloads", "Fleet Contacts.csv");
const MASTER = path.join(os.homedir(), ".claude", "data", "fleet-contacts-2026-10.csv");

// --- a CSV reader that copes with quoted commas and embedded newlines -------
function* records(text) {
  let field = "", row = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); yield row; row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}

const FREEMAIL = /^(gmail|googlemail|hotmail|outlook|yahoo|icloud|me|live|aol|btinternet|sky|msn|mail|protonmail|ymail|talktalk|virginmedia)\./;
const JUNK_LOCAL = /^(abuse|postmaster|webmaster|hostmaster|noreply|no-reply|privacy|legal|dpo|careers|jobs|recruitment|press|info|enquiries|sales|admin|accounts|office|hello|contact|support|marketing)$/;

// How close is the job to running or buying for a fleet?
const TITLE_RULES = [
  [/\bfleet\b/i, 60],
  [/transport (manager|director|supervisor|co-?ordinator)|head of transport|traffic (manager|office)/i, 55],
  [/logistics (manager|director|head)|head of logistics|distribution (manager|director)/i, 45],
  [/\b(hgv|lgv|haulage|depot|workshop|garage|transport)\b/i, 30],
  [/operations (director|manager)|head of operations|\bcoo\b/i, 25],
  [/managing director|\bceo\b|founder|owner|proprietor|partner/i, 20],
  // Abbreviated on a lot of UK rows: "MD", "M D", "GM". Case sensitive, so
  // "md" inside a word does not count.
  [/\bM\.? ?D\b|\bGM\b/, 18],
  [/\bdirector\b/i, 15],
  [/procurement|purchasing|supply chain|facilities|health and safety|compliance/i, 12],
  [/\bmanager\b|head of/i, 8],
];
// The company's own words, as a weaker signal than the job title.
const KEYWORD_RULES = [
  [/\b(haulage|hgv|lgv|trucking|freight|road transport|fleet management|van fleet|logistics)\b/i, 25],
  [/\b(courier|delivery|distribution|transport|removals|coach|bus operator|waste collection|tipper|plant hire)\b/i, 15],
  [/\b(telematics|tachograph|vehicle leasing|contract hire|commercial vehicle|workshop|mot|smr)\b/i, 12],
];
const SIC_FLEET = /^(49|52|53|45)/; // transport, storage, post, motor trade

const text = fs.readFileSync(FILE, "utf8");
const it = records(text);
const header = it.next().value.map((h) => h.trim());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const need = ["Email", "First Name", "Last Name", "Title", "Company Name", "Company Country", "Website", "Keywords", "Primary Email Catch-all Status", "SIC Codes"];
for (const n of need) if (!(n in col)) throw new Error(`column missing: ${n}`);

const clean = (v) => String(v ?? "").trim();
const domainOf = (url) => clean(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() || null;

const byEmail = new Map();
let rows = 0, noEmail = 0, badEmail = 0, dupeInFile = 0;
for (const r of it) {
  if (r.length < header.length - 2) continue;
  rows++;
  const email = clean(r[col["Email"]]).toLowerCase();
  if (!email) { noEmail++; continue; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { badEmail++; continue; }
  if (byEmail.has(email)) { dupeInFile++; continue; }
  const title = clean(r[col["Title"]]);
  const keywords = clean(r[col["Keywords"]]);
  const sic = clean(r[col["SIC Codes"]]);
  const country = clean(r[col["Company Country"]]) || clean(r[col["Country"]] ?? "");
  let score = 0, why = [];
  for (const [re, n] of TITLE_RULES) if (re.test(title)) { score += n; why.push("title"); break; }
  for (const [re, n] of KEYWORD_RULES) if (re.test(keywords)) { score += n; why.push("keywords"); break; }
  if (SIC_FLEET.test(sic)) { score += 10; why.push("sic"); }
  byEmail.set(email, {
    email,
    firstName: clean(r[col["First Name"]]) || null,
    lastName: clean(r[col["Last Name"]]) || null,
    title: title || null,
    company: clean(r[col["Company Name"]]) || null,
    companyCountry: country || null,
    domain: domainOf(r[col["Website"]]),
    sic: sic || null,
    catchAll: /catch-?all/i.test(clean(r[col["Primary Email Catch-all Status"]])) && !/not/i.test(clean(r[col["Primary Email Catch-all Status"]])),
    score,
    why: why.join("+") || "none",
  });
}

const all = [...byEmail.values()];
const uk = (p) => /^(united kingdom|uk|great britain|england|scotland|wales|northern ireland)$/i.test(p.companyCountry || "");
const roleJunk = (p) => JUNK_LOCAL.test(p.email.split("@")[0]);

for (const p of all) {
  if (p.score === 0) { p.suppressed = true; p.suppressReason = "no fleet signal in title, keywords or SIC"; }
  else if (roleJunk(p) && !p.firstName) { p.suppressed = true; p.suppressReason = "generic role inbox with no named person"; }
  else p.suppressed = false;
}

const live = all.filter((p) => !p.suppressed);
live.sort((a, b) =>
  (uk(b) ? 1 : 0) - (uk(a) ? 1 : 0) ||
  b.score - a.score ||
  (a.catchAll ? 1 : 0) - (b.catchAll ? 1 : 0) ||
  (a.company || "").localeCompare(b.company || "") ||
  a.email.localeCompare(b.email));
const dead = all.filter((p) => p.suppressed);

const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const db = forSite(site.id);
const existing = new Set((await db.newsletterProspect.findMany({ select: { email: true } })).map((p) => p.email.toLowerCase()));
const freshLive = live.filter((p) => !existing.has(p.email));
const freshDead = dead.filter((p) => !existing.has(p.email));
const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

const pct = (n) => `${((n / all.length) * 100).toFixed(1)}%`;
console.log(`file            ${rows} rows, ${all.length} unique valid addresses`);
console.log(`                skipped: ${noEmail} with no email, ${badEmail} malformed, ${dupeInFile} duplicates in file`);
console.log(`fleet signal    title ${pct(all.filter((p) => p.why.includes("title")).length)}, keywords ${pct(all.filter((p) => p.why.includes("keywords")).length)}, none ${pct(all.filter((p) => p.why === "none").length)}`);
console.log(`UK              ${all.filter(uk).length} of ${all.length}`);
console.log(`catch-all       ${all.filter((p) => p.catchAll).length}`);
console.log(`live / suppress ${live.length} / ${dead.length}`);
console.log(`already held    ${live.length - freshLive.length} live, ${dead.length - freshDead.length} suppressed`);
console.log(`to add          ${freshLive.length} live + ${freshDead.length} suppressed, ranks from ${rank}`);
console.log(`\ntop 10 by rank:`);
for (const p of freshLive.slice(0, 10)) console.log(`  ${String(p.score).padStart(3)} ${uk(p) ? "UK" : "  "} ${p.email.padEnd(38)} ${(p.title || "").slice(0, 42).padEnd(42)} ${(p.company || "").slice(0, 28)}`);
console.log(`\n10 suppressed, for a sanity check:`);
for (const p of freshDead.slice(0, 10)) console.log(`  ${p.email.padEnd(38)} ${(p.title || "(no title)").slice(0, 38).padEnd(38)} ${p.suppressReason}`);

if (!WRITE) { console.log("\nDRY RUN, nothing written."); await prisma.$disconnect(); process.exit(0); }

fs.mkdirSync(path.dirname(MASTER), { recursive: true });
fs.writeFileSync(MASTER, "email,first,last,title,company,country,domain,score,why,catch_all,suppressed\n" +
  all.map((p) => [p.email, p.firstName, p.lastName, p.title, p.company, p.companyCountry, p.domain, p.score, p.why, p.catchAll, p.suppressed]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
console.log(`master copy -> ${MASTER}`);

let added = 0;
for (const batch of chunk([...freshLive, ...freshDead], 500)) {
  await db.newsletterProspect.createMany({
    data: batch.map((p) => ({
      siteId: site.id, email: p.email, firstName: p.firstName, lastName: p.lastName, title: p.title,
      company: p.company, companyCountry: p.companyCountry, domain: p.domain, sic: p.sic,
      score: p.score, rank: rank++, suppressed: p.suppressed, suppressReason: p.suppressReason || null,
    })),
    skipDuplicates: true,
  });
  added += batch.length;
  process.stdout.write(`\radded ${added} of ${freshLive.length + freshDead.length}`);
}
console.log();
const after = await db.newsletterProspect.count({ where: { suppressed: false, importedAt: null } });
console.log(`waiting in the drip now: ${after}`);
await prisma.$disconnect();

function* chunk(arr, n) { for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n); }
