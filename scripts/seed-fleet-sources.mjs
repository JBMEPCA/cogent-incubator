// Seed The Fleet Magazine's newswire with company newsrooms and trade bodies.
//
// The twelve standing Google News searches in lib/news-searches.js are the
// highest-yield leg of the supply, but they are one leg: if Google changes
// anything the wire goes quiet. Company hubs are the slower, steadier leg, and
// they carry something the searches do not — a named company with a press
// office, which is who the Backlink Manager can actually approach.
//
// The list is the advertiser map from the title #2 business case: the sectors
// that demonstrably spend money in UK fleet, led by the twenty-five companies
// that sponsored a 2026 Fleet News Award. Every one of them is both a source of
// news and a prospective advertiser.
//
//   node scripts/seed-fleet-sources.mjs --site=fleet-magazine [--dry-run]
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

// [name, website, category]. newsHubUrl is derived from the origin: lib/feeds.js
// discovers /feed, /rss, /news/feed and friends off it, so a homepage is enough
// and a wrong guess fails soft rather than breaking the rotation.
const SOURCES = [
  // ---- Leasing, funding and fleet management ----
  ["Arval UK", "https://www.arval.co.uk", "Leasing & funding"],
  ["Ayvens UK", "https://www.ayvens.com", "Leasing & funding"],
  ["Lex Autolease", "https://lexautolease.co.uk", "Leasing & funding"],
  ["Alphabet GB", "https://www.alphabet.com", "Leasing & funding"],
  ["Zenith", "https://www.zenith.co.uk", "Leasing & funding"],
  ["Ogilvie Fleet", "https://www.ogilvie-fleet.co.uk", "Leasing & funding"],
  ["Novuna Vehicle Solutions", "https://www.novuna.co.uk", "Leasing & funding"],
  ["Grosvenor Leasing", "https://www.grosvenorleasing.co.uk", "Leasing & funding"],
  ["Tusker", "https://www.tuskercars.com", "Leasing & funding"],
  ["Fleet Alliance", "https://www.fleetalliance.co.uk", "Leasing & funding"],
  ["KINTO UK", "https://www.kinto-mobility.co.uk", "Leasing & funding"],
  ["Athlon UK", "https://www.athlon.com", "Leasing & funding"],

  // ---- Rental and flexible hire ----
  ["Northgate Vehicle Hire", "https://www.northgatevehiclehire.co.uk", "Rental & hire"],
  ["Enterprise Mobility UK", "https://www.enterprise.co.uk", "Rental & hire"],
  ["SIXT UK", "https://www.sixt.co.uk", "Rental & hire"],
  ["Europcar Mobility Group UK", "https://www.europcar.co.uk", "Rental & hire"],

  // ---- Telematics, tracking and fleet software ----
  ["Samsara", "https://www.samsara.com", "Telematics & technology"],
  ["Geotab", "https://www.geotab.com", "Telematics & technology"],
  ["Webfleet", "https://www.webfleet.com", "Telematics & technology"],
  ["Quartix", "https://www.quartix.com", "Telematics & technology"],
  ["Microlise", "https://www.microlise.com", "Telematics & technology"],
  ["Targa Telematics", "https://www.targatelematics.com", "Telematics & technology"],
  ["Lightfoot", "https://www.lightfoot.co.uk", "Telematics & technology"],
  ["Jaama", "https://www.jaama.co.uk", "Telematics & technology"],
  ["Chevin Fleet Solutions", "https://www.chevinfleet.com", "Telematics & technology"],
  ["FleetCheck", "https://www.fleetcheck.co.uk", "Telematics & technology"],
  ["MICHELIN Connected Fleet", "https://connectedfleet.michelin.com", "Telematics & technology"],
  ["Verizon Connect", "https://www.verizonconnect.com", "Telematics & technology"],

  // ---- Fuel cards, energy and payments ----
  ["Allstar Business Solutions", "https://www.allstarcard.co.uk", "Fuel & energy"],
  ["Radius", "https://www.radius.com", "Fuel & energy"],
  ["Shell Fleet Solutions UK", "https://www.shell.co.uk", "Fuel & energy"],

  // ---- EV charging and infrastructure ----
  ["Pod Point", "https://pod-point.com", "Electric & charging"],
  ["Octopus Electric Vehicles", "https://octopusev.com", "Electric & charging"],
  ["BP Pulse UK", "https://www.bppulse.co.uk", "Electric & charging"],
  ["InstaVolt", "https://instavolt.co.uk", "Electric & charging"],
  ["Osprey Charging", "https://ospreycharging.co.uk", "Electric & charging"],
  ["GRIDSERVE", "https://gridserve.com", "Electric & charging"],
  ["Mer UK", "https://uk.mer.eco", "Electric & charging"],
  ["Zapmap", "https://www.zap-map.com", "Electric & charging"],

  // ---- Vehicle manufacturers, fleet and commercial ----
  ["Ford Pro UK", "https://www.ford.co.uk", "Manufacturers"],
  ["Vauxhall", "https://www.vauxhall.co.uk", "Manufacturers"],
  ["Volkswagen Commercial Vehicles UK", "https://www.volkswagen-vans.co.uk", "Manufacturers"],
  ["Mercedes-Benz Vans UK", "https://www.mercedes-benz.co.uk", "Manufacturers"],
  ["Renault Trucks UK", "https://www.renault-trucks.co.uk", "Manufacturers"],
  ["DAF Trucks UK", "https://www.daf.co.uk", "Manufacturers"],
  ["Scania UK", "https://www.scania.com", "Manufacturers"],
  ["Volvo Trucks UK", "https://www.volvotrucks.co.uk", "Manufacturers"],
  ["Isuzu UK", "https://www.isuzu.co.uk", "Manufacturers"],
  ["Maxus UK", "https://www.maxusautomotive.co.uk", "Manufacturers"],
  ["Toyota GB Fleet", "https://www.toyota.co.uk", "Manufacturers"],
  ["Kia UK", "https://www.kia.com", "Manufacturers"],

  // ---- Accident management, glass, repair and remarketing ----
  ["Autoglass", "https://www.autoglass.co.uk", "Repair & remarketing"],
  ["Cox Automotive UK", "https://www.coxautoinc.eu", "Repair & remarketing"],
  ["Copart UK", "https://www.copart.co.uk", "Repair & remarketing"],
  ["sopp+sopp", "https://www.soppsopp.com", "Repair & remarketing"],
  ["Motorway", "https://motorway.co.uk", "Repair & remarketing"],

  // ---- Roadside and breakdown ----
  ["The AA", "https://www.theaa.com", "Roadside & breakdown"],
  ["RAC", "https://www.rac.co.uk", "Roadside & breakdown"],
  ["Green Flag", "https://www.greenflag.com", "Roadside & breakdown"],

  // ---- Risk, compliance and driver training ----
  ["DriveTech", "https://www.drivetech.co.uk", "Compliance & safety"],
  ["TTC Group", "https://www.ttc-uk.com", "Compliance & safety"],
  ["Licence Bureau", "https://licencebureau.co.uk", "Compliance & safety"],

  // ---- Trade bodies and industry ----
  ["BVRLA", "https://www.bvrla.co.uk", "Trade bodies"],
  ["Logistics UK", "https://logistics.org.uk", "Trade bodies"],
  ["Association of Fleet Professionals", "https://theafp.co.uk", "Trade bodies"],
  ["SMMT", "https://www.smmt.co.uk", "Trade bodies"],
  ["Road Haulage Association", "https://www.rha.uk.net", "Trade bodies"],
  ["Zemo Partnership", "https://www.zemo.org.uk", "Trade bodies"],

  // ---- Government and regulators ----
  ["DVSA", "https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency", "Government"],
  ["Department for Transport", "https://www.gov.uk/government/organisations/department-for-transport", "Government"],
  ["DVLA", "https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency", "Government"],
  ["Traffic Commissioners", "https://www.gov.uk/government/organisations/traffic-commissioners", "Government"],
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

  let created = 0, skipped = 0;
  for (const [name, website, category] of SOURCES) {
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
          notes: "Seeded from scripts/seed-fleet-sources.mjs (title #2 advertiser map).",
        },
      });
    }
    created++;
  }

  const total = await prisma.prBrand.count({ where: { siteId: site.id } });
  console.log(`${site.name}: ${created} created, ${skipped} already present`);
  console.log(`Total sources for this title: ${DRY ? total + " (before dry-run additions)" : total}`);
  if (DRY) console.log("\n--- DRY RUN, nothing written ---");
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
