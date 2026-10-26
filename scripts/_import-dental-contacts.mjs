// Load the Apollo dental export into the newsletter drip for Dental Business
// News.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
//     scripts/_import-dental-contacts.mjs [--write]
//
// The title's queue has run dry: 2,601 prospects, every one already imported,
// readyToImport 0 against a weekly target of 400. These are the first new
// names it has had since launch.
//
// CHECKED BEFORE LOADING. The file JB sent first was "Farming Contacts.csv",
// 2,708 farm and vineyard managers, which would have sent a dental trade
// newsletter to the wrong trade off the shared Mailchimp account the whole
// fleet sends from. This file is the right one: 984 rows, every one United
// Kingdom, no farming contact in it.
//
// RANKING. The drip works down the rank, so the order is who we most want
// reading it. Practice owners and principals first, then the managers who buy,
// then dentists, then the rest of the clinical team. Within each tier a
// verified address goes before a catch-all, which is JB's rule of 21 Sep:
// load the catch-alls too, but rank the confirmed ones first.
import fs from "node:fs";
import { prisma, forSite } from "../lib/prisma.js";

const WRITE = process.argv.includes("--write");
const FILE = "C:/Users/CIM Ltd/AppData/Local/Temp/Dental Contacts.csv";

/** Minimal RFC4180 reader: Apollo quotes commas inside job titles. */
function parseCsv(text) {
  const rows = [];
  let field = "", row = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(fs.readFileSync(FILE, "utf8"));
const H = rows[0];
const at = (r, name) => (r[H.indexOf(name)] || "").trim();

const clean = (v) => String(v || "").trim();
const domainOf = (url) =>
  clean(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() || null;

// Who buys, in order. A practice owner signs for everything; a manager signs
// for most of it; a dentist influences; the rest read it because it is their
// trade. Nobody is excluded, they are just ordered.
function tier(title) {
  const s = clean(title).toLowerCase();
  if (!s) return 5;
  if (/principal|practice owner|^owner|\bowner\b|founder|\bpartner\b|managing director|chief exec|\bceo\b/.test(s)) return 0;
  if (/practice manager|business manager|operations manager|office manager|practice administrator/.test(s)) return 1;
  // "General Dental Practitioner" and "Dental Associate" are dentists by any
  // other name and were falling through to the bottom tier.
  if (/clinical director|dental surgeon|^dentist|associate dentist|\bdentist\b|orthodontist|periodontist|implantologist|general dental practitioner|dental associate/.test(s)) return 2;
  if (/therapist|hygienist/.test(s)) return 3;
  if (/technician|nurse|receptionist|assistant|coordinator/.test(s)) return 4;
  return 5;
}
const TIERS = ["owners and principals", "practice managers", "dentists", "therapists and hygienists", "clinical support", "other"];

// Verified beats catch-all beats unknown.
const confidence = (status) => {
  const s = clean(status).toLowerCase();
  if (s === "not catch-all") return 0;
  if (s === "catch-all") return 1;
  return 2;
};

const seen = new Set();
const parsed = [];
for (const r of rows.slice(1)) {
  if (r.length < 5) continue;
  const email = at(r, "Email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
  if (seen.has(email)) continue;
  seen.add(email);
  parsed.push({
    email,
    firstName: at(r, "First Name") || null,
    lastName: at(r, "Last Name") || null,
    title: at(r, "Title") || null,
    company: at(r, "Company Name") || null,
    companyCountry: at(r, "Country") || null,
    domain: domainOf(at(r, "Website")),
    tier: tier(at(r, "Title")),
    conf: confidence(at(r, "Primary Email Catch-all Status")),
  });
}

parsed.sort((a, b) =>
  a.tier - b.tier ||
  a.conf - b.conf ||
  (a.company || "").localeCompare(b.company || "") ||
  a.email.localeCompare(b.email)
);

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);

const existing = new Set(
  (await db.newsletterProspect.findMany({ select: { email: true } })).map((p) => p.email.toLowerCase())
);
const fresh = parsed.filter((p) => !existing.has(p.email));
const dupes = parsed.length - fresh.length;

const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

console.log(`file          ${rows.length - 1} rows, ${parsed.length} with a valid unique address`);
console.log(`already held  ${dupes}`);
console.log(`to add        ${fresh.length}, ranks ${rank} to ${rank + fresh.length - 1}`);
console.log(`companies     ${new Set(fresh.map((p) => p.company)).size}`);
console.log(`countries     ${[...new Set(fresh.map((p) => p.companyCountry))].join(", ")}`);
console.log(`\nby tier:`);
for (let t = 0; t <= 5; t++) {
  const n = fresh.filter((p) => p.tier === t).length;
  const v = fresh.filter((p) => p.tier === t && p.conf === 0).length;
  if (n) console.log(`  ${String(n).padStart(4)}  ${TIERS[t].padEnd(26)} ${v} verified, ${n - v} catch-all or unknown`);
}
console.log(`\nfirst eight by rank:`);
for (const p of fresh.slice(0, 8)) console.log(`  ${(p.title || "?").slice(0, 26).padEnd(28)} ${(p.company || "?").slice(0, 26).padEnd(28)} ${p.email}`);

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
      lastName: p.lastName,
      title: p.title,
      company: p.company,
      companyCountry: p.companyCountry,
      domain: p.domain,
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
