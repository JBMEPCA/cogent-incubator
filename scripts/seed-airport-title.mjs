// Create the Airport Business Magazine title record.
//
// Title #5. Everything here comes from docs/vertical-brief-airports.md; the
// four per-title rules in editorialStandardMd are the load-bearing part and are
// mirrored in docs/editorial-standard.md.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as titles #3 and #4: cap first, engine last, because ANTHROPIC_API_KEY
// is fleet-wide and an uncapped batch has taken every title down before. A site
// in status "setup" with the engine off is invisible to the scan cron
// (lib/cron.js filters on engineEnabled + live/cold_start), so seeding this
// before the WordPress site exists costs the live titles nothing.
//
//   node scripts/seed-airport-title.mjs [--dry-run]
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

const SLUG = "airport-business-magazine";

// Section names must match the `category` hints in AIRPORT_NEWS_SEARCHES and
// the `category` values in scripts/batch-plan-airport-business-magazine.json,
// or the Researcher's hint is dropped and the theme's section patterns render
// nothing. Revenue & Commercial is the seam the whole vertical case rests on
// (brief §2): it has almost no wire supply by design — it is fed by the content
// plan and by scheduled data drops (ACI economics, operator results), not
// manufactured news.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Revenue & Commercial", target: 6, commissionable: true },
  { name: "Expansion & Construction", target: 7, commissionable: true },
  { name: "Technology & Systems", target: 6, commissionable: true },
  { name: "Operations & Resilience", target: 5, commissionable: true },
  { name: "Route Development", target: 4, commissionable: true },
  { name: "Sustainability & Energy", target: 4, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "airport-business-magazine." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");

const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Airport Business Magazine",
  strapline: "The business of running an airport.",
  domain: "airportbusinessmagazine.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard — initials, not a word (see barbering's note).
  markPrimary: "Airport",
  markAccent: "ABM",
  // Apron navy with wayfinding amber: the signage palette of the industry
  // itself. The child theme carries the real look; these keep the fleet
  // dashboard and the fallback mark on-brand.
  accentHex: "#123B66",
  accent2Hex: "#E8A013",

  audience: ALIGN("audience.txt"),
  // Global title: keyword discovery and prompt context run US-first, UK
  // second (Site.markets drives the Researcher's Google editions and the
  // batch publisher's market-sensitive lines).
  markets: ["US", "GB"],
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish.
  authorName: null,
  authorEmail: "news@news.airportbusinessmagazine.com",
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
  // Measured, not guessed: the scoped infrastructure wire yields 3-5 usable
  // items a day across GB+US locales (docs/vertical-brief-airports.md §5) —
  // the best of any title. Start at 3 anyway, same as golf and barbering: the
  // constraint at launch is the evergreen backlog and the cold-start link
  // gate, not the wire.
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
      console.log("  " + k.padEnd(22) + (s.length > 100 ? s.slice(0, 100) + "…" : s));
    }
    console.log("\n--- DRY RUN, nothing written ---");
  } else {
    const site = await prisma.site.create({ data: DATA });
    console.log(`Created ${site.name} (${site.slug})`);
    console.log(`  sections            ${SECTIONS.length}`);
    console.log(`  engineEnabled       ${site.engineEnabled}  <- stays false until launch`);
    console.log(`  dailySpendCapUsd    ${site.dailySpendCapUsd}`);
    console.log(`  articlesPerDayTarget ${site.articlesPerDayTarget}`);
    console.log(`  authorName          ${site.authorName ?? "(unset — must be a real person before first publish)"}`);
  }
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
