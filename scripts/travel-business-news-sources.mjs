// Seed Travel Business News's newswire with the sources verified on 2026-11-17.
//
// Same structure and same lesson as every source seed before it: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in SOURCES below was fetched on
// 2026-11-17 and returned valid RSS or Atom with at least one item.
//
// 51 kept of 53 verified. The research correctly excluded the agency and tour-operator trade (TTG, ABTA, Travel Weekly) as off-beat for the business-travel angle, which is the right call and the reason this title is not a second Travel Weekly. DROPPED two dormant feeds: Travalyst (newest item Jul 2023) and CWT (Sep 2025). A feed that has not moved in over a year costs a fetch every cycle and returns nothing.
//
// DELIBERATELY NOT SEEDED:
//   - Travalyst: newest item Jul 2023, dormant
//   - CWT: newest item Sep 2025, dormant
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them. Every one
// was probed on 2026-11-17 and has no usable feed. Most are advertiser or
// monitoring targets regardless, which is why they are listed rather than
// forgotten:
//   - Business Travel News Europe (403 bot wall) - the direct competitor, number one manual monitoring target
//   - Buying Business Travel (broken TLS to non-browser clients) - direct competitor
//   - The Business Travel Magazine (socket reset) - direct competitor
//   - PhocusWire (403)
//   - Institute of Travel Management ITM (no feed) - high-value partner and advertiser
//   - Business Travel Association BTA (403) - high-value sector body
//   - GBTA (no feed) - the BTI research is the sector's benchmark
//   - IATA (no feed)
//   - Clarity, Diversity Travel, Key Travel, ATPI, Agiito, Blue Cube, FCM, Corporate Traveller, Focus Travel Partnership, Good Travel Management, Advantage (prime UK TMC advertisers, none have feeds)
//   - TravelPerk, Soldo, Egencia, Amadeus, Sabre, Travelport, Serko, HRS, Emburse, Brex, Ramp, Payhawk, Spendesk (booking and expense advertisers, no feeds)
//   - International SOS, Healix, Crisis24, Riskline, World Travel Protection, Anvil, Drum Cussac (the whole duty-of-care supplier segment is feedless: an advertiser segment, not a content segment)
//   - Thrust Carbon, SQUAKE (carbon reporting advertisers)
//   - Accor, IHG, Marriott, Radisson (hotel corporate feeds absent; Hilton and Whitbread are the only two that work)
//   - Heathrow, Gatwick, Manchester Airport (JS media centres)
//   - Eurostar, Trainline, LNER, GWR, Avanti, Rail Delivery Group (no feeds; Rail Business Daily is the workaround)
//   - Business Travel Show Europe, The Business Travel Conference, The Meetings Show, M&IT (no feeds, which is why Events has one entry and the calendar must be hand-built)
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/travel-business-news-sources.mjs --site=travel-business-news [--dry-run]
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

// [name, website, category, feedUrl]
const SOURCES = [
  ["Foreign, Commonwealth & Development Office", "https://www.gov.uk/government/organisations/foreign-commonwealth-development-office", "Policy & tax", "https://www.gov.uk/government/organisations/foreign-commonwealth-development-office.atom"],
  ["FCDO Foreign Travel Advice", "https://www.gov.uk/foreign-travel-advice", "Policy & tax", "https://www.gov.uk/foreign-travel-advice.atom"],
  ["Home Office", "https://www.gov.uk/government/organisations/home-office", "Policy & tax", "https://www.gov.uk/government/organisations/home-office.atom"],
  ["UK Visas and Immigration", "https://www.gov.uk/government/organisations/uk-visas-and-immigration", "Policy & tax", "https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom"],
  ["Border Force", "https://www.gov.uk/government/organisations/border-force", "Policy & tax", "https://www.gov.uk/government/organisations/border-force.atom"],
  ["HM Passport Office", "https://www.gov.uk/government/organisations/hm-passport-office", "Policy & tax", "https://www.gov.uk/government/organisations/hm-passport-office.atom"],
  ["Department for Transport", "https://www.gov.uk/government/organisations/department-for-transport", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-transport.atom"],
  ["Civil Aviation Authority", "https://www.gov.uk/government/organisations/civil-aviation-authority", "Policy & tax", "https://www.gov.uk/government/organisations/civil-aviation-authority.atom"],
  ["Office of Rail and Road", "https://www.gov.uk/government/organisations/office-of-rail-and-road", "Policy & tax", "https://www.gov.uk/government/organisations/office-of-rail-and-road.atom"],
  ["HM Revenue & Customs", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Department for Business & Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["UK Health Security Agency", "https://www.gov.uk/government/organisations/uk-health-security-agency", "Policy & tax", "https://www.gov.uk/government/organisations/uk-health-security-agency.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Policy & tax", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["Office for National Statistics", "https://www.gov.uk/government/organisations/office-for-national-statistics", "Policy & tax", "https://www.gov.uk/government/organisations/office-for-national-statistics.atom"],
  ["Health and Safety Executive", "https://www.gov.uk/government/organisations/health-and-safety-executive", "Policy & tax", "https://www.gov.uk/government/organisations/health-and-safety-executive.atom"],
  ["National Cyber Security Centre", "https://www.gov.uk/government/organisations/national-cyber-security-centre", "Policy & tax", "https://www.gov.uk/government/organisations/national-cyber-security-centre.atom"],
  ["Business Traveller", "https://www.businesstraveller.com", "Sector press (competitor)", "https://www.businesstraveller.com/feed/"],
  ["The Company Dime", "https://www.thecompanydime.com", "Sector press (competitor)", "https://www.thecompanydime.com/feed/"],
  ["Skift", "https://skift.com", "Sector press (competitor)", "https://skift.com/feed/"],
  ["Travolution", "https://www.travolution.com", "Sector press (competitor)", "https://www.travolution.com/rss"],
  ["TravelDailyNews International", "https://www.traveldailynews.com", "Sector press (competitor)", "https://www.traveldailynews.com/feed/"],
  ["Travel Daily Media", "https://www.traveldailymedia.com", "Sector press (competitor)", "https://www.traveldailymedia.com/feed/"],
  ["Rail Business Daily", "https://news.railbusinessdaily.com", "Sector press (competitor)", "https://news.railbusinessdaily.com/feed/"],
  ["ACTE (Association of Corporate Travel Executives)", "https://www.acte.org", "Sector body", "https://www.acte.org/feed/"],
  ["AirportsUK (Airport Operators Association)", "https://airportsuk.org", "Sector body", "https://airportsuk.org/feed/"],
  ["European Regions Airline Association", "https://www.eraa.org", "Sector body", "https://www.eraa.org/feed/"],
  ["British Chambers of Commerce", "https://www.britishchambers.org.uk", "Sector body", "https://www.britishchambers.org.uk/feed/"],
  ["PCMA (business events)", "https://www.pcma.org", "Sector body", "https://www.pcma.org/feed/"],
  ["Amex Global Business Travel", "https://www.amexglobalbusinesstravel.com", "TMC", "https://www.amexglobalbusinesstravel.com/feed/"],
  ["BCD Travel", "https://www.bcdtravel.com", "TMC", "https://www.bcdtravel.com/feed/"],
  ["Reed & Mackay", "https://www.reedmackay.com", "TMC", "https://www.reedmackay.com/feed/"],
  ["Corporate Travel Management UK", "https://www.travelctm.co.uk", "TMC", "https://www.travelctm.co.uk/feed/"],
  ["Corporate Travel Management (global)", "https://www.travelctm.com", "TMC", "https://www.travelctm.com/feed/"],
  ["Gray Dawes Group", "https://www.gdg.travel", "TMC", "https://www.gdg.travel/feed/"],
  ["Inntel", "https://www.inntel.co.uk", "TMC", "https://www.inntel.co.uk/feed/"],
  ["Meon Valley Travel", "https://www.meonvalleytravel.com", "TMC", "https://www.meonvalleytravel.com/feed/"],
  ["Navan", "https://www.navan.com", "Supplier", "https://www.navan.com/blog/rss.xml"],
  ["Spotnana", "https://www.spotnana.com", "Supplier", "https://www.spotnana.com/feed/"],
  ["Pleo", "https://www.pleo.io", "Supplier", "https://blog.pleo.io/en/rss.xml"],
  ["Expensify", "https://use.expensify.com", "Supplier", "https://use.expensify.com/blog?format=rss"],
  ["SAP (SAP Concur)", "https://news.sap.com", "Supplier", "https://news.sap.com/feed/"],
  ["Coupa", "https://www.coupa.com", "Supplier", "https://www.coupa.com/feed"],
  ["Roomex", "https://www.roomex.com", "Supplier", "https://www.roomex.com/feed/"],
  ["HotelHub", "https://www.hotelhub.com", "Supplier", "https://www.hotelhub.com/feed/"],
  ["Hilton", "https://stories.hilton.com", "Supplier", "https://stories.hilton.com/feed"],
  ["Whitbread (Premier Inn)", "https://www.whitbread.co.uk", "Supplier", "https://www.whitbread.co.uk/feed/"],
  ["Hertz", "https://newsroom.hertz.com", "Supplier", "https://newsroom.hertz.com/feed"],
  ["Delta Air Lines", "https://news.delta.com", "Supplier", "https://news.delta.com/rss.xml"],
  ["Conference News", "https://www.conference-news.co.uk", "Events", "https://www.conference-news.co.uk/feed/"],
  ["Nina & Pinta", "https://www.ninaandpinta.com", "Research", "https://www.ninaandpinta.com/feed/"],
];

const DRY = process.argv.includes("--dry-run");
const slug = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1];
if (!slug) {
  console.error("Refusing to run without --site=<slug>.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) throw new Error(`No title with slug "${slug}"`);

  let created = 0, skipped = 0, withFeed = 0;
  for (const [name, website, category, feedUrl] of SOURCES) {
    const existing = await prisma.prBrand.findFirst({ where: { siteId: site.id, name } });
    if (existing) { skipped++; continue; }
    if (!DRY) {
      await prisma.prBrand.create({
        data: {
          siteId: site.id,
          name,
          category,
          website,
          // The scan cron filters on newsHubUrl, so a source without one is
          // invisible to the rotation and never gets scanned even once.
          newsHubUrl: new URL(website).origin,
          // feedStatus is deliberately left null even for verified feeds. It is
          // the scan cron's field to own, and writing "ok" here would assert an
          // in-app state nothing has actually confirmed yet.
          feedUrl: feedUrl || null,
          notes: feedUrl
            ? "Seeded from scripts/travel-business-news-sources.mjs. Feed verified by fetch 2026-11-17."
            : "Seeded from scripts/travel-business-news-sources.mjs. No feed found 2026-11-17; hub autodiscovery plus outreach target.",
        },
      });
    }
    created++;
    if (feedUrl) withFeed++;
  }

  const total = await prisma.prBrand.count({ where: { siteId: site.id } });
  console.log(`${site.name}: ${created} created (${withFeed} with a verified feed), ${skipped} already present`);
  console.log(`Total sources for this title: ${DRY ? total + " (before dry-run additions)" : total}`);
  if (DRY) console.log("\n--- DRY RUN, nothing written ---");
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
