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

const EDITORIAL_STANDARD = `# Barbering Business editorial standard

## The owner-frame rule, which outranks everything else here

Every article is written for the person who owns the chair, never the person
sitting in it: barbershop owners, chair-renting self-employed barbers, and
anyone running a male grooming business. If the natural reader is someone who
wants a haircut, it is not our article.

This is a commercial rule, not a taste one. Barbering has the worst consumer
twin of any title in the fleet: single style terms pull six-figure monthly
search volumes ("low taper fade" ~550k/month globally) and "barber near me"
outruns branded search in most UK cities. Drifting consumer means competing
with that volume on its own ground, and losing permanently.

Trend and style content IS in scope — it is part of the commercial brief — but
only through the owner's lens: what the trend does to the service menu, the
prices, the booking demand, and how to sell the upgrade. No styling tutorials,
no "how to ask your barber", no celebrity hair coverage for its own sake.

## The figures rule

Market sizes in this sector vary by analyst scope. UK men's grooming products
run £1.2bn to £2.3bn for the same year depending on the firm; hair & beauty
services turnover runs £4.6bn to £6.1bn. Name the firm and the year, or quote
the range. Never assert a single figure in our own voice, and never blend the
products line with the services line. Price benchmarks (haircut prices, chair
rents, fit-out costs) are always attributed, dated ranges.

## The crime-coverage rule

The NCA's crackdown on money-laundering through barbershops (Operation
Machinize) is a legitimate, recurring policy story — and a libel trap whose
victims would be our own readers. We report the policy, the enforcement
statistics and the sector bodies' responses. We never connect a named shop, a
chain, or the nationality of an owner to the laundering narrative unless
reporting a concluded prosecution from a primary source. When in doubt the
piece runs without the name, or does not run.

## Standing rules

- Named bylines on everything.
- Never invent a statistic, a source, a quote or a commentator.
- Link out to the company and the original announcement on any news piece.
- No em dashes or en dashes, per house style.
`;

const HOUSE_STYLE = `# Barbering Business house style

Write for someone who cuts hair for a living and runs the business between
clients: reading on their phone in the ten minutes before the next booking.
Direct, practical, respectful of the craft without romanticising it.

- Lead with the money, the decision or the change. Never with scene-setting.
- Money in pounds. Costs and prices as attributed ranges, never invented.
- "Shop" is the business. "Chair" is the unit of capacity and revenue. A
  chair-renter is a business owner, not staff — write to them as one.
- The reader's margin is thin and their time is thinner. Every piece should
  leave them with something they can do this week.
- No barber puns in headlines. No "a cut above", no "shear success", no
  "trimming costs". It reads consumer and it is beneath the title.
- Respect the trade's look: this is an image-led industry. Specify imagery of
  real shops, real work and real kit; never sterile stock offices.
- British spelling.
`;

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

  audience:
    "UK barbers, barbershop owners, chair-renting self-employed barbers and anyone running a male grooming business — from a single chair to a multi-site group — plus the academies, brands and suppliers that serve them.",
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
