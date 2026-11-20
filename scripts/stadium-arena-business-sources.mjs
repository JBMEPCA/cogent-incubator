// Seed Stadium and Arena Business's newswire with the sources verified on 2026-11-17.
//
// Same structure and same lesson as every source seed before it: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in SOURCES below was fetched on
// 2026-11-17 and returned valid RSS or Atom with at least one item.
//
// 57 verified. No gambling or betting operator was probed or included, per the title's hard rule. Mirrors were de-duped (ASM Global serves the Legends feed, Exhibition World serves Exhibition News, Camatic serves Hussey). The construction and architecture feeds are adjacent rather than core: they carry venue projects but also a lot of off-beat material, so they need tight filtering downstream.
//
// SUPPRESSION: Naming-rights and sponsorship stories from legitimate venue sources routinely carry betting-brand names. Add a keyword suppression rule downstream so a gambling sponsor cannot walk into an article through an on-beat source.
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them. Every one
// was probed on 2026-11-17 and has no usable feed. Most are advertiser or
// monitoring targets regardless, which is why they are listed rather than
// forgotten:
//   - TheStadiumBusiness (403 Cloudflare) - the single most important competitor and unreadable by wire; their summit site leaks some of the same stories and IS seeded. Number one manual monitoring target
//   - VenuesNow (no feed at any path) - core US competitor; sister title Pollstar works and is seeded
//   - TheTicketingBusiness, SportBusiness, Sportcal (403)
//   - Populous (no feed) - the biggest venue architect in the world; monitoring and advertiser target
//   - KSS, Lendlease, Mace (403), AFL Architects, ISG - venue contractors and architects, all advertiser targets
//   - AEG Worldwide, Live Nation, Delaware North (empty feed), Compass UK, Sodexo UK - operators and caterers
//   - SIS Pitches, Daktronics, Ferco, Tarkett Sports, GreenFields, Mondo, ADI, Spektrix, DICE, Skiddle, Tixserve, SeatGeek - the supplier side is genuinely feed-poor and is an outreach list, not a wire input
//   - AEV, AEO, ESSA, mia, National Arenas Association, Sport and Recreation Alliance, UKCMA (403) - sector bodies with no feed
//   - Event Industry News, PanStadia, UK Music, European Arenas Association, Event Industry Forum, BVEP, Stadium Managers Association - unreachable from the research sandbox (DNS/TLS), NOT confirmed absent: retry from the production host before writing them off
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/stadium-arena-business-sources.mjs --site=stadium-arena-business [--dry-run]
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
  ["mondo*stadia", "https://www.mondostadia.com", "Sector press (competitor)", "https://www.mondostadia.com/feed/"],
  ["Stadia Magazine", "https://www.stadia-magazine.com", "Sector press (competitor)", "https://www.stadia-magazine.com/feed/"],
  ["Sports Venue Business", "https://www.sportsvenuebusiness.com", "Sector press (competitor)", "https://www.sportsvenuebusiness.com/feed/"],
  ["Coliseum", "https://www.coliseum-online.com", "Sector press (competitor)", "https://www.coliseum-online.com/feed/"],
  ["StadiumDB", "https://stadiumdb.com", "Sector press (competitor)", "https://stadiumdb.com/rss/news"],
  ["Pollstar", "https://news.pollstar.com", "Sector press (competitor)", "https://news.pollstar.com/feed/"],
  ["IQ Magazine", "https://www.iq-mag.net", "Sector press (competitor)", "https://www.iq-mag.net/feed/"],
  ["Access All Areas", "https://accessaa.co.uk", "Sector press (competitor)", "https://accessaa.co.uk/feed/"],
  ["Exhibition News", "https://exhibitionnews.uk", "Sector press (competitor)", "https://exhibitionnews.uk/feed/"],
  ["Conference News", "https://www.conference-news.co.uk", "Sector press (competitor)", "https://www.conference-news.co.uk/feed/"],
  ["TicketNews", "https://www.ticketnews.com", "Sector press (competitor)", "https://www.ticketnews.com/feed/"],
  ["TPi Magazine", "https://www.tpimagazine.com", "Sector press (competitor)", "https://www.tpimagazine.com/feed/"],
  ["Athletic Business", "https://www.athleticbusiness.com", "Sector press (competitor)", "https://www.athleticbusiness.com/rss"],
  ["SportsPro", "https://www.sportspromedia.com", "Sector press (competitor)", "https://www.sportspromedia.com/feed/"],
  ["Sport Industry Group", "https://www.sportindustry.biz", "Sector press (competitor)", "https://www.sportindustry.biz/feed/"],
  ["Front Office Sports", "https://www.frontofficesports.com", "Sector press (competitor)", "https://www.frontofficesports.com/feed/"],
  ["AV Interactive", "https://www.avinteractive.com", "Supplier", "https://www.avinteractive.com/feed/"],
  ["Installation International", "https://www.installation-international.com", "Supplier", "https://www.installation-international.com/feed"],
  ["Construction Enquirer", "https://www.constructionenquirer.com", "Sector press (competitor)", "https://www.constructionenquirer.com/feed/"],
  ["Global Construction Review", "https://www.globalconstructionreview.com", "Sector press (competitor)", "https://www.globalconstructionreview.com/feed/"],
  ["New Civil Engineer", "https://www.newcivilengineer.com", "Sector press (competitor)", "https://www.newcivilengineer.com/feed/"],
  ["Construction News", "https://www.constructionnews.co.uk", "Sector press (competitor)", "https://www.constructionnews.co.uk/feed"],
  ["Dezeen", "https://www.dezeen.com", "Sector press (competitor)", "https://www.dezeen.com/feed/"],
  ["ArchDaily", "https://www.archdaily.com", "Sector press (competitor)", "https://www.archdaily.com/rss/"],
  ["Hospitality and Catering News", "https://www.hospitalityandcateringnews.com", "Sector press (competitor)", "https://www.hospitalityandcateringnews.com/feed/"],
  ["Leisure Opportunities", "https://www.leisureopportunities.co.uk", "Sector press (competitor)", "https://www.leisureopportunities.co.uk/rss"],
  ["Sports Field Management", "https://www.sportsfieldmanagementonline.com", "Supplier", "https://www.sportsfieldmanagementonline.com/feed/"],
  ["Turf Matters", "https://www.turfmatters.co.uk", "Supplier", "https://www.turfmatters.co.uk/feed/"],
  ["International Association of Venue Managers", "https://www.iavm.org", "Sector body", "https://www.iavm.org/feed/"],
  ["ESSMA (European Stadium and Safety Management Association)", "https://www.essma.eu", "Sector body", "https://www.essma.eu/feed/"],
  ["Music Venue Trust", "https://www.musicvenuetrust.com", "Sector body", "https://www.musicvenuetrust.com/feed/"],
  ["National Outdoor Events Association", "https://noea.org.uk", "Sector body", "https://noea.org.uk/feed/"],
  ["Institute of Licensing", "https://www.instituteoflicensing.org", "Sector body", "https://www.instituteoflicensing.org/feed/"],
  ["Dept for Culture, Media and Sport", "https://www.gov.uk/government/organisations/department-for-culture-media-and-sport", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-culture-media-and-sport.atom"],
  ["Sport England", "https://www.gov.uk/government/organisations/sport-england", "Policy & tax", "https://www.gov.uk/government/organisations/sport-england.atom"],
  ["UK Sport", "https://www.gov.uk/government/organisations/uk-sport", "Policy & tax", "https://www.gov.uk/government/organisations/uk-sport.atom"],
  ["Sports Grounds Safety Authority", "https://www.gov.uk/government/organisations/sports-grounds-safety-authority", "Policy & tax", "https://www.gov.uk/government/organisations/sports-grounds-safety-authority.atom"],
  ["Health and Safety Executive", "https://www.gov.uk/government/organisations/health-and-safety-executive", "Policy & tax", "https://www.gov.uk/government/organisations/health-and-safety-executive.atom"],
  ["Home Office", "https://www.gov.uk/government/organisations/home-office", "Policy & tax", "https://www.gov.uk/government/organisations/home-office.atom"],
  ["Security Industry Authority", "https://www.gov.uk/government/organisations/security-industry-authority", "Policy & tax", "https://www.gov.uk/government/organisations/security-industry-authority.atom"],
  ["Dept for Business and Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["Ministry of Housing, Communities and Local Government", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government", "Policy & tax", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom"],
  ["Arts Council England", "https://www.gov.uk/government/organisations/arts-council-england", "Policy & tax", "https://www.gov.uk/government/organisations/arts-council-england.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["HM Revenue and Customs", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["Environment Agency", "https://www.gov.uk/government/organisations/environment-agency", "Policy & tax", "https://www.gov.uk/government/organisations/environment-agency.atom"],
  ["Dept for Transport", "https://www.gov.uk/government/organisations/department-for-transport", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-transport.atom"],
  ["VisitBritain", "https://www.gov.uk/government/organisations/visitbritain", "Policy & tax", "https://www.gov.uk/government/organisations/visitbritain.atom"],
  ["Legends Global (incl. ASM Global)", "https://legendsglobal.com", "Operator", "https://legendsglobal.com/feed/"],
  ["Oak View Group", "https://oakviewgroup.com", "Operator", "https://oakviewgroup.com/feed/"],
  ["Hussey Seating (incl. Camatic)", "https://www.husseyseating.com", "Supplier", "https://www.husseyseating.com/feed/"],
  ["Ticketmaster Business", "https://business.ticketmaster.com", "Supplier", "https://business.ticketmaster.com/feed/"],
  ["AudienceView", "https://www.audienceview.com", "Supplier", "https://www.audienceview.com/feed/"],
  ["TheStadiumBusiness Summit (Xperiology)", "https://www.stadiumbusinesssummit.com", "Events", "https://www.stadiumbusinesssummit.com/feed/"],
  ["Two Circles", "https://twocircles.com", "Research", "https://twocircles.com/feed/"],
  ["GlobalData", "https://www.globaldata.com", "Research", "https://www.globaldata.com/feed/"],
  ["Mintel", "https://www.mintel.com", "Research", "https://www.mintel.com/feed/"],
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
            ? "Seeded from scripts/stadium-arena-business-sources.mjs. Feed verified by fetch 2026-11-17."
            : "Seeded from scripts/stadium-arena-business-sources.mjs. No feed found 2026-11-17; hub autodiscovery plus outreach target.",
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
