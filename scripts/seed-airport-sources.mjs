// Seed Airport Business Magazine's newswire with direct feeds, trade bodies
// and the supplier map from the title #5 business case.
//
// Same structure as seed-barbering-sources.mjs, same lesson behind it: a
// Google News query is not a source, direct feeds return real articles, and
// the launch target is 30+ verified feeds. Every URL in the verified section
// below returned valid RSS/Atom with recent items when fetched on 24 Aug 2026
// (docs/airport-business-sources.md holds the verification record with
// newest-item dates and the ingester quirks).
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them (all probed
// 24 Aug 2026): International Airport Review moved off WordPress and its feed
// 404s; Heathrow, Gatwick, MAG and Schiphol media centres are PressPage sites
// with no RSS; SITA, Smiths Detection, Swissport, Fraport, ICAO, Groupe ADP,
// Amadeus, Aena, Changi and PANYNJ have none either. Those are the
// lib/newsrooms.js candidates — the fleet lesson says they are the four most
// valuable sources on the list wearing the least convenient clothes. Cirium
// and BEUMER have VALID BUT EMPTY feeds (custom post types): the "empty is
// not working" trap, seeded hub-only so autodiscovery does not re-find the
// empty channel and call it ok.
//
// COMPETITOR-FLAGGED SOURCES: the trade press rows marked "(competitor)" are
// monitoring sources — they tell the Researcher what the incumbents have
// covered; they are not outreach targets and their copy is never a source to
// rewrite without the underlying primary source. Simple Flying is flagged
// consumer: it exists here so the Researcher can see what the enthusiast press
// is chasing, never as a source of our stories.
//
//   node scripts/seed-airport-sources.mjs --site=airport-business-magazine [--dry-run]
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
// A fourth element means the feed was verified by hand on 24 Aug 2026 and goes
// straight in. Three elements means hub-only: lib/feeds.js autodiscovers, and
// if it finds nothing the row still earns its place as an outreach target or a
// lib/newsrooms.js candidate (see docs/airport-business-sources.md).
const SOURCES = [
  // ---- Policy, trade bodies, regulators and data (verified feeds) ----
  ["ACI World", "https://aci.aero", "Trade body", "https://aci.aero/feed/"],
  ["ACI World Insights", "https://blog.aci.aero", "Trade body & data", "https://blog.aci.aero/feed/"],
  ["ACI Europe", "https://www.aci-europe.org", "Trade body", "https://www.aci-europe.org/media-room.html?format=feed&type=rss"],
  ["ACI-NA", "https://airportscouncil.org", "Trade body", "https://airportscouncil.org/feed/"],
  ["AirportsUK", "https://airportsuk.org", "Trade body", "https://airportsuk.org/feed/"],
  ["IATA pressroom", "https://www.iata.org", "Trade body & data", "https://www.iata.org/api/rss/pressrelease"],
  ["EASA", "https://www.easa.europa.eu", "Regulator", "https://www.easa.europa.eu/en/newsroom-and-events/news/feed.xml"],
  ["CANSO", "https://canso.org", "Trade body", "https://canso.org/feed/"],
  ["FAA newsroom", "https://www.faa.gov", "Regulator", "https://www.faa.gov/rss.xml"],
  ["US DOT", "https://www.transportation.gov", "Regulator", "https://www.transportation.gov/rss.xml"],
  ["UK Dept for Transport", "https://www.gov.uk/government/organisations/department-for-transport", "Regulator", "https://www.gov.uk/government/organisations/department-for-transport.atom"],
  ["UK CAA (gov.uk)", "https://www.gov.uk/government/organisations/civil-aviation-authority", "Regulator", "https://www.gov.uk/government/organisations/civil-aviation-authority.atom"],
  ["gov.uk wire: airport", "https://www.gov.uk/search/news-and-communications?keywords=airport", "Regulator", "https://www.gov.uk/search/news-and-communications.atom?keywords=airport"],
  ["gov.uk wire: aviation", "https://www.gov.uk/search/news-and-communications?keywords=aviation", "Regulator", "https://www.gov.uk/search/news-and-communications.atom?keywords=aviation"],
  ["OAG", "https://www.oag.com", "Data & analytics", "https://www.oag.com/blog/rss.xml"],
  ["Skytrax World Airport Awards", "https://www.worldairportawards.com", "Data & analytics", "https://www.worldairportawards.com/feed/"],

  // ---- Trade and construction press (verified feeds; competitors labelled) ----
  ["Passenger Terminal Today", "https://www.passengerterminaltoday.com", "Trade press (competitor)", "https://www.passengerterminaltoday.com/feed"],
  ["Airport Technology", "https://www.airport-technology.com", "Trade press (competitor)", "https://www.airport-technology.com/feed/"],
  ["Airport Industry-News", "https://airportindustry-news.com", "Trade press (competitor)", "https://airportindustry-news.com/feed/"],
  ["Airport World", "https://airport-world.com", "Trade press (competitor)", "https://airport-world.com/feed/"],
  ["Airport Improvement", "https://airportimprovement.com", "Trade press (competitor)", "https://airportimprovement.com/feed/"],
  ["AviationPros", "https://www.aviationpros.com", "Trade press (competitor)", "https://www.aviationpros.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D"],
  ["Future Travel Experience", "https://www.futuretravelexperience.com", "Trade press (competitor)", "https://www.futuretravelexperience.com/feed/"],
  ["Regional Gateway", "https://www.regionalgateway.net", "Trade press (competitor)", "https://www.regionalgateway.net/feed/"],
  ["Moodie Davitt Report", "https://moodiedavittreport.com", "Travel retail press (competitor)", "https://moodiedavittreport.com/feed/"],
  ["TRBusiness", "https://www.trbusiness.com", "Travel retail press (competitor)", "https://www.trbusiness.com/feed"],
  ["DFNI", "https://www.dfnionline.com", "Travel retail press (competitor)", "https://www.dfnionline.com/feed/"],
  ["Simple Flying", "https://simpleflying.com", "Consumer press (monitoring only)", "https://simpleflying.com/feed/"],
  ["Global Construction Review", "https://www.globalconstructionreview.com", "Construction press", "https://www.globalconstructionreview.com/feed/"],
  ["New Civil Engineer", "https://www.newcivilengineer.com", "Construction press", "https://www.newcivilengineer.com/feed/"],
  ["Construction Enquirer", "https://www.constructionenquirer.com", "Construction press", "https://www.constructionenquirer.com/feed/"],
  ["ENR", "https://www.enr.com", "Construction press", "https://www.enr.com/rss/articles"],
  ["Construction Review Online", "https://constructionreviewonline.com", "Construction press", "https://constructionreviewonline.com/feed/"],
  ["World Construction Network", "https://www.worldconstructionnetwork.com", "Construction press", "https://www.worldconstructionnetwork.com/feed/"],

  // ---- Supplier brand newsrooms (verified feeds) ----
  ["Vanderlande", "https://www.vanderlande.com", "Baggage handling", "https://www.vanderlande.com/feed/?post_type=news"],
  ["Alstef Group", "https://alstefgroup.com", "Baggage handling", "https://alstefgroup.com/feed/"],
  ["Daifuku", "https://www.daifuku.com", "Baggage handling", "https://www.daifuku.com/rss_all.xml"],
  ["Idemia", "https://www.idemia.com", "Biometrics & security", "https://www.idemia.com/feed"],
  ["Leidos", "https://www.leidos.com", "Biometrics & security", "https://www.leidos.com/rss.xml"],
  ["Menzies Aviation", "https://menziesaviation.com", "Ground handling", "https://menziesaviation.com/feed/"],
  ["WFS", "https://www.wfs.aero", "Ground handling", "https://www.wfs.aero/feed/"],
  ["TLD Group", "https://www.tld-group.com", "Ground support equipment", "https://www.tld-group.com/feed/"],
  ["Veovo", "https://veovo.com", "Airport IT & software", "https://veovo.com/feed"],

  // ---- Airports and operators (verified feeds) ----
  ["daa / Dublin Airport", "https://www.daa.ie", "Airports & operators", "https://www.daa.ie/feed/"],
  ["VINCI Airports", "https://vinci-airports.com", "Airports & operators", "https://vinci-airports.com/en/feed/"],
  ["Kansai Airports", "https://www.kansai-airports.co.jp", "Airports & operators", "https://www.kansai-airports.co.jp/en/news/feed/"],
  ["Brisbane Airport", "https://newsroom.bne.com.au", "Airports & operators", "https://newsroom.bne.com.au/feed/"],
  ["Port of Seattle", "https://www.portseattle.org", "Airports & operators", "https://www.portseattle.org/rss.xml"],

  // ---- No feed, but load-bearing: hub-only + newsrooms.js/outreach targets ----
  // The sector's most valuable press offices publish no feeds at all (fleet
  // lesson). Autodiscovery gets a second chance at them, lib/newsrooms.js is
  // the real answer for the top block, and every row doubles as a prospect.
  ["International Airport Review", "https://www.internationalairportreview.com/news", "Trade press (competitor)"],
  ["Heathrow media centre", "https://mediacentre.heathrow.com/news", "Airports & operators"],
  ["Royal Schiphol Group", "https://news.schiphol.com", "Airports & operators"],
  ["MAG media centre", "https://mediacentre.manchesterairport.co.uk", "Airports & operators"],
  ["Gatwick media centre", "https://mediacentre.gatwickairport.com", "Airports & operators"],
  ["Fraport", "https://www.fraport.com/en/newsroom/press-releases.html", "Airports & operators"],
  ["Aena", "https://www.aena.es/en/", "Airports & operators"],
  ["Groupe ADP", "https://presse.groupeadp.fr", "Airports & operators"],
  ["Changi Airport Group", "https://www.changiairport.com/corporate/media-centre/newsroom.html", "Airports & operators"],
  ["Port Authority NY & NJ", "https://www.panynj.gov/port-authority/en/press-room.html", "Airports & operators"],
  ["ICAO", "https://www.icao.int/newsroom", "Regulator"],
  ["Eurocontrol", "https://www.eurocontrol.int/news", "Regulator"],
  ["SITA", "https://www.sita.aero/pressroom/", "Airport IT & software"],
  ["Amadeus", "https://amadeus.com/en/newsroom", "Airport IT & software"],
  ["Smiths Detection", "https://www.smithsdetection.com/press-releases/", "Biometrics & security"],
  ["Swissport", "https://www.swissport.com/en/news/current-news", "Ground handling"],
  ["Cirium", "https://www.cirium.com/thoughtcloud/", "Data & analytics"],
  ["BEUMER Group", "https://www.beumergroup.com/news/", "Baggage handling"],
  ["ADB Safegate", "https://adbsafegate.com", "Airfield systems"],
  ["Thales", "https://www.thalesgroup.com", "ATC & security"],
  ["Frequentis", "https://www.frequentis.com", "ATC & security"],
  ["Indra", "https://www.indracompany.com", "ATC & security"],
  ["Leonardo", "https://www.leonardo.com", "Baggage handling"],
  ["Oshkosh AeroTech", "https://www.oshkoshaerotech.com", "Ground support equipment"],
  ["dnata", "https://www.dnata.com", "Ground handling"],
  ["JCDecaux", "https://www.jcdecaux.com", "Advertising concessions"],
  ["Avolta", "https://www.avoltaworld.com", "Retail & concessions"],
  ["Lagardère Travel Retail", "https://www.lagardere-tr.com", "Retail & concessions"],
  ["SSP Group", "https://www.foodtravelexperts.com", "Retail & concessions"],
  ["SKIDATA", "https://www.skidata.com", "Parking & access"],
  ["KONE", "https://www.kone.com", "Vertical transport"],
  ["TK Elevator", "https://www.tkelevator.com", "Vertical transport"],
  ["Xovis", "https://www.xovis.com", "Airport IT & software"],
  ["Assaia", "https://assaia.com", "Airport IT & software"],
  ["Materna IPS", "https://www.materna-ips.com", "Biometrics & security"],
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
          // invisible to the rotation and never gets scanned even once. Where
          // the press hub is a specific page (PressPage sites, pressroom
          // paths), that URL is stored so a future lib/newsrooms.js entry can
          // key off its host without re-research.
          newsHubUrl: website,
          // feedStatus is deliberately left null even for verified feeds. It is
          // the scan cron's field to own, and writing "ok" here would assert an
          // in-app state nothing has actually confirmed yet.
          feedUrl: feedUrl || null,
          notes: feedUrl
            ? "Seeded from scripts/seed-airport-sources.mjs. Feed verified by hand 24 Aug 2026 (docs/airport-business-sources.md)."
            : "Seeded from scripts/seed-airport-sources.mjs (title #5 supplier map). No feed found 24 Aug 2026; hub autodiscovery + newsrooms.js/outreach candidate.",
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
