// Create the Smart Farming News title record.
//
// One of the five titles in the 18 Sep 2026 wave. Everything here comes from
// docs/vertical-brief-farming.md and docs/smart-farming-news-launch.md; the
// four per-title rules in editorialStandardMd are the load-bearing part and
// are proposed for docs/editorial-standard.md in the launch tracker.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as every title since #3: cap first, engine last, because
// ANTHROPIC_API_KEY is fleet-wide and an uncapped batch has taken every title
// down before. A site in status "setup" with the engine off is invisible to
// the scan cron (lib/cron.js filters on engineEnabled + live/cold_start), so
// seeding this before the WordPress site exists costs the live titles nothing.
//
//   node scripts/seed-smart-farming-news-title.mjs [--dry-run]
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

const SLUG = "smart-farming-news";

// Section names must match the `category` hints in SMART_FARMING_NEWS_SEARCHES
// (proposed in docs/smart-farming-news-launch.md) and the `category` values in
// scripts/batch-plan-smart-farming-news.json, or the Researcher's hint is
// dropped and the theme's section patterns render nothing.
//
// The angle is "farming smarter as a business" and JB has not confirmed which
// way it leans. The list holds both halves so the lean is a change of targets,
// not a rebuild:
//   tech:           Farm Tech, Software & Data
//   land-business:  Energy & Land Use, Natural Capital, Diversification,
//                   Land, Tax & Succession
//   both:           News, Finance & Grants
// To lean tech, raise the tech targets and lower the land ones (and reorder
// cogent_home_sections in the child); to lean land, the reverse. No section
// is ever deleted, because a category with published articles must not lose
// its homepage slot.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Energy & Land Use", target: 6, commissionable: true },
  { name: "Farm Tech", target: 6, commissionable: true },
  { name: "Diversification", target: 6, commissionable: true },
  { name: "Software & Data", target: 5, commissionable: true },
  { name: "Natural Capital", target: 5, commissionable: true },
  { name: "Finance & Grants", target: 5, commissionable: true },
  { name: "Land, Tax & Succession", target: 5, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "smart-farming-news." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");

const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Smart Farming News",
  strapline: "Farming smarter as a business.",
  domain: "smartfarmingnews.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard: it needs initials, not a word.
  markPrimary: "Smart Farming",
  markAccent: "SFN",
  // Field Orange and its bright, matching the child theme's brand and
  // brand-bright. Rerun scripts/build-brand-palettes.mjs once the child's
  // theme.json is final, so newsletters and outreach take the same palette.
  accentHex: "#C2410C",
  accent2Hex: "#F26B1D",

  // UK-led. Ireland is covered only where it moves UK farm money, which is an
  // editorial judgement rather than a second market: adding "IE" here would
  // send the Researcher's autocomplete lane into the Irish edition, where
  // Agriland and the Irish Farmers Journal own everything.
  markets: ["GB"],

  audience: ALIGN("audience.txt"),
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and this title's person has not been chosen (launch tracker,
  // open decision). Set it to the actual person before the first publish, and
  // make the child's cogent_author_slug match.
  authorName: null,
  authorEmail: "news@news.smartfarmingnews.com",
  sections: SECTIONS,
  editorialStandardMd: EDITORIAL_STANDARD,
  houseStyleMd: HOUSE_STYLE,
  sectionTarget: 8,
  wordFloorGuide: 1200,
  wordFloorNews: 300,

  engineEnabled: false,
  officeHoursStart: 7,
  officeHoursEnd: 20,
  dailySpendCapUsd: 5,
  // Supply is not the constraint (the brief measured 15 to 25 usable farm
  // business items a day, and 4 to 6 on the land-business seam); discipline
  // is. Three a day keeps the title off the incumbents' daily beat while the
  // evergreen plan builds the archive.
  articlesPerDayTarget: 3,
  newsletterEnabled: false,
  linkedInEnabled: false,
  outreachEnabled: false,
};

const DRY = process.argv.includes("--dry-run");

if (DRY) {
  // A dry run never needs the database, so it works on a machine with no
  // DATABASE_URL and can never write by accident.
  console.log("Would create (if no row with this slug exists):\n");
  for (const [k, v] of Object.entries(DATA)) {
    const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    console.log("  " + k.padEnd(22) + (s.length > 100 ? s.slice(0, 100) + "..." : s));
  }
  console.log("\n--- DRY RUN, nothing written ---");
} else {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.site.findUnique({ where: { slug: SLUG } });
    if (existing) {
      console.log(`"${SLUG}" already exists (status ${existing.status}). Nothing written.`);
      console.log("Edit it at /s/" + SLUG + "/settings rather than re-seeding.");
    } else {
      const site = await prisma.site.create({ data: DATA });
      console.log(`Created ${site.name} (${site.slug})`);
      console.log(`  sections            ${SECTIONS.length}`);
      console.log(`  markets             ${JSON.stringify(site.markets)}`);
      console.log(`  engineEnabled       ${site.engineEnabled}  <- stays false until launch`);
      console.log(`  dailySpendCapUsd    ${site.dailySpendCapUsd}`);
      console.log(`  articlesPerDayTarget ${site.articlesPerDayTarget}`);
      console.log(`  authorName          ${site.authorName ?? "(unset: must be a real person before first publish)"}`);
    }
  } catch (e) {
    console.error("FAILED: " + e.message.split("\n")[0]);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
