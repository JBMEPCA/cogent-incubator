// Create the Gym Business News title record.
//
// One of the five titles in the 18 Sep 2026 wave. Everything here comes from
// docs/vertical-brief-gym-fitness-spa.md, including its "Refresh, 18 Sep 2026"
// section (which supersedes the original on competitors); spa is excluded.
// The scope rule and the claims rule in editorialStandardMd are the
// load-bearing part.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set:
// cap first, engine last, because ANTHROPIC_API_KEY is fleet-wide and an
// uncapped batch has taken every title down before. A site in status "setup"
// with the engine off is invisible to the scan cron (lib/cron.js filters on
// engineEnabled + live/cold_start), so seeding this before the WordPress site
// exists costs the live titles nothing.
//
//   node scripts/seed-gym-business-news-title.mjs [--dry-run]
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

const SLUG = "gym-business-news";

// Section names must match the `category` hints in GYM_BUSINESS_NEWS_SEARCHES
// (proposed in docs/gym-business-news-launch.md) and the `category` values in
// scripts/batch-plan-gym-business-news.json, or the Researcher's hint is
// dropped and the theme's section patterns render nothing. The child theme's
// section patterns use the WordPress slugs of these names (start-grow,
// money-compliance and so on).
//
// Start & Grow and People & PTs have almost no wire supply by design: the PT
// and start-up beats are evergreen (brief R3), fed by the content plan. Money
// & Compliance is the UK backbone the whole case rests on (brief R0).
// Franchise & Deals carries the international layer.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Start & Grow", target: 6, commissionable: true },
  { name: "Money & Compliance", target: 7, commissionable: true },
  { name: "Members & Marketing", target: 6, commissionable: true },
  { name: "Tech & Software", target: 5, commissionable: true },
  { name: "Equipment & Fit-Out", target: 4, commissionable: true },
  { name: "People & PTs", target: 5, commissionable: true },
  { name: "Franchise & Deals", target: 6, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "gym-business-news." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");

const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Gym Business News",
  strapline: "The business of fitness.",
  domain: "gymbusinessnews.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard: initials, not a word.
  markPrimary: "Gym Business",
  markAccent: "GBN",
  // Power magenta on iron graphite, matching the child theme's brand and
  // brand-bright slots. Chosen 18 Sep 2026 to be distinct from the five live
  // titles and the four launching the same day. If the palette changes, rerun
  // build-brand-palettes.mjs so newsletters and outreach follow.
  accentHex: "#B0185E",
  accent2Hex: "#EC4A8F",

  audience: ALIGN("audience.txt"),
  // UK-first, global-capable (brief R0): the UK money and compliance beat is
  // the backbone, and the US carries franchise, deal and software news. GB
  // leads because the evergreen seam is jurisdiction-locked.
  markets: ["GB", "US"],
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish, and make the child theme's
  // cogent_author_slug match that person's WordPress nicename.
  authorName: null,
  authorEmail: "news@news.gymbusinessnews.com",
  sections: SECTIONS,
  editorialStandardMd: EDITORIAL_STANDARD,
  houseStyleMd: HOUSE_STYLE,
  sectionTarget: 8,
  wordFloorGuide: 1100,
  wordFloorNews: 300,

  engineEnabled: false,
  officeHoursStart: 7,
  officeHoursEnd: 20,
  dailySpendCapUsd: 5,
  // Measured, not guessed: the business-intent wire yields roughly 2-3 usable
  // UK items a day and 5-7 global in a normal week (brief R3; the 18 Sep search
  // test in the launch doc agrees). A higher target drains the evergreen
  // backlog and then publishes filler.
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
    console.log(`  sections            ${SECTIONS.length}`);
    console.log(`  markets             ${site.markets.join(", ")}`);
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
