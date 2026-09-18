// Create the Senior Living Business title record.
//
// One of the five-title wave of 18 Sep 2026. Everything here comes from
// docs/vertical-brief-retirement-villages.md; the per-title rules in
// editorialStandardMd (the front-door rule above all) are the load-bearing
// part, and the paste-ready block for docs/editorial-standard.md is in
// docs/senior-lifestyle-business-launch.md.
//
// THE NAME MAY CHANGE (a US operator trades as Senior Lifestyle). It is kept
// in as few places as possible: `name` below, and markPrimary/markAccent,
// which are initials and a short word for the fleet dashboard's fallback
// mark. The slug and the domain stay as they are either way.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as every title since #3: cap first, engine last, because
// ANTHROPIC_API_KEY is fleet-wide and an uncapped batch has taken every title
// down before. A site in status "setup" with the engine off is invisible to the
// scan cron, so seeding this before the WordPress site exists costs the live
// titles nothing.
//
//   node scripts/seed-senior-lifestyle-business-title.mjs [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const SLUG = "senior-lifestyle-business";

// Section names must match the `category` hints in the proposed
// SENIOR_LIFESTYLE_BUSINESS_NEWS_SEARCHES (docs/senior-lifestyle-business-launch.md)
// and the `category` values in scripts/batch-plan-senior-lifestyle-business.json,
// or the Researcher's hint is dropped and the theme's section patterns render
// nothing. Design & Amenities deliberately has no wire query: the measured
// design query was about 25% usable and duplicated other beats, so the
// section is fed by the content plan and the design-press feeds only.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Development & Planning", target: 6, commissionable: true },
  { name: "Capital & Investment", target: 6, commissionable: true },
  { name: "Operators & Economics", target: 6, commissionable: true },
  { name: "Fees & Regulation", target: 5, commissionable: true },
  { name: "Sales & Marketing", target: 4, commissionable: true },
  { name: "Design & Amenities", target: 4, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "senior-lifestyle-business." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");
const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Senior Living Business",
  strapline: "The business of retirement communities.",
  domain: "seniorlifestylebusiness.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard: initials, not a word. Both change if the name does.
  markPrimary: "Senior",
  markAccent: "SLB",
  // Aubergine with heather: the child theme's palette, chosen to read as
  // premium property and investment rather than care-home soft, and distinct
  // from every live title (blue, green, oxblood, navy). The child theme
  // carries the real look; these keep the dashboard and fallback mark on-brand.
  accentHex: "#4E2A51",
  accent2Hex: "#B48CB2",

  audience: ALIGN("audience.txt"),
  // Global title, UK-led. Order is priority: GB first because the seam is the
  // UK (no free trade title exists there), AU and NZ second because they share
  // the deferred-fee model and carry most of the wire, US last and only for
  // capital deals and benchmarks. markets[0] also decides the keyword
  // registry's market, which is why GB leads.
  // KNOWN GAP (shared code, see the launch doc): NZ is not yet in the
  // Researcher's SUGGEST_EDITIONS or the batch publisher's MARKET_NAMES, so
  // until those lines are added NZ falls back to the GB edition and prints as
  // "NZ" in prompts. Nothing breaks; it is just less precise.
  markets: ["GB", "AU", "NZ", "US"],
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish, and match the child theme's
  // cogent_author_slug.
  authorName: null,
  authorEmail: "news@news.seniorlifestylebusiness.com",
  sections: SECTIONS,
  editorialStandardMd: EDITORIAL_STANDARD,
  houseStyleMd: HOUSE_STYLE,
  sectionTarget: 7,
  wordFloorGuide: 1100,
  wordFloorNews: 300,

  engineEnabled: false,
  officeHoursStart: 7,
  officeHoursEnd: 20,
  dailySpendCapUsd: 5,
  // Measured, not guessed: the brief found about 5 usable stories a day across
  // UK, AU/NZ and US capital, and only about 1.5 UK-only; the launch search set
  // measured similar in a week flattered by the NZ reform story. Start at 3,
  // same as every recent title: the constraint at launch is the evergreen
  // backlog and the cold-start link gate, not the wire.
  articlesPerDayTarget: 3,
  newsletterEnabled: false,
  linkedInEnabled: false,
  outreachEnabled: false,
};

const DRY = process.argv.includes("--dry-run");
const prisma = new PrismaClient();
try {
  const existing = await prisma.site.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`"${SLUG}" already exists (status ${existing.status}). Nothing written.`);
    console.log("Edit it at /s/" + SLUG + "/settings rather than re-seeding.");
  } else if (DRY) {
    console.log("Would create:\n");
    for (const [k, v] of Object.entries(DATA)) {
      const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
      console.log("  " + k.padEnd(22) + (s.length > 100 ? s.slice(0, 100) + "..." : s));
    }
    console.log("\n--- DRY RUN, nothing written ---");
  } else {
    const site = await prisma.site.create({ data: DATA });
    console.log(`Created ${site.name} (${site.slug})`);
    console.log(`  sections             ${SECTIONS.length}`);
    console.log(`  markets              ${site.markets.join(", ")}`);
    console.log(`  engineEnabled        ${site.engineEnabled}  <- stays false until launch`);
    console.log(`  dailySpendCapUsd     ${site.dailySpendCapUsd}`);
    console.log(`  articlesPerDayTarget ${site.articlesPerDayTarget}`);
    console.log(`  authorName           ${site.authorName ?? "(unset: must be a real person before first publish)"}`);
  }
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
