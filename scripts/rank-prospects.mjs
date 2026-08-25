/**
 * Rank a raw Apollo export into the seedable prospect format, per title.
 *
 * Reads the three Lucas CSVs in assets/mailchimpdata/, and for each title
 * writes assets/mailchimpdata/ranked-<slug>.csv with the columns the seeder
 * expects (email, firstName, lastName, title, company, companyCountry, domain,
 * sic, score, suppressed, suppressReason), best prospects first.
 *
 * What gets suppressed before a single verification credit is spent:
 *   - rows with no parseable email
 *   - duplicates, in-file and across the three files (higher score keeps it)
 *   - Apollo-flagged catch-all addresses (MillionVerifier can never return
 *     "good" for these, so checking them is paying to learn nothing)
 *   - domains with no MX and no A record (free DNS pass, as on Smart SME)
 *   - emails Smart SME's list already verified bad or risky — the verdict is
 *     about the mailbox, not the magazine, so it carries across for free
 *
 * Emails Smart SME already verified GOOD are marked pre-verified and cost
 * nothing either. Run: node scripts/rank-prospects.mjs
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { PrismaClient } from "@prisma/client";

const DIR = path.resolve("assets/mailchimpdata");

// ---- vertical scoring ----
// Everything here is title-relevance: verification quality is handled
// separately, and seniority is shared.

const VERTICALS = [
  {
    slug: "fleet-magazine",
    file: "Fleet Data.csv",
    // UK title: the magazine and its advertisers are UK-side.
    countryBoost: { "United Kingdom": 15, Ireland: 8 },
    strongRole: /\b(fleet|transport|logistics?|distribution|vehicle|hgv|haulage|depot)\b/i,
    weakRole: /\b(operations?|supply chain|warehouse|driver)\b/i,
    companyHint: /\b(fleet|transport|logistics?|haulage|freight|leasing)\b/i,
  },
  {
    slug: "golf-resort-magazine",
    file: "Golf Data.csv",
    // Global title; a light home-market boost only.
    countryBoost: { "United Kingdom": 5, Ireland: 5 },
    strongRole: /\b(golf|greenkeep\w*|superintendent|course manager|club manager|club secretary|pro shop|head professional)\b/i,
    weakRole: /\b(general manager|club|resort|membership|estate|leisure|hospitality)\b/i,
    companyHint: /\b(golf|resort|links|country club)\b/i,
  },
  {
    slug: "airport-business-magazine",
    file: "Airport Data.csv",
    countryBoost: {},
    strongRole: /\b(airport|aviation|airside|terminal|ground handling|air cargo|aerodrome)\b/i,
    weakRole: /\b(commercial|retail|property|real estate|concessions?|parking|infrastructure|route)\b/i,
    companyHint: /\b(airport|aviation|aeroport|ground handling|civil aviation|airfield)\b/i,
  },
];

// ---- CSV plumbing (same parser as seed-prospects.mjs) ----

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
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---- scoring ----

function seniority(title) {
  const t = title.toLowerCase();
  if (/\b(owner|founder|ceo|chief executive|president|managing director|md)\b/.test(t)) return 30;
  if (/\b(director|head of|vp|vice president|chief \w+ officer|partner)\b/.test(t)) return 24;
  if (/\bmanager\b|\bmanagement\b/.test(t)) return 16;
  return 6;
}

function score(r, v) {
  let s = seniority(r["Title"] || "");
  const title = r["Title"] || "";
  if (v.strongRole.test(title)) s += 30;
  else if (v.weakRole.test(title)) s += 15;

  const companyText = `${r["Company Name"] || ""} ${r["Keywords"] || ""}`;
  if (v.companyHint.test(companyText)) s += 10;

  s += v.countryBoost[r["Country"] || r["Company Country"] || ""] ?? 0;

  // Email-quality signals: only used for ordering, never as proof (Apollo's
  // own flags were wrong for 11% of Smart SME's list).
  const verifiedAt = Date.parse(r["Primary Email Last Verified At"] || "");
  if (verifiedAt) {
    const months = (Date.now() - verifiedAt) / (30 * 24 * 3600 * 1000);
    if (months <= 12) s += 8;
    else if (months <= 24) s += 4;
  }
  if (/zerobounce/i.test(r["Primary Email Verification Source"] || "")) s += 4;
  return s;
}

// ---- load, clean, score ----

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const prisma = new PrismaClient();

const perTitle = new Map(); // slug -> Map(email -> record)
const stats = {};
const columnAudit = { doNotCall: new Map(), qualify: new Map() };

for (const v of VERTICALS) {
  const raw = asObjects(parseCSV(fs.readFileSync(path.join(DIR, v.file), "utf8")));
  const byEmail = new Map();
  const st = { rows: raw.length, noEmail: 0, badEmail: 0, inFileDupes: 0, catchAll: 0 };

  for (const r of raw) {
    for (const [key, col] of [["doNotCall", "Do Not Call"], ["qualify", "Qualify Contact"]]) {
      const val = r[col] || "(blank)";
      columnAudit[key].set(val, (columnAudit[key].get(val) ?? 0) + 1);
    }

    const email = (r["Email"] || "").toLowerCase().trim();
    if (!email) { st.noEmail++; continue; }
    if (!EMAIL_RX.test(email)) { st.badEmail++; continue; }

    const rec = {
      email,
      firstName: r["First Name"] || null,
      lastName: r["Last Name"] || null,
      title: r["Title"] || null,
      company: r["Company Name"] || null,
      companyCountry: r["Company Country"] || r["Country"] || null,
      domain: email.split("@")[1],
      sic: (r["SIC Codes"] || "").slice(0, 64) || null,
      score: score(r, v),
      suppressed: false,
      suppressReason: null,
    };
    if (/^catch-all$/i.test(r["Primary Email Catch-all Status"] || "")) {
      rec.suppressed = true;
      rec.suppressReason = "apollo:catch-all";
      st.catchAll++;
    }

    const prev = byEmail.get(email);
    if (prev) {
      st.inFileDupes++;
      if (rec.score > prev.score) byEmail.set(email, rec);
    } else {
      byEmail.set(email, rec);
    }
  }
  perTitle.set(v.slug, byEmail);
  stats[v.slug] = st;
}

// ---- cross-file dedupe: the higher-scoring copy keeps the contact ----

const owner = new Map(); // email -> slug
for (const v of VERTICALS) {
  for (const [email, rec] of perTitle.get(v.slug)) {
    const cur = owner.get(email);
    if (!cur) { owner.set(email, v.slug); continue; }
    const other = perTitle.get(cur).get(email);
    if (rec.score > other.score) {
      perTitle.get(cur).delete(email);
      owner.set(email, v.slug);
    } else {
      perTitle.get(v.slug).delete(email);
    }
    stats.crossFileDupes = (stats.crossFileDupes ?? 0) + 1;
  }
}

// ---- carry Smart SME's verification verdicts across ----

const sme = await prisma.newsletterProspect.findMany({
  where: { verifyStatus: { not: null } },
  select: { email: true, verifyStatus: true, verifyResult: true },
});
const smeVerdict = new Map(sme.map((p) => [p.email, p]));
let carriedGood = 0, carriedBad = 0;
for (const v of VERTICALS) {
  for (const rec of perTitle.get(v.slug).values()) {
    const hit = smeVerdict.get(rec.email);
    if (!hit || rec.suppressed) continue;
    if (hit.verifyStatus === "good") { rec.preVerified = "good"; rec.preVerifyResult = hit.verifyResult; carriedGood++; }
    else { rec.suppressed = true; rec.suppressReason = `verify:${hit.verifyResult} (carried from smart-sme)`; carriedBad++; }
  }
}
stats.carriedFromSme = { good: carriedGood, badOrRisky: carriedBad };

// ---- free MX pass on every domain still in play ----

const domains = new Set();
for (const v of VERTICALS) {
  for (const rec of perTitle.get(v.slug).values()) {
    if (!rec.suppressed) domains.add(rec.domain);
  }
}

const resolver = new dns.promises.Resolver({ timeout: 4000, tries: 1 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
const dead = new Set();
const queue = [...domains];
let checked = 0;
await Promise.all(
  Array.from({ length: 100 }, async () => {
    while (queue.length) {
      const d = queue.pop();
      try {
        await resolver.resolveMx(d);
      } catch (e) {
        if (e.code === "ENOTFOUND" || e.code === "ENODATA") {
          try {
            await resolver.resolve4(d);
          } catch (e2) {
            if (e2.code === "ENOTFOUND" || e2.code === "ENODATA") dead.add(d);
            // anything else: benefit of the doubt, MillionVerifier decides
          }
        }
      }
      if (++checked % 1000 === 0) console.log(`  mx pass: ${checked}/${domains.size} domains`);
    }
  })
);
stats.mx = { domainsChecked: domains.size, deadDomains: dead.size };

// ---- write ranked files ----

for (const v of VERTICALS) {
  const recs = [...perTitle.get(v.slug).values()];
  let noMx = 0;
  for (const rec of recs) {
    if (!rec.suppressed && dead.has(rec.domain)) {
      rec.suppressed = true;
      rec.suppressReason = "no-mx";
      noMx++;
    }
  }
  // Live rows by score, suppressed rows at the bottom: rank = line order.
  recs.sort((a, b) => (a.suppressed !== b.suppressed ? a.suppressed - b.suppressed : b.score - a.score));

  const header = "email,firstName,lastName,title,company,companyCountry,domain,sic,score,preVerified,preVerifyResult,suppressed,suppressReason";
  const lines = recs.map((r) =>
    [r.email, r.firstName, r.lastName, r.title, r.company, r.companyCountry, r.domain, r.sic, r.score,
     r.preVerified ?? "", r.preVerifyResult ?? "", r.suppressed ? 1 : 0, r.suppressReason ?? ""].map(csvCell).join(",")
  );
  const out = path.join(DIR, `ranked-${v.slug}.csv`);
  fs.writeFileSync(out, [header, ...lines].join("\n") + "\n");

  const live = recs.filter((r) => !r.suppressed);
  stats[v.slug] = {
    ...stats[v.slug],
    noMx,
    live: live.length,
    preVerifiedGood: live.filter((r) => r.preVerified === "good").length,
    suppressedTotal: recs.length - live.length,
    out,
  };
}

stats.columnAudit = {
  doNotCall: Object.fromEntries(columnAudit.doNotCall),
  qualifyContact: Object.fromEntries(columnAudit.qualify),
};
console.log(JSON.stringify(stats, null, 2));
await prisma.$disconnect();
