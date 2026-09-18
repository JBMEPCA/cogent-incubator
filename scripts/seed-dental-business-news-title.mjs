// Create the Dental Business News title record.
//
// One of the five titles in the 18 Sep 2026 wave. Everything here comes from
// docs/vertical-brief-dental.md; the four per-title rules in
// editorialStandardMd (owner, scope, claims, fitness-to-practise) are the
// load-bearing part, and docs/dental-business-news-launch.md carries the same
// rules as a block ready for docs/editorial-standard.md.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as every title since #3: cap first, engine last, because
// ANTHROPIC_API_KEY is fleet-wide and an uncapped batch has taken every title
// down before. A site in status "setup" with the engine off is invisible to the
// scan cron (lib/cron.js filters on engineEnabled + live/cold_start), so seeding
// this before the WordPress site exists costs the live titles nothing.
//
//   node scripts/seed-dental-business-news-title.mjs [--dry-run]
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

const SLUG = "dental-business-news";

// Section names must match the `category` hints in DENTAL_BUSINESS_NEWS_SEARCHES
// (proposed in docs/dental-business-news-launch.md) and the `category` values in
// scripts/batch-plan-dental-business-news.json, or the Researcher's hint is
// dropped and the theme's section patterns render nothing. The child theme's
// cogent_home_sections list carries the same eight as WordPress slugs.
//
// Finance & Tax deliberately has NO wire query: every finance query tested on
// 18 Sep 2026 returned US DSO and stock-tip items and nothing usable from the
// UK. It is fed by the content plan and the direct feeds (NASDAL, DJH, PFM
// Dental, HMRC, Bank of England) only.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Deals & Groups", target: 5, commissionable: true },
  { name: "NHS Contract", target: 6, commissionable: true },
  { name: "Private & Plans", target: 4, commissionable: true },
  { name: "Finance & Tax", target: 4, commissionable: true },
  { name: "Workforce", target: 4, commissionable: true },
  { name: "Regulation & Compliance", target: 4, commissionable: true },
  { name: "Premises & Technology", target: 4, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "dental-business-news." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");

const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Dental Business News",
  strapline: "The business of UK dentistry.",
  // .com only: JB bought dentalbusinessnews.com at GoDaddy on 18 Sep 2026 and
  // did not buy the .co.uk.
  domain: "dentalbusinessnews.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard: initials, not a word.
  markPrimary: "Dental",
  markAccent: "DBN",
  // Surgery teal and aqua, the pair the child theme's palette is built on
  // (dental-business-news-website/child/theme.json). Rerun
  // scripts/build-brand-palettes.mjs once the site palette is final so
  // newsletters and outreach match.
  accentHex: "#0B5E63",
  accent2Hex: "#2BB3AA",

  audience: ALIGN("audience.txt"),
  // UK-only. The brief found no case for Ireland at launch; add "IE" here, not
  // in prompts, if that changes.
  markets: ["GB"],
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish, and make the child theme's
  // cogent_author_slug match that person's WordPress nicename.
  authorName: null,
  // A Mailchimp sending subdomain, NOT a Workspace user (decision of 24 Aug
  // 2026). Do not seed the outreach credential with it.
  authorEmail: "news@news.dentalbusinessnews.com",
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
  // Measured, not guessed: the brief counted about 4 to 5 usable items a day,
  // but roughly 40% of the UK layer is the incumbent's own copy or BDA
  // releases, which leaves 2 to 2.5 a day of independent supply
  // (docs/vertical-brief-dental.md §5). A higher target drains the evergreen
  // plan and then publishes filler.
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
