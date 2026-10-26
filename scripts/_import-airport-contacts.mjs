// Load JB's new airport contacts (26 Oct 2026) into the newsletter drip for
// Airport Business Magazine.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_import-airport-contacts.mjs [--write]
//
// The title's queue has run dry: 9,806 prospects, every live one already
// imported, nothing waiting. The file is a raw Apollo export (10,000 rows,
// same columns as the launch pull), so it is scored with the same airport
// vertical rules rank-prospects.mjs used, deduped against what the title
// already holds, and appended after the existing ranks.
//
// Two deliberate departures from the launch ranker, both per JB 21 Sep 2026
// ("subscriber lists hold nothing back"):
//   - Apollo catch-all rows are NOT suppressed; they are loaded live but
//     sorted after every confirmed address, so the drip reaches them last
//   - nothing is dropped for being airline-side rather than airport-side;
//     the vertical scoring already ranks airport people first
//
// Suppression is reserved for what can never be mailed: junk local parts and
// domains with no MX and no A record (free DNS pass).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";
import { prisma, forSite } from "../lib/prisma.js";

const WRITE = process.argv.includes("--write");
const FILE = "C:/Users/CIM Ltd/AppData/Local/Temp/Airport Contacts New.csv";
const MASTER = path.join(os.homedir(), ".claude", "data", "airport-contacts-2026-10.csv");

// ---- CSV plumbing (same parser as rank-prospects.mjs) ----

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

// ---- airport vertical scoring, as in rank-prospects.mjs ----

const strongRole = /\b(airport|aviation|airside|terminal|ground handling|air cargo|aerodrome)\b/i;
const weakRole = /\b(commercial|retail|property|real estate|concessions?|parking|infrastructure|route)\b/i;
const companyHint = /\b(airport|aviation|aeroport|ground handling|civil aviation|airfield)\b/i;
const airlineHint = /\b(airline|airways|air lines)\b/i;

function seniority(title) {
  const t = title.toLowerCase();
  if (/\b(owner|founder|ceo|chief executive|president|managing director|md)\b/.test(t)) return 30;
  if (/\b(director|head of|vp|vice president|chief \w+ officer|partner)\b/.test(t)) return 24;
  if (/\bmanager\b|\bmanagement\b/.test(t)) return 16;
  return 6;
}

function score(r) {
  let s = seniority(r["Title"] || "");
  const title = r["Title"] || "";
  if (strongRole.test(title)) s += 30;
  else if (weakRole.test(title)) s += 15;

  const companyText = `${r["Company Name"] || ""} ${r["Keywords"] || ""}`;
  if (companyHint.test(companyText)) s += 10;

  // Email-quality signals: ordering only, never proof (Apollo was wrong for
  // 11% of Smart SME's list).
  const verifiedAt = Date.parse(r["Primary Email Last Verified At"] || "");
  if (verifiedAt) {
    const months = (Date.now() - verifiedAt) / (30 * 24 * 3600 * 1000);
    if (months <= 12) s += 8;
    else if (months <= 24) s += 4;
  }
  if (/zerobounce/i.test(r["Primary Email Verification Source"] || "")) s += 4;
  return s;
}

// ---- load, clean, dedupe in-file ----

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const JUNK_LOCAL = /^(abuse|postmaster|webmaster|hostmaster|noreply|no-reply|no_reply|privacy|legal|dpo|unsubscribe|spam|phishing)$/;

const raw = asObjects(parseCSV(fs.readFileSync(FILE, "utf8")));
const st = { rows: raw.length, noEmail: 0, badEmail: 0, junkLocal: 0, inFileDupes: 0, catchAll: 0, airlineSide: 0 };

const byEmail = new Map();
for (const r of raw) {
  const email = (r["Email"] || "").toLowerCase().trim();
  if (!email) { st.noEmail++; continue; }
  if (!EMAIL_RX.test(email)) { st.badEmail++; continue; }
  const [local, dom] = email.split("@");
  if (JUNK_LOCAL.test(local) || dom.startsWith("www.")) { st.junkLocal++; continue; }

  const rec = {
    email,
    firstName: r["First Name"] || null,
    lastName: r["Last Name"] || null,
    title: r["Title"] || null,
    company: r["Company Name"] || null,
    companyCountry: r["Company Country"] || r["Country"] || null,
    domain: dom,
    sic: (r["SIC Codes"] || "").slice(0, 64) || null,
    score: score(r),
    catchAll: /^catch-all$/i.test(r["Primary Email Catch-all Status"] || ""),
    linkedin: r["Person Linkedin Url"] || "",
  };

  const prev = byEmail.get(email);
  if (prev) {
    st.inFileDupes++;
    if (rec.score > prev.score) byEmail.set(email, rec);
  } else {
    byEmail.set(email, rec);
  }
}

const all = [...byEmail.values()];
st.catchAll = all.filter((r) => r.catchAll).length;
st.airlineSide = all.filter((r) => airlineHint.test(r.company || "") && !companyHint.test(r.company || "")).length;

// ---- free MX pass on every domain ----

const domains = new Set(all.map((r) => r.domain));
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
            // anything else: benefit of the doubt, verification decides later
          }
        }
      }
      if (++checked % 1000 === 0) console.log(`  mx pass: ${checked}/${domains.size} domains`);
    }
  })
);
st.mx = { domainsChecked: domains.size, deadDomains: dead.size };

for (const r of all) {
  if (dead.has(r.domain)) { r.suppressed = true; r.suppressReason = "no-mx"; }
}
st.noMx = all.filter((r) => r.suppressReason === "no-mx").length;

// Confirmed addresses by score, then catch-alls by score, suppressed last.
all.sort((a, b) =>
  ((a.suppressed ? 1 : 0) - (b.suppressed ? 1 : 0)) ||
  ((a.catchAll ? 1 : 0) - (b.catchAll ? 1 : 0)) ||
  (b.score - a.score) ||
  a.email.localeCompare(b.email)
);

// Durable master copy outside any repo (no contact data in git, ever again),
// keeping the LinkedIn URLs the prospect table has no column for — they are
// how interview sourcing finds these people later. Temp gets wiped.
fs.mkdirSync(path.dirname(MASTER), { recursive: true });
fs.writeFileSync(
  MASTER,
  "email,firstName,lastName,title,company,companyCountry,linkedin,catchAll,suppressReason\n" +
    all.map((r) => [r.email, r.firstName, r.lastName, r.title, r.company, r.companyCountry, r.linkedin, r.catchAll ? 1 : 0, r.suppressReason ?? ""].map(csvCell).join(",")).join("\n") +
    "\n"
);

// ---- dedupe against what the title already holds, append after its ranks ----

const site = await prisma.site.findUnique({ where: { slug: "airport-business-magazine" } });
const db = forSite(site.id);

const existing = new Set(
  (await db.newsletterProspect.findMany({ select: { email: true } })).map((p) => p.email.toLowerCase()),
);
const fresh = all.filter((p) => !existing.has(p.email));
const dupes = all.length - fresh.length;

const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

console.log(`file          ${st.rows} rows, ${all.length} unique valid addresses`);
console.log(`dropped       noEmail ${st.noEmail}, badEmail ${st.badEmail}, junkLocal ${st.junkLocal}, inFileDupes ${st.inFileDupes}`);
console.log(`mx pass       ${st.mx.domainsChecked} domains, ${st.mx.deadDomains} dead -> ${st.noMx} rows suppressed no-mx`);
console.log(`catch-all     ${st.catchAll} (loaded live, ranked after confirmed)`);
console.log(`airline-side  ${st.airlineSide} (loaded, vertical scoring ranks them low)`);
console.log(`already held  ${dupes}`);
console.log(`to add        ${fresh.length}, ranks ${rank} to ${rank + fresh.length - 1}`);
console.log(`master map    ${MASTER}`);
const liveConfirmed = fresh.filter((p) => !p.suppressed && !p.catchAll).length;
const liveCatchAll = fresh.filter((p) => !p.suppressed && p.catchAll).length;
console.log(`of which      ${liveConfirmed} confirmed live, ${liveCatchAll} catch-all live, ${fresh.length - liveConfirmed - liveCatchAll} suppressed`);
console.log(`\nfirst five by rank:`);
for (const p of fresh.slice(0, 5)) console.log(`  ${p.score}  ${p.title ?? "?"} at ${p.company ?? "?"}  ${p.email}`);

if (!WRITE) {
  console.log("\nDRY RUN. Nothing written to the database. Re-run with --write.");
  await prisma.$disconnect();
  process.exit(0);
}

const records = fresh.map((p) => ({
  siteId: site.id,
  email: p.email,
  firstName: p.firstName,
  lastName: p.lastName,
  title: p.title,
  company: p.company,
  companyCountry: p.companyCountry,
  domain: p.domain,
  sic: p.sic,
  score: p.score,
  rank: rank++,
  suppressed: !!p.suppressed,
  suppressReason: p.suppressReason ?? null,
}));

let written = 0;
for (let i = 0; i < records.length; i += 2000) {
  const res = await db.newsletterProspect.createMany({ data: records.slice(i, i + 2000), skipDuplicates: true });
  written += res.count;
  console.log(`  ${written}/${records.length}`);
}
console.log(`\ncreated ${written} prospects`);

const { prospectStats } = await import("../lib/prospects.js");
console.log(JSON.stringify(await prospectStats(site.id), null, 1));
await prisma.$disconnect();
