// Create the Nursery Daily title record.
//
// One of the five titles in the 18 Sep 2026 wave. Everything here comes from
// docs/vertical-brief-nurseries.md; the safeguarding rule in
// editorialStandardMd is the load-bearing part and is proposed for
// docs/editorial-standard.md in docs/nursery-daily-launch.md.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set:
// cap first, engine last, because ANTHROPIC_API_KEY is fleet-wide and an
// uncapped batch has taken every title down before. A site in status "setup"
// with the engine off is invisible to the scan cron (lib/cron.js filters on
// engineEnabled + live/cold_start), so seeding this before the WordPress site
// exists costs the live titles nothing.
//
// LAUNCH BLOCKER, READ BEFORE ENABLING THE ENGINE. The brief requires that no
// draft touching harm to a child can publish without a human, and that this
// title has no auto-publish path at all. As of 18 Sep 2026 the engine has no
// per-title way to hold articles for approval: app/api/cron/publish-due
// publishes anything in status review OR approved with qaPassed, and
// scripts/batch-publish.js posts straight to WordPress as "publish". There is
// no Site column to set here. See docs/nursery-daily-launch.md, "Human review".
//
//   node scripts/seed-nursery-daily-title.mjs [--dry-run]
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

const SLUG = "nursery-daily";

// Section names must match the `category` hints in the proposed
// NURSERY_DAILY_NEWS_SEARCHES (docs/nursery-daily-launch.md) and the
// `category` values in scripts/batch-plan-nursery-daily.json, or the
// Researcher's hint is dropped and the theme's section patterns render nothing.
// Operations & Tech deliberately has no wire query: vendor names in Google News
// return Bayeux Tapestry stories, so the section is fed by the content plan and
// the supplier feeds only.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Funding & Fees", target: 6, commissionable: true },
  { name: "Deals & Valuations", target: 5, commissionable: true },
  { name: "Staffing & Pay", target: 5, commissionable: true },
  { name: "Compliance & Ofsted", target: 5, commissionable: true },
  { name: "Property & Premises", target: 4, commissionable: true },
  { name: "Operations & Tech", target: 4, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "nursery-daily." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");
const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Nursery Daily",
  strapline: "The early years sector, by the numbers.",
  domain: "nurserydaily.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard, so it takes initials, not a word.
  markPrimary: "Nursery",
  markAccent: "ND",
  // Ochre and saffron, matching the child theme's brand and amber slots.
  // Rerun scripts/build-brand-palettes.mjs once the child theme is final.
  accentHex: "#8C5E0A",
  accent2Hex: "#D19A2A",

  audience: ALIGN("audience.txt"),
  // England-led. Scotland, Wales and NI funding differ and are covered, but the
  // Google editions and the batch publisher's market lines key off this list,
  // and a GB edition is the right one for all four nations.
  markets: ["GB"],
  bylineMode: "per_title_person",
  // authorName is deliberately null. The brief makes named human editors a
  // launch requirement (child-welfare adjacency, YMYL) and inventing one would
  // breach the standard on day one. Set it to the actual person before the
  // first publish, and make the child theme's cogent_author_slug match.
  authorName: null,
  authorEmail: "news@news.nurserydaily.com",
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
  // The masthead says Daily; the wire does not. The brief measured about 2.3
  // sector-grade Google News items a day, and the proposed search set about 3
  // usable a day before direct feeds (docs/nursery-daily-launch.md). Three is
  // what the 52 direct feeds plus the plan can sustain; re-measure after two
  // weeks and lower it if sector-grade supply stays under 3 a day.
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
    console.log(`  engineEnabled       ${site.engineEnabled}  <- stays false until launch AND until human review exists`);
    console.log(`  dailySpendCapUsd    ${site.dailySpendCapUsd}`);
    console.log(`  articlesPerDayTarget ${site.articlesPerDayTarget}`);
    console.log(`  authorName          ${site.authorName ?? "(unset, must be a real person before first publish)"}`);
  }
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
