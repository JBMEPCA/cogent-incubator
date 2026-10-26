// Load Tom's barber database (26 Oct 2026) into the newsletter drip for
// Barbering Business.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_import-barber-database.mjs [--write]
//
// The file is email,instagram pairs scraped per shop: 1,857 unique emails and
// 4,536 IG handles. The scrape grabbed every mailto: on each shop's site, so
// alongside the real inboxes it holds publishers, estate agents, accountants,
// football clubs, casinos and at least one literal spam trap. Three buckets:
//
//   barbery   - a barber/hair/grooming term in the domain, local part or IG
//   freemail  - personal addresses at UK consumer providers (sole traders)
//   other     - kept only if hand-reviewed into the keeps file, which lives
//               OUTSIDE this repo (no contact data in git, ever again):
//               ~/.claude/data/barber-other-keeps.txt
//
// No names or companies in the data, so ranking is: shops with a live
// Instagram first (the best activity signal we have), then alphabetical,
// appended after the existing ranks.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma, forSite } from "../lib/prisma.js";

const WRITE = process.argv.includes("--write");
const FILE = "C:/Users/CIM Ltd/AppData/Local/Temp/Barber database.csv";
const KEEPS = path.join(os.homedir(), ".claude", "data", "barber-other-keeps.txt");
const MASTER = path.join(os.homedir(), ".claude", "data", "barber-database-2026-10.csv");

const REPAIRS = new Map([
  ["1200info@cold-bath.co.uk", "info@cold-bath.co.uk"],
  ["207-info@titanicbarbers.com", "info@titanicbarbers.com"],
  ["_london@barberette.co.uk", "london@barberette.co.uk"],
]);

const FREEMAIL = /^(gmail|googlemail|hotmail|outlook|yahoo|icloud|me|live|aol|btinternet|sky|msn|mail|protonmail|ymail|btconnect|talktalk|virginmedia)\.(com|co\.uk|net|org|uk)$/;
const BARBER = /barber|barbier|grooming|groom|gents|gent\b|cuts|kutz|cutz|fade|fadez|shave|shaving|clipper|trim|blade|razor|turk|mens|menshair|hairdress|hair|salon|studio|scissor|pomade|moustache|mustache|beard/;
const JUNK_LOCAL = /^(abuse|postmaster|webmaster|hostmaster|noreply|no-reply|no_reply|privacy|legal|dpo|careers|jobs|recruitment|press|wordpress|server|root|sites|website|spider-feedback|reportphishing|unsubscribe)$/;
// Domains whose addresses are never the shop's own, even when the scraper
// attached a real barber's IG handle to them: booking platforms, site
// builders, font foundries scraped out of page CSS, casinos, landlords and
// web agencies. The keeps file is checked first, so a hand-kept address at
// one of these (wahlprouk@jrl.uk) still gets through.
const DOMAIN_BLOCK = new Set([
  "edan.io", "phorest.de", "phorest.fi", "readymag.com", "vagaro.com",
  "nearcut.com", "schedulista.com", "riiwards.com", "bookinbeautiful.com",
  "memocasino.co.uk", "astronautslot.org", "jovanny.ru", "xzt5tsios.mx",
  "m.me", "mysite.com", "site.com", "hello.com", "contact.pl", "nelson.com",
  "power.com", "adeline.com", "unit.link", "revolver.com", "iginomarini.com",
  "indiantypefoundry.com", "latofonts.com", "happyleaves.com", "guru.net.uk",
  "jrl.uk", "westmidlandsrailway.co.uk", "jwmarriottlv.com", "pawfections.uk",
  "truelovetattoos.co.uk", "your-tattooshop.com", "enterprise-centre.org",
  "my-surfacing.co.uk", "brandpossum.co.uk", "ndiscovered.com",
  "couragenoble.com", "myhounslow.co.uk", "idontspeakfrench.co.uk",
  "hhpromotions.co.uk", "princebishopsplace.co.uk", "raczgroup.co.uk",
  "sflyorkshire.co.uk", "greyzip.com", "astigmatic.com", "beckyknowles.com",
  "dcthems.com", "minibreak.app", "christophermoss.co.uk", "mewiesandco.com",
  "robertortega.com", "simonhadley.co.uk", "ninjamailtrap.com",
]);

const keeps = new Set(
  fs.readFileSync(KEEPS, "utf8").split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")),
);

const clean = (v) => String(v || "").trim().replace(/^"|"$/g, "");
const lines = fs.readFileSync(FILE, "utf8").split(/\r?\n/).slice(1).filter((l) => l.trim());

const byEmail = new Map();
for (const line of lines) {
  const i = line.indexOf(",");
  let email = clean(i === -1 ? line : line.slice(0, i)).toLowerCase();
  const ig = clean(i === -1 ? "" : line.slice(i + 1)).replace(/^@/, "").toLowerCase();
  if (!email) continue;
  email = REPAIRS.get(email) || email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
  const prev = byEmail.get(email);
  if (!prev || (!prev.ig && ig)) byEmail.set(email, { email, ig: ig || (prev ? prev.ig : "") });
}

const all = [...byEmail.values()];
const verdicts = { barbery: 0, freemail: 0, kept: 0, junk: 0, dropped: 0 };
const verdictOf = (r) => {
  const [local, dom] = r.email.split("@");
  if (JUNK_LOCAL.test(local) || dom.startsWith("www.") || /^u00[0-9a-f]{2}/.test(local) || dom.endsWith(".myftpupload.com")) return "junk";
  if (keeps.has(r.email)) return "kept";
  if (DOMAIN_BLOCK.has(dom)) return "junk";
  if (BARBER.test(dom) || BARBER.test(local) || BARBER.test(r.ig)) return "barbery";
  if (FREEMAIL.test(dom)) return "freemail";
  return "dropped";
};
const parsed = all.filter((r) => {
  const v = verdictOf(r);
  verdicts[v] = (verdicts[v] ?? 0) + 1;
  return v === "kept" || v === "barbery" || v === "freemail";
});

parsed.sort((a, b) => (b.ig ? 1 : 0) - (a.ig ? 1 : 0) || a.email.localeCompare(b.email));

// Durable master copy of the cleaned email-to-IG mapping, outside any repo,
// for interview sourcing later. Tom's original sits in Temp and will be wiped.
fs.mkdirSync(path.dirname(MASTER), { recursive: true });
fs.writeFileSync(MASTER, "email,instagram,verdict\n" + all.map((r) => `${r.email},${r.ig},${verdictOf(r)}`).join("\n") + "\n");

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const db = forSite(site.id);

const existing = new Set(
  (await db.newsletterProspect.findMany({ select: { email: true } })).map((p) => p.email.toLowerCase()),
);
const fresh = parsed.filter((p) => !existing.has(p.email));
const dupes = parsed.length - fresh.length;

const top = await db.newsletterProspect.aggregate({ _max: { rank: true } });
let rank = (top._max.rank || 0) + 1;

console.log(`file          ${lines.length} rows, ${all.length} unique valid addresses`);
console.log(`verdicts      ${JSON.stringify(verdicts)}`);
console.log(`importable    ${parsed.length} (with IG: ${parsed.filter((p) => p.ig).length})`);
console.log(`already held  ${dupes}`);
console.log(`to add        ${fresh.length}, ranks ${rank} to ${rank + fresh.length - 1}`);
console.log(`master map    ${MASTER}`);
console.log(`\nfirst five by rank:`);
for (const p of fresh.slice(0, 5)) console.log(`  ${p.email}  ${p.ig ? "@" + p.ig : ""}`);

if (!WRITE) {
  console.log("\nDRY RUN. Nothing written to the database. Re-run with --write.");
  await prisma.$disconnect();
  process.exit(0);
}

let made = 0;
for (const p of fresh) {
  await db.newsletterProspect.create({
    data: {
      siteId: site.id,
      email: p.email,
      domain: p.email.split("@")[1],
      companyCountry: "United Kingdom",
      score: p.ig ? 1 : 0,
      rank: rank++,
    },
  });
  made++;
}
console.log(`\ncreated ${made} prospects`);

const { prospectStats } = await import("../lib/prospects.js");
console.log(JSON.stringify(await prospectStats(site.id), null, 1));
await prisma.$disconnect();
