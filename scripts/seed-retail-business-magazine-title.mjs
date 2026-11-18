// Create the Retail Business Magazine title record.
//
// One of the five titles in the 17 Nov 2026 wave. Everything here comes from
// docs/retail-business-magazine-launch.md and scripts/alignment/retail-business-magazine.*.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as every title since #3: cap first, engine last, because
// ANTHROPIC_API_KEY is fleet-wide and an uncapped batch has taken every title
// down before. A site in status "setup" with the engine off is invisible to
// the scan cron (lib/cron.js filters on engineEnabled plus live/cold_start),
// so seeding this before the WordPress site exists costs the live titles
// nothing.
//
//   node scripts/seed-retail-business-magazine-title.mjs [--dry-run]
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

const SLUG = "retail-business-magazine";

// Section names must match the `category` values in
// scripts/batch-plan-retail-business-magazine.json AND the slugs in the child theme's
// cogent_home_sections filter, or the plan reserves an article to a section
// the homepage never renders.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Convenience & Independents", target: 7, commissionable: true },
  { name: "Grocery & Supermarkets", target: 5, commissionable: true },
  { name: "Brands & Ranging", target: 6, commissionable: true },
  { name: "Money & Rates", target: 7, commissionable: true },
  { name: "Crime & Security", target: 5, commissionable: true },
  { name: "Retail Tech & Payments", target: 4, commissionable: true },
  { name: "High Street & Property", target: 4, commissionable: true },
];

const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", SLUG + "." + f), "utf8").trim();

const DATA = {
  slug: SLUG,
  name: "Retail Business Magazine",
  strapline: "Where brands meet the shelf.",
  domain: "retailbusinessmagazine.com",
  status: "setup",
  timezone: "Europe/London",

  markPrimary: "Retail",
  markAccent: "RBM",
  accentHex: "#E3262F",
  accent2Hex: "#FF6069",

  audience: ALIGN("audience.txt"),
  markets: ["GB"],
  bylineMode: "per_title_person",
  // Deliberately null. The editorial standard requires a real named byline and
  // inventing one would breach it on day one. Set it to the actual person, and
  // create the WordPress user with that nicename, BEFORE the first publish.
  authorName: null,
  authorEmail: "news@news.retailbusinessmagazine.com",
  sections: SECTIONS,
  editorialStandardMd: ALIGN("editorial-standard.md"),
  houseStyleMd: ALIGN("house-style.md"),
  sectionTarget: 8,
  wordFloorGuide: 1100,
  wordFloorNews: 300,

  engineEnabled: false,
  officeHoursStart: 7,
  officeHoursEnd: 20,
  dailySpendCapUsd: 5,
  // Two a day, which is where the whole fleet sits since 27 Oct 2026. The
  // earlier waves started at 3 and were brought down; starting at the fleet
  // standard avoids a cut in week two. The constraint at launch is the
  // evergreen backlog and the cold-start link gate, not the wire.
  articlesPerDayTarget: 2,
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
      console.log("  " + k.padEnd(22) + (s.length > 100 ? s.slice(0, 100) + "\u2026" : s));
    }
    console.log("\n--- DRY RUN, nothing written ---");
  } else {
    const site = await prisma.site.create({ data: DATA });
    console.log(`Created ${site.name} (${site.slug})`);
    console.log(`  sections             ${SECTIONS.length}`);
    console.log(`  markets              ${JSON.stringify(site.markets)}`);
    console.log(`  engineEnabled        ${site.engineEnabled}  <- stays false until launch`);
    console.log(`  dailySpendCapUsd     ${site.dailySpendCapUsd}`);
    console.log(`  articlesPerDayTarget ${site.articlesPerDayTarget}`);
    console.log(`  authorName           ${site.authorName ?? "(unset - must be a real person before first publish)"}`);
  }
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
