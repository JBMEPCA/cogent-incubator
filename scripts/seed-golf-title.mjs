// Create the Golf Resort Magazine title record.
//
// Title #3. Everything here comes from docs/vertical-brief-golf-resorts.md; the
// three per-title rules in editorialStandardMd are the load-bearing part and are
// mirrored in docs/editorial-standard.md.
//
// Deliberately created with engineEnabled FALSE and a spend cap already set. The
// playbook's order is cap first, engine last, because ANTHROPIC_API_KEY is
// fleet-wide and an uncapped batch has taken every title down before.
//
//   node scripts/seed-golf-title.mjs [--dry-run]
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

const SLUG = "golf-resort-magazine";

// Section names must match the `category` hints in GOLF_NEWS_SEARCHES and the
// WordPress category slugs, or the Researcher's hint is dropped and the theme's
// section patterns render nothing.
const SECTIONS = [
  { name: "News", target: 8, commissionable: true },
  { name: "Investment & Ownership", target: 6, commissionable: true },
  { name: "Development & Design", target: 6, commissionable: true },
  { name: "Operations & Revenue", target: 6, commissionable: true },
  { name: "Course & Grounds", target: 5, commissionable: true },
  { name: "Golf Travel Trade", target: 5, commissionable: true },
  { name: "Technology", target: 5, commissionable: true },
  { name: "Sustainability & Water", target: 5, commissionable: true },
];

const EDITORIAL_STANDARD = `# Golf Resort Magazine editorial standard

## The buyer rule, which outranks everything else here

Every article is written for someone who is **paid** to be at a golf resort:
owner, investor, general manager, director of golf, course manager, developer,
architect, tour operator, supplier. If the natural reader is someone on holiday,
it is not our article.

No course reviews. No "best of" or bucket-list destination lists. No travel
guides. No tournament reporting, except where it is a business story about the
host venue.

This is a commercial rule, not a matter of taste. Golf is the one vertical where
the consumer twin is the entire category, and it is defended by domains a
hundred times stronger than ours: Golf Digest sits at Tranco 17,994 and GOLF.com
at 26,097, against a golf trade press running from 458,746 down to 2,487,655.
Drifting consumer means competing with those on their own ground, and losing
permanently. Roughly half the raw newswire is travel and tournament content, so
the pull toward that mistake is constant and mechanical. The keyword exclusions
in lib/news-searches.js thin it; they do not remove it.

## The market-size rule

Published valuations of the golf tourism market vary by more than 4x between
research firms — $6.9bn to $30.6bn for the same year. Always name the firm and
the year, or quote the range. Never assert a single market size in our own voice.

## The geopolitics rule

Saudi PIF money runs through this sector, and Trump-owned properties are
simultaneously golf venues and US political stories. Cover both as business:
capital, capacity, bookings, contracts, ownership. Do not editorialise on human
rights or US domestic politics. A title with no named political correspondent
has no standing to take a side, and taking one costs advertisers on both flanks.

The environmental critique of golf — water, land use, chemicals — **is** ours to
cover, and covering it straight is an advantage, because the incumbent titles are
too close to their advertisers to do it well. That is reporting on the industry,
not adjudicating foreign policy.

## Global by default

42% of the world's golf courses are in the United States. Do not write UK-only
copy, do not assume UK regulation, and give currency and units in the form the
story's own market uses. Where a figure is national, say which nation.

## Standing rules

- Named bylines on everything.
- Never invent a statistic, a source, a quote or a commentator.
- Link out to the company and the original announcement on any news piece.
- No em dashes or en dashes, per house style.
`;

const HOUSE_STYLE = `# Golf Resort Magazine house style

Write for someone running a property: a general manager between a greens meeting
and a rate review, or an owner reading on a plane. They are commercially
literate, time-poor, and sceptical of anything that sounds like a brochure.

- Lead with the number, the deal or the decision. Never with scene-setting.
- Money in the currency of the market being described, with a conversion in
  brackets only when the comparison is the point.
- "Course" is the 18 holes. "Resort" is the business. "Club" is the membership
  structure. They are not interchangeable and readers notice.
- Name the operator, the owner and the management company separately. After 2026
  they are frequently three different entities.
- Agronomy is covered as cost, risk and capital, not as technique. We do not tell
  a superintendent how to do their job.
- No golf idiom in headlines. No "par for the course", no "teeing up", no
  "driving growth". It reads consumer and it is beneath the title.
- British spelling.
`;

const DATA = {
  slug: SLUG,
  name: "Golf Resort Magazine",
  strapline: "The business of golf resorts worldwide.",
  domain: "golfresortmagazine.com",
  status: "setup",
  timezone: "Europe/London",

  markPrimary: "Golf",
  markAccent: "GRM",
  accentHex: "#15694A",
  accent2Hex: "#34A46B",

  audience:
    "Golf resort owners, investors, general managers, directors of golf, course managers, developers, architects, golf tour operators and their suppliers, worldwide — from single independent resorts to multi-property management companies.",
  bylineMode: "per_title_person",
  // authorName is deliberately null. The editorial standard requires a real
  // named byline and inventing one would breach it on day one. Set it to the
  // actual person before the first publish.
  authorName: null,
  authorEmail: "news@golfresortmagazine.com",
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
  // Measured, not guessed. The business-intent news queries yield roughly three
  // usable items a day once de-duplicated, so a higher target just drains the
  // evergreen backlog and then publishes filler.
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
