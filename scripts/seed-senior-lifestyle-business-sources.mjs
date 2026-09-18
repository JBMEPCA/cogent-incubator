// Seed Senior Lifestyle Business's newswire with direct feeds, trade bodies
// and the operator map from docs/vertical-brief-retirement-villages.md.
//
// Same structure as the other titles' source seeds, same lesson behind it: a Google
// News query is not a source, direct feeds return real articles, and the
// launch target is 30+ verified feeds. Every URL in the verified sections
// below returned valid RSS/Atom with items when fetched on 18 Sep 2026
// (docs/senior-lifestyle-business-sources.md holds the verification record
// with newest-item dates and the ingester quirks). 48 feeds: UK 28, AU 7,
// NZ 8, US 5.
//
// THE FRONT-DOOR RULE shapes this list. Care Home Magazine is CIM's own title
// and its feed is deliberately absent: it goes on the outreach exclusion list,
// never the wire. Rows marked "front-door filter" are care-weighted feeds that
// also carry village and extra care news; the Researcher keeps the resident-
// with-their-own-front-door stories and drops the care-home ones.
//
// NOTABLE ABSENCES (all probed 18 Sep 2026): ARCO's rss.xml is valid but its
// newest item is from 2021; Housing LIN, Knight Frank, Savills, Lichfields and
// every large UK operator publish no feed; McCarthy Stone, HCR Law, Care Home
// Professional, Ingenia and GemLife refuse fetchers. The Law Commission and
// Birchgrove have VALID BUT EMPTY feeds, the "empty is not working" trap, so
// they are seeded hub-only. ARCO, Housing LIN and Knight Frank are the top
// lib/newsrooms.js candidates.
//
// COMPETITOR-FLAGGED SOURCES are monitoring sources: they tell the Researcher
// what the incumbents have covered; they are not outreach targets and their
// copy is never a source to rewrite without the underlying primary source.
//
//   node scripts/seed-senior-lifestyle-business-sources.mjs --site=senior-lifestyle-business [--dry-run]
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
// A fourth element means the feed was verified by hand on 18 Sep 2026 and goes
// straight in. Three elements means hub-only: lib/feeds.js autodiscovers, and
// if it finds nothing the row still earns its place as an outreach target or a
// lib/newsrooms.js candidate.
const SOURCES = [
  // ---- UK policy, regulators and data (verified feeds) ----
  ["MHCLG", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government", "Regulator", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom"],
  ["Homes England", "https://www.gov.uk/government/organisations/homes-england", "Regulator", "https://www.gov.uk/government/organisations/homes-england.atom"],
  ["Planning Inspectorate", "https://www.gov.uk/government/organisations/planning-inspectorate", "Regulator", "https://www.gov.uk/government/organisations/planning-inspectorate.atom"],
  ["gov.uk wire: use class C2", "https://www.gov.uk/search/all?keywords=%22use+class+C2%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22use+class+C2%22"],
  ["gov.uk wire: retirement housing", "https://www.gov.uk/search/all?keywords=%22retirement+housing%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22retirement+housing%22"],
  ["gov.uk wire: later living", "https://www.gov.uk/search/all?keywords=%22later+living%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22later+living%22"],
  ["gov.uk wire: retirement community", "https://www.gov.uk/search/all?keywords=%22retirement+community%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22retirement+community%22"],
  ["gov.uk wire: housing with care", "https://www.gov.uk/search/all?keywords=%22housing+with+care%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22housing+with+care%22"],
  ["gov.uk wire: event fees", "https://www.gov.uk/search/all?keywords=%22event+fees%22", "Regulator", "https://www.gov.uk/search/all.atom?keywords=%22event+fees%22"],
  ["House of Commons Library", "https://commonslibrary.parliament.uk", "Policy & data", "https://commonslibrary.parliament.uk/feed/"],
  ["Regulator of Social Housing", "https://www.gov.uk/government/organisations/regulator-of-social-housing", "Regulator", "https://www.gov.uk/government/organisations/regulator-of-social-housing.atom"],

  // ---- UK trade, planning and property press (verified; competitors labelled) ----
  ["Housing Today", "https://www.housingtoday.co.uk", "Trade press (competitor)", "https://www.housingtoday.co.uk/5054.rss"],
  ["Inside Housing", "https://www.insidehousing.co.uk", "Trade press (competitor)", "https://www.insidehousing.co.uk/Syndication/DF.cfm?f=6&ft=10"],
  ["Urban Living News: later living", "https://urbanliving.news/category/later-living/", "Trade press (competitor)", "https://urbanliving.news/category/later-living/feed/"],
  ["HealthInvestor UK", "https://www.healthinvestor.co.uk", "Trade press (competitor, front-door filter)", "https://www.healthinvestor.co.uk/feed/"],
  ["Caring Times", "https://caring-times.co.uk", "Care press (competitor, front-door filter)", "https://caring-times.co.uk/feed/"],
  ["Planning Resource", "https://www.planningresource.co.uk", "Planning press", "https://www.planningresource.co.uk/rss/news"],
  ["The Architects' Journal", "https://www.architectsjournal.co.uk", "Design press", "https://www.architectsjournal.co.uk/feed"],
  ["Show House", "https://www.showhouse.co.uk", "Housebuilding press", "https://www.showhouse.co.uk/feed/"],
  ["Local Government Lawyer: planning", "https://www.localgovernmentlawyer.co.uk/planning", "Planning press", "https://www.localgovernmentlawyer.co.uk/planning?format=feed&type=rss"],
  ["Property Investor Today", "https://www.propertyinvestortoday.co.uk", "Property & capital press", "https://www.propertyinvestortoday.co.uk/rss"],
  ["Bisnow London", "https://www.bisnow.com/london", "Property & capital press", "https://www.bisnow.com/rss/london"],
  ["Construction Enquirer", "https://www.constructionenquirer.com", "Construction press", "https://www.constructionenquirer.com/feed/"],

  // ---- UK advisers and operators (verified feeds) ----
  ["Carterwood", "https://www.carterwood.co.uk", "Adviser", "https://www.carterwood.co.uk/feed/"],
  ["Pozzoni Architects", "https://www.pozzoni.co.uk", "Architect", "https://www.pozzoni.co.uk/feed.rss"],
  ["Cornerstone Barristers", "https://cornerstonebarristers.com", "Adviser", "https://cornerstonebarristers.com/feed/"],
  ["ExtraCare Charitable Trust", "https://www.extracare.org.uk/news/", "Operator", "https://www.extracare.org.uk/news/feed/"],
  ["Rangeford Villages", "https://www.rangefordvillages.co.uk", "Operator", "https://www.rangefordvillages.co.uk/feed/"],

  // ---- Australia (verified feeds) ----
  ["The Weekly Source", "https://theweeklysource.com.au", "Trade press (competitor)", "https://theweeklysource.com.au/feed/"],
  ["Property Council of Australia", "https://www.propertycouncil.com.au", "Trade body", "https://www.propertycouncil.com.au/feed"],
  ["Real Estate Source", "https://www.realestatesource.com.au", "Property & capital press", "https://www.realestatesource.com.au/feed/"],
  ["RetireAustralia", "https://www.retireaustralia.com.au", "Operator", "https://www.retireaustralia.com.au/feed/"],
  ["Australian Ageing Agenda", "https://www.australianageingagenda.com.au", "Care press (competitor, front-door filter)", "https://www.australianageingagenda.com.au/feed/"],
  ["Aged Care Insite", "https://www.agedcareinsite.com.au", "Care press (competitor, front-door filter)", "https://www.agedcareinsite.com.au/feed/"],
  ["Consumer Affairs Victoria", "https://www.consumer.vic.gov.au", "Regulator", "https://www.consumer.vic.gov.au/rss"],

  // ---- New Zealand (verified feeds; no NZ trade title exists) ----
  ["Beehive (NZ Government)", "https://www.beehive.govt.nz", "Regulator", "https://www.beehive.govt.nz/rss.xml"],
  ["RNZ business", "https://www.rnz.co.nz/news/business", "Business press", "https://www.rnz.co.nz/rss/business.xml"],
  ["NZ Herald business", "https://www.nzherald.co.nz/business/", "Business press", "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml"],
  ["Stuff business", "https://www.stuff.co.nz/business", "Business press", "https://www.stuff.co.nz/rss/business"],
  ["interest.co.nz", "https://www.interest.co.nz", "Business press", "https://www.interest.co.nz/rss"],
  ["BusinessDesk", "https://businessdesk.co.nz", "Business press", "https://businessdesk.co.nz/feed"],
  ["Newsroom", "https://newsroom.co.nz", "Business press", "https://newsroom.co.nz/feed/"],
  ["Property Council New Zealand", "https://www.propertynz.co.nz", "Trade body", "https://www.propertynz.co.nz/feed"],

  // ---- US: capital markets and benchmarks only (verified feeds) ----
  ["Senior Housing News", "https://seniorhousingnews.com", "Trade press (competitor)", "https://seniorhousingnews.com/feed/"],
  ["Seniors Housing Business: finance", "https://seniorshousingbusiness.com/category/finance/", "Trade press (competitor)", "https://seniorshousingbusiness.com/category/finance/feed/"],
  ["NIC MAP", "https://www.nicmap.com", "Data & analytics", "https://www.nicmap.com/feed/"],
  ["Irving Levin Associates", "https://www.levinassociates.com", "Capital markets data", "https://www.levinassociates.com/feed/"],
  ["Argentum", "https://www.argentum.org", "Trade body", "https://www.argentum.org/feed/"],

  // ---- No feed, but load-bearing: hub-only + newsrooms.js/outreach targets ----
  ["ARCO", "https://www.arcouk.org/news", "Trade body"],
  ["Housing LIN", "https://www.housinglin.org.uk/News/", "Trade body"],
  ["Knight Frank research", "https://www.knightfrank.co.uk/research", "Data & analytics"],
  ["Savills research", "https://www.savills.co.uk/research_articles/", "Data & analytics"],
  ["Law Commission", "https://lawcom.gov.uk/", "Regulator"],
  ["McCarthy Stone", "https://www.mccarthyandstone.co.uk/news/", "Operator"],
  ["Audley Group", "https://www.audleyvillages.co.uk/news", "Operator"],
  ["Inspired Villages", "https://www.inspiredvillages.co.uk/news", "Operator"],
  ["Anchor", "https://www.anchor.org.uk/news", "Operator"],
  ["Housing 21", "https://www.housing21.org.uk/news/", "Operator"],
  ["Churchill Retirement Living", "https://www.churchillretirement.co.uk/news", "Operator"],
  ["Beechcroft", "https://www.beechcroft.co.uk/news", "Operator"],
  ["Birchgrove", "https://www.birchgrove.co.uk/news/", "Operator"],
  ["Retirement Villages Group", "https://www.retirementvillages.co.uk", "Operator"],
  ["Legal & General newsroom", "https://group.legalandgeneral.com/en/newsroom", "Investor"],
  ["Lichfields", "https://lichfields.uk/blog/", "Adviser"],
  ["Trowers & Hamlins", "https://www.trowers.com/insights", "Adviser"],
  ["Pinsent Masons Out-Law", "https://www.pinsentmasons.com/out-law", "Adviser"],
  ["HCR Law", "https://www.hcrlaw.com/news/", "Adviser"],
  ["Care Home Professional", "https://www.carehomeprofessional.com", "Care press (competitor, front-door filter)"],
  ["Property Week", "https://www.propertyweek.com", "Trade press (competitor)"],
  ["Retirement Villages Association NZ", "https://www.retirementvillages.org.nz/", "Trade body"],
  ["Retirement Commission NZ", "https://retirement.govt.nz/", "Regulator"],
  ["Ryman Healthcare", "https://www.rymanhealthcare.co.nz", "Operator"],
  ["Summerset", "https://www.summerset.co.nz", "Operator"],
  ["Oceania Healthcare", "https://www.oceaniahealthcare.co.nz", "Operator"],
  ["Arvida", "https://www.arvida.co.nz", "Operator"],
  ["Metlifecare", "https://www.metlifecare.co.nz", "Operator"],
  ["Aveo", "https://www.aveo.com.au", "Operator"],
  ["Stockland", "https://www.stockland.com.au", "Operator"],
  ["Ingenia Communities", "https://www.ingeniacommunities.com.au", "Operator"],
  ["GemLife", "https://www.gemlife.com.au", "Operator"],
  ["Lifestyle Communities", "https://www.lifestylecommunities.com.au", "Operator"],
  ["McKnight's Senior Living", "https://www.mcknightsseniorliving.com", "Trade press (competitor)"],
  ["Welltower", "https://welltower.com", "Investor"],
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
          newsHubUrl: website,
          // feedStatus is deliberately left null even for verified feeds. It is
          // the scan cron's field to own, and writing "ok" here would assert an
          // in-app state nothing has actually confirmed yet.
          feedUrl: feedUrl || null,
          notes: feedUrl
            ? "Seeded from scripts/seed-senior-lifestyle-business-sources.mjs. Feed verified by hand 18 Sep 2026 (docs/senior-lifestyle-business-sources.md)."
            : "Seeded from scripts/seed-senior-lifestyle-business-sources.mjs. No working feed found 18 Sep 2026; hub autodiscovery + newsrooms.js/outreach candidate.",
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
