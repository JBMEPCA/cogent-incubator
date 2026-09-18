// Seed Smart Farming News's newswire with direct feeds, public bodies and the
// advertiser map from docs/vertical-brief-farming.md.
//
// Same structure as seed-barbering-sources.mjs, same lesson behind it: a Google
// News query is not a source, direct feeds return real articles, and the
// launch target is 30+ verified feeds. Every URL in the feed sections below
// returned valid RSS/Atom with items when fetched on 18 Sep 2026
// (docs/smart-farming-news-sources.md holds the verification record with item
// counts, newest-item dates and body length).
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them (all probed
// 18 Sep 2026): Farmers Weekly, Farmers Guardian and FarmingUK publish no feed
// at any of the usual paths. The NFU, the CLA, the Soil Association, NFFN,
// Harper Adams, Savills, Strutt & Parker, Carter Jonas, Knight Frank, Stags,
// Cheffins, Thrings, Oxbury, NFU Mutual, Canopy & Stars and the Farm Business
// Innovation Show: no feeds. Solar Energy UK, the CAAV, FARMA, BHHPA,
// Renews, Environmental Finance and The Robot Report 403 a script. UKRI's
// root /feed/, UK Agri-Tech Centre and NIAB return empty feeds; Current± and
// Solar Power Portal return HTML. Rothamsted (2022), NAAC (2022), Herdwatch
// (Jan 2026), Defra's press office blog (Jan 2026), Environment Bank and CPRE
// are stale. These are hub-only rows below: lib/feeds.js autodiscovery may
// find what hand-probing missed, and every one earns its place as an outreach
// or advertiser target regardless.
//
// COMPETITOR-FLAGGED SOURCES: the sector press rows marked "(competitor)" are
// monitoring sources. They tell the Researcher what the incumbents have
// covered; they are not outreach targets, and their copy is never a source to
// rewrite without the underlying primary source.
//
//   node scripts/seed-smart-farming-news-sources.mjs --site=smart-farming-news [--dry-run]
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
// if it finds nothing the row still earns its place as an outreach target.
const SOURCES = [
  // ---- Government, regulators and Parliament (verified feeds) ----
  ["Defra", "https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs", "Policy & regulation", "https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs.atom"],
  ["Rural Payments Agency", "https://www.gov.uk/government/organisations/rural-payments-agency", "Policy & regulation", "https://www.gov.uk/government/organisations/rural-payments-agency.atom"],
  ["Natural England", "https://www.gov.uk/government/organisations/natural-england", "Natural capital", "https://www.gov.uk/government/organisations/natural-england.atom"],
  ["Environment Agency", "https://www.gov.uk/government/organisations/environment-agency", "Policy & regulation", "https://www.gov.uk/government/organisations/environment-agency.atom"],
  ["Forestry Commission", "https://www.gov.uk/government/organisations/forestry-commission", "Natural capital", "https://www.gov.uk/government/organisations/forestry-commission.atom"],
  // HMRC's organisation feed is mostly forms and guidance for every sector;
  // scoped to "agricultural" it carries APR, red diesel and farming guidance.
  ["HMRC (agricultural)", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Tax & succession", "https://www.gov.uk/search/all.atom?organisations%5B%5D=hm-revenue-customs&keywords=agricultural"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Tax & succession", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Dept for Energy Security & Net Zero", "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero", "Energy & land use", "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom"],
  ["Ofgem", "https://www.ofgem.gov.uk", "Energy & land use", "https://www.ofgem.gov.uk/rss.xml"],
  ["NESO", "https://www.neso.energy", "Energy & land use", "https://www.neso.energy/rss.xml"],
  ["Great British Energy", "https://www.gov.uk/government/organisations/great-british-energy", "Energy & land use", "https://www.gov.uk/government/organisations/great-british-energy.atom"],
  ["Innovate UK", "https://www.gov.uk/government/organisations/innovate-uk", "Agtech & innovation", "https://www.gov.uk/government/organisations/innovate-uk.atom"],
  ["MHCLG", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government", "Planning", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Tax & succession", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["Defra Farming blog", "https://defrafarming.blog.gov.uk", "Policy & regulation", "https://defrafarming.blog.gov.uk/feed/"],
  ["Rural Payments blog", "https://ruralpayments.blog.gov.uk", "Policy & regulation", "https://ruralpayments.blog.gov.uk/feed/"],
  ["Natural England blog", "https://naturalengland.blog.gov.uk", "Natural capital", "https://naturalengland.blog.gov.uk/feed/"],
  ["House of Commons Library", "https://commonslibrary.parliament.uk", "Tax & succession", "https://commonslibrary.parliament.uk/feed/"],
  ["UKRI", "https://www.ukri.org", "Agtech & innovation", "https://www.ukri.org/news/feed/"],

  // ---- Levy bodies, trade bodies, research and networks (verified feeds) ----
  ["AHDB", "https://ahdb.org.uk", "Levy body & data", "https://ahdb.org.uk/rss"],
  ["Tenant Farmers Association", "https://www.tfa.org.uk", "Trade body", "https://www.tfa.org.uk/feed/"],
  ["Agricultural Engineers Association", "https://aea.uk.com", "Trade body", "https://aea.uk.com/feed/"],
  ["Agri-TechE", "https://www.agri-tech-e.co.uk", "Agtech & innovation", "https://www.agri-tech-e.co.uk/feed/"],
  ["Innovate UK Business Connect", "https://iuk-business-connect.org.uk", "Agtech & innovation", "https://iuk-business-connect.org.uk/feed/"],
  ["Farm491", "https://www.farm491.com", "Agtech & innovation", "https://www.farm491.com/feed/"],
  ["Royal Agricultural University", "https://www.rau.ac.uk", "Research & education", "https://www.rau.ac.uk/rss.xml"],
  ["Farm Carbon Toolkit", "https://farmcarbontoolkit.org.uk", "Natural capital", "https://farmcarbontoolkit.org.uk/feed/"],
  ["PASC UK (self-catering association)", "https://www.pascuk.co.uk", "Diversification", "https://www.pascuk.co.uk/feed/"],

  // ---- Energy, planning and land-use press (verified feeds) ----
  ["Energy-Storage.News", "https://www.energy-storage.news", "Energy & land use", "https://www.energy-storage.news/feed/"],
  ["PV Tech", "https://www.pv-tech.org", "Energy & land use", "https://www.pv-tech.org/feed/"],
  ["pv magazine", "https://www.pv-magazine.com", "Energy & land use", "https://www.pv-magazine.com/feed/"],
  ["Planning Resource", "https://www.planningresource.co.uk", "Planning", "https://www.planningresource.co.uk/rss/news"],
  ["edie", "https://www.edie.net", "Energy & land use", "https://www.edie.net/feed/"],
  ["Energy Live News", "https://www.energylivenews.com", "Energy & land use", "https://www.energylivenews.com/feed/"],
  ["Glamping Business", "https://glampingbusiness.com", "Diversification", "https://glampingbusiness.com/feed/"],
  ["Lightsource bp UK", "https://www.lightsourcebp.com/uk", "Energy developers", "https://www.lightsourcebp.com/uk/feed/"],

  // ---- Agtech, investment and finance press (verified feeds) ----
  ["AgFunderNews", "https://agfundernews.com", "Agtech & investment", "https://agfundernews.com/feed"],
  ["Global AgTech Initiative", "https://www.globalagtechinitiative.com", "Agtech & investment", "https://www.globalagtechinitiative.com/feed/"],
  ["Agri Investor", "https://www.agriinvestor.com", "Agtech & investment", "https://www.agriinvestor.com/feed/"],

  // ---- Sector press (verified feeds; competitors labelled) ----
  ["Future Farming", "https://www.futurefarming.com", "Sector press (competitor)", "https://www.futurefarming.com/rss"],
  ["Farmers Guide", "https://www.farmersguide.co.uk", "Sector press (competitor)", "https://www.farmersguide.co.uk/feed/"],
  ["Agriland UK", "https://www.agriland.co.uk", "Sector press (competitor)", "https://www.agriland.co.uk/feed/"],
  ["The Scottish Farmer", "https://www.thescottishfarmer.co.uk", "Sector press (competitor)", "https://www.thescottishfarmer.co.uk/news/rss/"],
  ["Profi", "https://www.profi.co.uk", "Sector press (competitor)", "https://www.profi.co.uk/feed/"],
  ["Farm Contractor and Large Scale Farmer", "https://www.farmcontractormagazine.com", "Sector press (competitor)", "https://www.farmcontractormagazine.com/feed/"],

  // ---- National press farming desks (verified feeds) ----
  ["The Guardian: farming", "https://www.theguardian.com/environment/farming", "National press", "https://www.theguardian.com/environment/farming/rss"],
  ["Financial Times: agriculture", "https://www.ft.com/agriculture", "National press", "https://www.ft.com/agriculture?format=rss"],

  // ---- Suppliers and advisers with feeds (verified) ----
  ["Hutchinsons", "https://www.hutchinsons.co.uk", "Agronomy & inputs", "https://www.hutchinsons.co.uk/feed/"],
  ["Berrys", "https://www.berrys.uk.com", "Land agents", "https://www.berrys.uk.com/feed/"],

  // ---- No feed, but load-bearing: hub-only + outreach/advertiser targets ----
  ["NFU", "https://www.nfuonline.com", "Trade body"],
  ["CLA", "https://www.cla.org.uk", "Trade body"],
  ["Soil Association", "https://www.soilassociation.org", "Trade body"],
  ["Nature Friendly Farming Network", "https://www.nffn.org.uk", "Trade body"],
  ["CAAV", "https://www.caav.org.uk", "Land agents"],
  ["NAAC", "https://www.naac.co.uk", "Trade body"],
  ["FARMA", "https://farma.org.uk", "Diversification"],
  ["UK Agri-Tech Centre", "https://ukagritechcentre.com", "Agtech & innovation"],
  ["Harper Adams University", "https://www.harper-adams.ac.uk", "Research & education"],
  ["NIAB", "https://www.niab.com", "Research & education"],
  ["Rothamsted Research", "https://www.rothamsted.ac.uk", "Research & education"],
  ["Solar Energy UK", "https://solarenergyuk.org", "Energy & land use"],
  ["RenewableUK", "https://www.renewableuk.com", "Energy & land use"],
  ["Regen", "https://www.regen.co.uk", "Energy & land use"],
  ["Current±", "https://www.current-news.co.uk", "Energy & land use"],
  ["Solar Power Portal", "https://www.solarpowerportal.co.uk", "Energy & land use"],
  ["Community Energy England", "https://communityenergyengland.org", "Energy & land use"],
  ["Anesco", "https://www.anesco.co.uk", "Energy developers"],
  ["Island Green Power", "https://islandgreenpower.com", "Energy developers"],
  ["Low Carbon", "https://www.lowcarbon.com", "Energy developers"],
  ["Environment Bank", "https://environmentbank.com", "Natural capital"],
  ["Nattergal", "https://nattergal.co.uk", "Natural capital"],
  ["Environmental Farmers Group", "https://www.efg.earth", "Natural capital"],
  ["LandBNG", "https://www.landbng.co.uk", "Natural capital"],
  ["Woodland Carbon Code", "https://woodlandcarboncode.org.uk", "Natural capital"],
  ["Savills (rural)", "https://www.savills.co.uk", "Land agents"],
  ["Strutt & Parker", "https://www.struttandparker.com", "Land agents"],
  ["Carter Jonas", "https://www.carterjonas.co.uk", "Land agents"],
  ["Knight Frank (rural)", "https://www.knightfrank.co.uk", "Land agents"],
  ["Stags", "https://www.stags.co.uk", "Land agents"],
  ["Cheffins", "https://www.cheffins.co.uk", "Land agents"],
  ["Brown & Co", "https://www.brown-co.com", "Land agents"],
  ["Thrings", "https://www.thrings.com", "Rural solicitors & accountants"],
  ["Roythornes", "https://www.roythornes.co.uk", "Rural solicitors & accountants"],
  ["Wilsons", "https://www.wilsonslaw.com", "Rural solicitors & accountants"],
  ["Albert Goodman", "https://www.albertgoodman.co.uk", "Rural solicitors & accountants"],
  ["NFU Mutual", "https://www.nfumutual.co.uk", "Insurance"],
  ["Oxbury Bank", "https://www.oxbury.com", "Banks & lenders"],
  ["AMC (Agricultural Mortgage Corporation)", "https://www.amconline.co.uk", "Banks & lenders"],
  ["Herdwatch", "https://www.herdwatch.com", "Farm software"],
  ["Gatekeeper (Proagrica)", "https://www.gatekeeper.co.uk", "Farm software"],
  ["Breedr", "https://www.breedr.co", "Farm software"],
  ["SOYL", "https://www.soyl.com", "Precision farming"],
  ["Hands Free Farm", "https://www.handsfree.farm", "Agtech & innovation"],
  ["Canopy & Stars", "https://www.canopyandstars.co.uk", "Diversification"],
  ["Farm Stay UK", "https://www.farmstayuk.co.uk", "Diversification"],
  ["Farmers Weekly", "https://www.fwi.co.uk", "Sector press (competitor)"],
  ["Farmers Guardian", "https://www.farmersguardian.com", "Sector press (competitor)"],
  ["FarmingUK", "https://www.farminguk.com", "Sector press (competitor)"],
  ["Farm Diversity", "https://www.farmdiversity.co.uk", "Sector press (competitor)"],
  ["Farm Business Innovation Show", "https://www.farmbusinessshow.co.uk", "Events"],
  ["LAMMA", "https://www.lammashow.com", "Events"],
  ["Cereals", "https://www.cerealsevent.co.uk", "Events"],
  ["Groundswell", "https://www.groundswellag.com", "Events"],
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
            ? "Seeded from scripts/seed-smart-farming-news-sources.mjs. Feed verified by hand 18 Sep 2026 (docs/smart-farming-news-sources.md)."
            : "Seeded from scripts/seed-smart-farming-news-sources.mjs (farming brief advertiser map). No feed found 18 Sep 2026; hub autodiscovery + outreach target.",
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
