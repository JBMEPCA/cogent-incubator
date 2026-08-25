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

const EDITORIAL_STANDARD = `# Airport Business Magazine editorial standard

## The buyer rule, which outranks everything else here

Every article is written for someone who is paid to be at an airport: operator,
director, terminal or ops manager, commercial director, developer, contractor,
consultant, supplier. If the natural reader is a passenger, it is not our
article.

No travel tips, no lounge reviews, no "best airports" lists, no passenger-rights
or flight-delay content, no "how early should I arrive". Disruption is covered
as a cost line and a procurement consequence, never as travel news. This is a
commercial rule: the consumer aviation press (Simple Flying, The Points Guy,
Flightradar24) sits at Tranco 2k-16k against a trade press at 102k-645k, and
drifting consumer means fighting them on their own ground, permanently.

## The scope-and-figure rule

Airport numbers diverge by SCOPE, not just by analyst. Duty free is $42.8bn or
$94bn depending on the definition; Riyadh's new airport is $30bn, $50bn or
$100bn depending on the programme boundary; Poland's CPK figure includes
railways. Every figure carries source, year and scope, or is quoted as a range
with the firms named. Never one bare number in our own voice. Project costs are
attributed to the promoter or a named report, and dated: airport megaproject
budgets move constantly.

## The geopolitics rule

Saudi giga-projects, Chinese vendors excluded from Western procurement, US
security politics, national planning fights: this sector is threaded with
politics. We cover all of it as business only: capital, capacity, contracts,
costs, timelines. No editorial line on human rights, trade policy or any
country's domestic politics. A title with no named political correspondent has
no standing to take a side, and taking one costs advertisers on both flanks.

## The incident rule

We do not cover crashes, security breaches, or crime as news. They are the
tabloid layer of this sector, the fastest route to consumer drift, and a
reputational trap. Disruption enters our pages only as economics: what the
outage cost, what the recovery required, what the airport then procured.
Security coverage stays at procurement level (who bought which scanner, what
the checkpoint upgrade cost) and never at vulnerability level (how screening
fails). If a story's hook is that people were hurt or endangered, it is not our
story.

## Standing rules

- Named bylines on everything.
- Never invent a statistic, a source, a quote or a commentator.
- Link out to the organisation and the original announcement on any news piece.
- No em dashes or en dashes, per house style.
`;

const HOUSE_STYLE = `# Airport Business Magazine house style

Write for someone who runs part of an airport and reads between meetings:
direct, technical where the subject is technical, and always anchored to money,
capacity or time. This is the most data-forward title in the fleet, by design.

- Lead with the number, the decision or the change. Never with scene-setting.
- Money in the currency of the story with a US dollar equivalent for large
  figures. Costs always attributed and dated (the scope-and-figure rule).
- Global title, British spelling. Dates as 24 August 2026. Metric first.
- "The airport" is a business with a P&L. Passengers are traffic and spend per
  head, not the reader.
- Prefer a table to a paragraph of numbers. Every table has a source line.
- No aviation puns in headlines. No "taking off", "ready for take-off",
  "flying high", "cleared for landing", "turbulence ahead". It reads consumer
  and it is beneath the title.
- Imagery: big architectural photography of terminals, airside, and
  construction; real infrastructure, never generic travel stock of passengers
  with suitcases.
`;

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

  audience:
    "Airport operators, directors, terminal and ops managers, commercial directors and anyone buying, building or running anything inside an airport, worldwide, plus the contractors, consultants and suppliers that serve them.",
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
