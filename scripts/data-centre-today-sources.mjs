// Seed Data Centre Today's newswire with the sources verified on 2026-11-17.
//
// Same structure and same lesson as every source seed before it: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in SOURCES below was fetched on
// 2026-11-17 and returned valid RSS or Atom with at least one item.
//
// 71 verified. DROPPED the gov.uk keyword search wire (news-and-communications.atom?keywords=data+centre): the gym seed learned that loose gov.uk keyword matching returns off-beat releases, and it is deliberately not seeded on any title. Construction and energy feeds are kept and are genuinely on-beat here, because power and build are this title's subject. CNI rule honoured: no site-security sources.
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them. Every one
// was probed on 2026-11-17 and has no usable feed. Most are advertiser or
// monitoring targets regardless, which is why they are listed rather than
// forgotten:
//   - techUK (the obvious sector body, no feed exists; partnership target)
//   - Data Centre Alliance (403)
//   - Vertiv, Eaton, ABB, Siemens, Cummins, Caterpillar, Rolls-Royce Power Systems, Johnson Controls, CommScope, Panduit, Rittal, Socomec, Daikin Applied, Stulz, Corning (all advertiser targets, no feed)
//   - VIRTUS, Ark, Pulsant, Node4, Proximity, Nscale, CyrusOne, Telehouse, Colt, Yondr, STACK, EdgeConneX, Aligned (UK/EMEA operators, watch newsrooms by hand)
//   - Vantage and QTS (feeds exist but return 0 items; retest in a month)
//   - NESO and National Grid (no feed; power is the binding constraint so this is the worst gap, worked around via DESNZ and Ofgem atoms)
//   - CBRE, Knight Frank, Savills, JLL, Synergy Research (PDF-drop research, no feeds)
//   - Techerati (HTTP 520, retry: real competitor)
//   - Events: Datacloud, DCD Connect, DTX, Data Centre World, Bisnow (none publish a feed; events calendar must be hand-built)
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/data-centre-today-sources.mjs --site=data-centre-today [--dry-run]
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
  ["DSIT (Science, Innovation & Technology)", "https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology.atom"],
  ["DESNZ (Energy Security & Net Zero)", "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero.atom"],
  ["Ofgem", "https://www.ofgem.gov.uk", "Policy & tax", "https://www.gov.uk/government/organisations/ofgem.atom"],
  ["Environment Agency", "https://www.gov.uk/government/organisations/environment-agency", "Policy & tax", "https://www.gov.uk/government/organisations/environment-agency.atom"],
  ["Department for Business & Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["MHCLG (Housing, Communities & Local Government)", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government", "Policy & tax", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom"],
  ["Planning Inspectorate", "https://www.gov.uk/government/organisations/planning-inspectorate", "Policy & tax", "https://www.gov.uk/government/organisations/planning-inspectorate.atom"],
  ["Ofcom", "https://www.ofcom.org.uk", "Policy & tax", "https://www.gov.uk/government/organisations/ofcom.atom"],
  ["Cabinet Office", "https://www.gov.uk/government/organisations/cabinet-office", "Policy & tax", "https://www.gov.uk/government/organisations/cabinet-office.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Policy & tax", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["Department for Transport", "https://www.gov.uk/government/organisations/department-for-transport", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-transport.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Office for Investment", "https://www.gov.uk/government/organisations/office-for-investment", "Policy & tax", "https://www.gov.uk/government/organisations/office-for-investment.atom"],
  ["National Wealth Fund", "https://www.gov.uk/government/organisations/national-wealth-fund", "Policy & tax", "https://www.gov.uk/government/organisations/national-wealth-fund.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Policy & tax", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["National Infrastructure Commission", "https://www.gov.uk/government/organisations/national-infrastructure-commission", "Policy & tax", "https://www.gov.uk/government/organisations/national-infrastructure-commission.atom"],
  ["UK Research and Innovation", "https://www.ukri.org", "Policy & tax", "https://www.gov.uk/government/organisations/uk-research-and-innovation.atom"],
  ["DatacenterDynamics (DCD)", "https://www.datacenterdynamics.com", "Sector press (competitor)", "https://www.datacenterdynamics.com/en/rss/"],
  ["Data Center Knowledge", "https://www.datacenterknowledge.com", "Sector press (competitor)", "https://www.datacenterknowledge.com/rss.xml"],
  ["Data Centre Review", "https://datacentrereview.com", "Sector press (competitor)", "https://datacentrereview.com/feed/"],
  ["Data Centre & Network News (DCNN)", "https://dcnnmagazine.com", "Sector press (competitor)", "https://dcnnmagazine.com/feed/"],
  ["Data Center Frontier", "https://www.datacenterfrontier.com", "Sector press (competitor)", "https://www.datacenterfrontier.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D"],
  ["Capacity", "https://capacityglobal.com", "Sector press (competitor)", "https://capacityglobal.com/feed/"],
  ["Data Center POST", "https://datacenterpost.com", "Sector press (competitor)", "https://datacenterpost.com/feed/"],
  ["W.Media", "https://w.media", "Sector press (competitor)", "https://w.media/feed/"],
  ["Blocks & Files", "https://blocksandfiles.com", "Sector press (competitor)", "https://blocksandfiles.com/feed/"],
  ["The Next Platform", "https://www.nextplatform.com", "Sector press (competitor)", "https://www.nextplatform.com/feed/"],
  ["HPCwire", "https://www.hpcwire.com", "Sector press (competitor)", "https://www.hpcwire.com/feed/"],
  ["The Register", "https://www.theregister.com", "Sector press (competitor)", "https://www.theregister.com/headlines.atom"],
  ["Light Reading", "https://www.lightreading.com", "Sector press (competitor)", "https://www.lightreading.com/rss.xml"],
  ["Tech Monitor", "https://www.techmonitor.ai", "Sector press (competitor)", "https://www.techmonitor.ai/feed"],
  ["PublicTechnology", "https://www.publictechnology.net", "Sector press (competitor)", "https://www.publictechnology.net/feed/"],
  ["UKTN", "https://www.uktech.news", "Sector press (competitor)", "https://www.uktech.news/feed"],
  ["ISPreview UK", "https://www.ispreview.co.uk", "Sector press (competitor)", "https://www.ispreview.co.uk/index.php/feed"],
  ["New Civil Engineer", "https://www.newcivilengineer.com", "Sector press (competitor)", "https://www.newcivilengineer.com/feed/"],
  ["Construction News", "https://www.constructionnews.co.uk", "Sector press (competitor)", "https://www.constructionnews.co.uk/feed/"],
  ["Construction Enquirer", "https://www.constructionenquirer.com", "Sector press (competitor)", "https://www.constructionenquirer.com/feed/"],
  ["The Construction Index (UK news)", "https://www.theconstructionindex.co.uk", "Sector press (competitor)", "https://www.theconstructionindex.co.uk/feeds/news-uk.xml"],
  ["The Construction Index (tenders)", "https://www.theconstructionindex.co.uk", "Sector press (competitor)", "https://www.theconstructionindex.co.uk/feeds/tenders.xml"],
  ["The Construction Index (contract awards)", "https://www.theconstructionindex.co.uk", "Sector press (competitor)", "https://www.theconstructionindex.co.uk/feeds/news-contract-over20m-under20m.xml"],
  ["Planning, Building & Construction Today", "https://www.pbctoday.co.uk", "Sector press (competitor)", "https://www.pbctoday.co.uk/news/feed/"],
  ["Construction Management", "https://constructionmanagement.co.uk", "Sector press (competitor)", "https://constructionmanagement.co.uk/feed/"],
  ["Place North West", "https://www.placenorthwest.co.uk", "Sector press (competitor)", "https://www.placenorthwest.co.uk/feed/"],
  ["Local Government Chronicle", "https://www.lgcplus.com", "Sector press (competitor)", "https://www.lgcplus.com/feed/"],
  ["Energy Live News", "https://www.energylivenews.com", "Sector press (competitor)", "https://www.energylivenews.com/feed/"],
  ["Open Compute Project", "https://www.opencompute.org", "Sector body", "https://www.opencompute.org/feed/"],
  ["Energy UK", "https://www.energy-uk.org.uk", "Sector body", "https://www.energy-uk.org.uk/feed/"],
  ["CIBSE Journal", "https://www.cibsejournal.com", "Sector body", "https://www.cibsejournal.com/feed/"],
  ["Heating and Ventilation News", "https://www.hvnplus.co.uk", "Sector body", "https://www.hvnplus.co.uk/feed/"],
  ["Electrical Times", "https://www.electricaltimes.co.uk", "Sector body", "https://www.electricaltimes.co.uk/feed/"],
  ["Uptime Institute Journal", "https://journal.uptimeinstitute.com", "Research", "https://journal.uptimeinstitute.com/feed/"],
  ["Carbon Brief", "https://www.carbonbrief.org", "Research", "https://www.carbonbrief.org/feed"],
  ["Watt-Logic", "https://watt-logic.com", "Research", "https://watt-logic.com/feed/"],
  ["Equinix (Interconnections blog)", "https://blog.equinix.com", "Operator", "https://blog.equinix.com/feed/"],
  ["Equinix (press releases)", "https://investor.equinix.com", "Operator", "https://investor.equinix.com/news-events/press-releases/rss"],
  ["Digital Realty (news releases)", "https://www.digitalrealty.com", "Operator", "https://investor.digitalrealty.com/rss/news-releases.xml"],
  ["Kao Data", "https://kaodata.com", "Operator", "https://kaodata.com/feed/"],
  ["Global Switch", "https://www.globalswitch.com", "Operator", "https://www.globalswitch.com/feed/"],
  ["Teraco", "https://www.teraco.co.za", "Operator", "https://www.teraco.co.za/feed/"],
  ["Zenlayer", "https://www.zenlayer.com", "Operator", "https://www.zenlayer.com/feed/"],
  ["Serverfarm", "https://www.serverfarmllc.com", "Operator", "https://www.serverfarmllc.com/feed/"],
  ["AWS News Blog", "https://aws.amazon.com", "Operator", "https://aws.amazon.com/blogs/aws/feed/"],
  ["Microsoft Azure Blog", "https://azure.microsoft.com", "Operator", "https://azure.microsoft.com/en-us/blog/feed/"],
  ["Google Cloud Blog", "https://cloud.google.com/blog", "Operator", "https://cloudblog.withgoogle.com/rss/"],
  ["Schneider Electric Blog", "https://blog.se.com", "Supplier", "https://blog.se.com/feed/"],
  ["Airedale by Modine", "https://www.airedale.com", "Supplier", "https://www.airedale.com/feed/"],
  ["Legrand", "https://www.legrand.com", "Supplier", "https://www.legrand.com/en/rss.xml"],
  ["Riello UPS", "https://www.riello-ups.co.uk", "Supplier", "https://www.riello-ups.co.uk/feed"],
  ["Winthrop Technologies", "https://winthrop.ie", "Supplier", "https://winthrop.ie/feed/"],
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
            ? "Seeded from scripts/data-centre-today-sources.mjs. Feed verified by fetch 2026-11-17."
            : "Seeded from scripts/data-centre-today-sources.mjs. No feed found 2026-11-17; hub autodiscovery plus outreach target.",
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
