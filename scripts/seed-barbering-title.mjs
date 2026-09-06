// Create the Barbering Business title record.
//
// Title #4. Everything here comes from docs/vertical-brief-barbering.md; the
// two per-title rules in editorialStandardMd are the load-bearing part and are
// mirrored in docs/editorial-standard.md.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set,
// same as title #3: cap first, engine last, because ANTHROPIC_API_KEY is
// fleet-wide and an uncapped batch has taken every title down before. A site in
// status "setup" with the engine off is invisible to the scan cron
// (lib/cron.js filters on engineEnabled + live/cold_start), so seeding this
// before the WordPress site exists costs the live titles nothing.
//
//   node scripts/seed-barbering-title.mjs [--dry-run]
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

const SLUG = "barbering-business";

// Section names must match the `category` hints in BARBERING_NEWS_SEARCHES and
// the `category` values in scripts/batch-plan-barbering-business.json, or the
// Researcher's hint is dropped and the theme's section patterns render nothing.
// Trends & Services deliberately has no wire query: it is fed by the content
// plan only, per the owner-frame rule.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Business & Money", target: 6, commissionable: true },
  { name: "Marketing & Clients", target: 5, commissionable: true },
  { name: "Products & Tools", target: 6, commissionable: true },
  { name: "Shop & Fit-Out", target: 4, commissionable: true },
  { name: "Tech & Booking", target: 5, commissionable: true },
  { name: "People & Training", target: 4, commissionable: true },
  { name: "Trends & Services", target: 5, commissionable: true },
];

// The brief text lives in scripts/alignment/ so this seed, the alignment
// rollout (scripts/apply-alignment.mjs) and the docs all read one copy.
const ALIGN = (f) => fs.readFileSync(path.resolve("scripts/alignment", "barbering-business." + f), "utf8").trim();
const EDITORIAL_STANDARD = ALIGN("editorial-standard.md");

const HOUSE_STYLE = ALIGN("house-style.md");

const DATA = {
  slug: SLUG,
  name: "Barbering Business",
  strapline: "The business of barbering.",
  domain: "barberingbusiness.com",
  status: "setup",
  timezone: "Europe/London",

  // markAccent renders inside the square fallback mark on the rail and the
  // fleet dashboard — it needs initials, not a word ("Business" overflowed).
  markPrimary: "Barbering",
  markAccent: "BB",
  // Traditional barbering palette: brass on near-black. The image-led child
  // theme will carry the real look; these keep the fleet dashboard and the
  // fallback mark on-brand until artwork exists.
  accentHex: "#B08D3E",
  accent2Hex: "#D4AF6A",

  audience: ALIGN("audience.txt"),
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish.
  authorName: null,
  authorEmail: "news@news.barberingbusiness.com",
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
  // UK items a day once de-duplicated (docs/vertical-brief-barbering.md §5).
  // Same reasoning as golf: a higher target drains the evergreen backlog and
  // then publishes filler.
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
