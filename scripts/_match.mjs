import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { fetchCandidates } from "../lib/newsletter.js";

const ORDERS = {
  "smart-sme": [
    "Bank Rate held at 3.75", "Amazon Raises UK Minimum Pay", "Semrush Shares 16 AI Prompts",
    "Arran Turner", "Threads Posts Google", "9 Signs You", "HMRC Refreshes Tax Dispute",
    "Magentic raises", "Southern Electric Saves 30 Hours", "Remote Employee Monitoring",
  ],
  "fleet-magazine": [
    "Fuel Duty Freeze", "Zero Emission Van, Truck Grant", "Do Vans Need Tachographs",
    "Fuel Benefit Charge", "Loomis UK Adds VisionTrack", "Depot Charging Costs",
    "Stellantis Pro One", "HGV Leasing UK", "DVLA Driver Licence Checking", "Simon Turner",
  ],
  "golf-resort-magazine": [
    "Golf Resort Auctioned", "Pin Vision US Launch", "Rockliffe Reopens", "94 Years to Weather",
    "Toptracer Names COO", "Golf Simulator and Launch Monitor", "Baylands Golf Links",
    "Banquet and Event Booking", "Cabot Wilds", "gWest Golf Course Estate",
  ],
  "barbering-business": [
    "Barber Registration Bill", "Check-In Kiosks", "Gas Safety Rules", "Beard Fade Searches",
    "GDPR SMS Marketing", "Best Barber Chairs", "DfE Confirms L2/3 Funding",
    "Ingrown Hair Guide", "South West Fund", "Idle Chair Time",
  ],
  "airport-business-magazine": [
    "Stewart Wingate", "Largest-Ever F&B Tender", "Jeddah Prepares Six Contracts",
    "Schiphol Ground Handling", "EU SAF Supply", "Driver", "Mark Johnston Named Edinburgh",
    "LATAM Cargo Ecuador", "ACI World Runway Overrun", "WHSmith FY26 Profit",
  ],
};

const prisma = new PrismaClient();
const out = {};
for (const [slug, fragments] of Object.entries(ORDERS)) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
  const cands = await fetchCandidates(creds.wordpress, 40, site);
  const ids = [];
  console.log(`\n## ${slug}`);
  fragments.forEach((f, i) => {
    const hits = cands.filter((c) => c.title.toLowerCase().includes(f.toLowerCase()));
    if (hits.length !== 1) {
      console.log(`  ${i + 1}. !! "${f}" matched ${hits.length}: ${hits.map((h) => h.title.slice(0, 50)).join(" | ")}`);
      ids.push("");
      return;
    }
    ids.push(String(hits[0].id));
    console.log(`  ${i + 1}. ${String(hits[0].id).padStart(5)}  ${hits[0].title.slice(0, 66)}`);
  });
  out[slug] = ids.join(",");
}
console.log("\nPINS = " + JSON.stringify(out, null, 2));
await prisma.$disconnect();
