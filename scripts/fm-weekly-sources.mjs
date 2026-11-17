// Seed FM Weekly's newswire with the sources verified on 2026-11-17.
//
// Same structure and same lesson as every source seed before it: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in SOURCES below was fetched on
// 2026-11-17 and returned valid RSS or Atom with at least one item.
//
// 63 kept of 64 verified. DROPPED ENGIE UK: it is an energy-services contractor and sits on the hard-FM side of the line this title must not cross, which is MEPCA's ground. WCS Group is kept because water hygiene and legionella compliance is a hygiene contract, which is squarely soft FM. Personnel Today, Employee Benefits, Open Access Government and LocalGov were filed under Policy & tax rather than competitor, which is right: they are adjacent press on wages, employment law and procurement, not rivals.
//
// SCOPE RULE: Soft FM and service firms only. Hard FM (plant, HVAC, factory maintenance) stays with MEPCA. A contractor feed that drifts into plant and energy services should be dropped, not reclassified.
//
// INGEST NOTE: LocalGov's RSS carries 20 items but no pubDate elements, so it needs a fallback date on ingest or every item looks undated.
//
// DELIBERATELY NOT SEEDED:
//   - ENGIE UK: energy services, which is hard FM and MEPCA's ground, not this title's
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them. Every one
// was probed on 2026-11-17 and has no usable feed. Most are advertiser or
// monitoring targets regardless, which is why they are listed rather than
// forgotten:
//   - Tomorrow's Cleaning and Tomorrow's FM (bespoke CMS, no feed anywhere) - the biggest competitor gap
//   - Cleaning Matters (TLS aborts), Cleanzine (403), Cleaning & Hygiene Today (dead domain), Cleaning & Maintenance Magazine (404)
//   - European Cleaning Journal - feed is broken server-side with an XMLWriter error, not missing. Worth emailing them
//   - Facilitate/IWFM magazine (403), PFM, i-FM.net, TwinFM (no feed on .NET platforms)
//   - British Cleaning Council (TLS fails), CSSA (cert mismatch), BPCA, BSIA, IWFM, CHSA (504) - every sector body in this trade is feedless
//   - Mitie, Numatic and Anabas publish VALID but EMPTY feeds (0 items, news sits in a custom post type). A reader connects and gets nothing forever. All three are prime advertiser targets
//   - Karcher UK, Diversey, Ecolab, Essity/Tork, Jangro, Bunzl, Greenham, Arco, Robert Scott, Tennant, Kimberly-Clark Professional, Vileda, Delphis Eco, Nationwide Hygiene - the entire supplier and advertiser list has no feeds
//   - Sodexo, Compass, ISS, Serco, ABM, Atalian Servest, Incentive FM, Pareto FM, SBFM, Cleanology, Rentokil/Initial, PHS, Citron Hygiene, CBRE - major contractors, no feeds
//   - SHP, HR Magazine, People Management, IFSEC, Horticulture Week, Pro Landscaper - Informa and Wilmington titles block feed requests
//   - Events: The Cleaning Show, Interclean, PestEx, The Workplace Event all 404. Events category unused; listings need manual entry
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/fm-weekly-sources.mjs --site=fm-weekly [--dry-run]
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
  ["BICSc (British Institute of Cleaning Science)", "https://www.bics.org.uk/", "Sector body", "https://www.bics.org.uk/feed/"],
  ["Federation of Window Cleaners", "https://www.f-w-c.co.uk/", "Sector body", "https://www.f-w-c.co.uk/feed/"],
  ["British Chambers of Commerce", "https://www.britishchambers.org.uk/", "Sector body", "https://www.britishchambers.org.uk/feed/"],
  ["Health and Safety Executive", "https://www.gov.uk/government/organisations/health-and-safety-executive", "Policy & tax", "https://www.gov.uk/government/organisations/health-and-safety-executive.atom"],
  ["HM Revenue & Customs", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Department for Business and Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Policy & tax", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Home Office", "https://www.gov.uk/government/organisations/home-office", "Policy & tax", "https://www.gov.uk/government/organisations/home-office.atom"],
  ["Low Pay Commission", "https://www.gov.uk/government/organisations/low-pay-commission", "Policy & tax", "https://www.gov.uk/government/organisations/low-pay-commission.atom"],
  ["Gangmasters and Labour Abuse Authority", "https://www.gov.uk/government/organisations/gangmasters-and-labour-abuse-authority", "Policy & tax", "https://www.gov.uk/government/organisations/gangmasters-and-labour-abuse-authority.atom"],
  ["Department for Work and Pensions", "https://www.gov.uk/government/organisations/department-for-work-pensions", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-work-pensions.atom"],
  ["Ministry of Housing, Communities and Local Government", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government", "Policy & tax", "https://www.gov.uk/government/organisations/ministry-of-housing-communities-local-government.atom"],
  ["Cabinet Office", "https://www.gov.uk/government/organisations/cabinet-office", "Policy & tax", "https://www.gov.uk/government/organisations/cabinet-office.atom"],
  ["Crown Commercial Service", "https://www.gov.uk/government/organisations/crown-commercial-service", "Policy & tax", "https://www.gov.uk/government/organisations/crown-commercial-service.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Policy & tax", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["UK Health Security Agency", "https://www.gov.uk/government/organisations/uk-health-security-agency", "Policy & tax", "https://www.gov.uk/government/organisations/uk-health-security-agency.atom"],
  ["Office for National Statistics", "https://www.gov.uk/government/organisations/office-for-national-statistics", "Policy & tax", "https://www.gov.uk/government/organisations/office-for-national-statistics.atom"],
  ["The Pensions Regulator", "https://www.gov.uk/government/organisations/the-pensions-regulator", "Policy & tax", "https://www.gov.uk/government/organisations/the-pensions-regulator.atom"],
  ["Employment Agency Standards Inspectorate", "https://www.gov.uk/government/organisations/employment-agency-standards-inspectorate", "Policy & tax", "https://www.gov.uk/government/organisations/employment-agency-standards-inspectorate.atom"],
  ["Security Industry Authority", "https://www.gov.uk/government/organisations/security-industry-authority", "Policy & tax", "https://www.gov.uk/government/organisations/security-industry-authority.atom"],
  ["Environment Agency", "https://www.gov.uk/government/organisations/environment-agency", "Policy & tax", "https://www.gov.uk/government/organisations/environment-agency.atom"],
  ["Acas", "https://www.gov.uk/government/organisations/acas", "Policy & tax", "https://www.gov.uk/government/organisations/acas.atom"],
  ["Department for Education", "https://www.gov.uk/government/organisations/department-for-education", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-education.atom"],
  ["NHS England", "https://www.gov.uk/government/organisations/nhs-england", "Policy & tax", "https://www.gov.uk/government/organisations/nhs-england.atom"],
  ["Equality and Human Rights Commission", "https://www.gov.uk/government/organisations/equality-and-human-rights-commission", "Policy & tax", "https://www.gov.uk/government/organisations/equality-and-human-rights-commission.atom"],
  ["The Gazette (official insolvency and corporate notices)", "https://www.thegazette.co.uk/", "Policy & tax", "https://www.thegazette.co.uk/all-notices/notice/data.feed"],
  ["Bank of England", "https://www.bankofengland.co.uk/", "Policy & tax", "https://www.bankofengland.co.uk/rss/news"],
  ["Personnel Today", "https://www.personneltoday.com/", "Policy & tax", "https://www.personneltoday.com/feed/"],
  ["Employee Benefits", "https://employeebenefits.co.uk/", "Policy & tax", "https://employeebenefits.co.uk/feed/"],
  ["Open Access Government", "https://www.openaccessgovernment.org/", "Policy & tax", "https://www.openaccessgovernment.org/feed/"],
  ["LocalGov", "https://www.localgov.co.uk/", "Policy & tax", "https://www.localgov.co.uk/rss"],
  ["Facilities Management Journal (FMJ)", "https://www.fmj.co.uk/", "Sector press (competitor)", "https://www.fmj.co.uk/feed/"],
  ["Workplace Insight", "https://workplaceinsight.net/", "Sector press (competitor)", "https://workplaceinsight.net/feed/"],
  ["Workplace Journal", "https://www.workplacejournal.co.uk/", "Sector press (competitor)", "https://www.workplacejournal.co.uk/feed/"],
  ["Infologue (security guarding)", "https://www.infologue.com/", "Sector press (competitor)", "https://www.infologue.com/news/feed/"],
  ["Security Journal UK", "https://securityjournaluk.com/", "Sector press (competitor)", "https://securityjournaluk.com/feed/"],
  ["City Security Magazine", "https://www.citysecuritymagazine.com/", "Sector press (competitor)", "https://www.citysecuritymagazine.com/feed/"],
  ["Pest Magazine", "https://www.pestmagazine.co.uk/", "Sector press (competitor)", "https://www.pestmagazine.co.uk/feed/"],
  ["Pest Control News", "https://www.pestcontrolnews.com/", "Sector press (competitor)", "https://www.pestcontrolnews.com/feed/"],
  ["FMLink", "https://www.fmlink.com/", "Sector press (competitor)", "https://www.fmlink.com/feed/"],
  ["Facilities Management Advisor", "https://www.facilitiesmanagementadvisor.com/", "Sector press (competitor)", "https://www.facilitiesmanagementadvisor.com/feed/"],
  ["Construction Enquirer", "https://www.constructionenquirer.com/", "Sector press (competitor)", "https://www.constructionenquirer.com/feed/"],
  ["Business Matters", "https://bmmagazine.co.uk/", "Sector press (competitor)", "https://bmmagazine.co.uk/feed/"],
  ["OCS Group", "https://www.ocs.com/", "Contractor", "https://www.ocs.com/feed/"],
  ["Churchill Group", "https://www.churchillservices.com/", "Contractor", "https://www.churchillservices.com/feed/"],
  ["Bidvest Noonan", "https://www.bidvestnoonan.com/", "Contractor", "https://www.bidvestnoonan.com/feed/"],
  ["Samsic UK", "https://www.samsic.uk/", "Contractor", "https://www.samsic.uk/feed/"],
  ["Julius Rutherfoord & Co", "https://www.juliusrutherfoord.co.uk/", "Contractor", "https://www.juliusrutherfoord.co.uk/feed/"],
  ["Nviro", "https://www.nviro.co.uk/", "Contractor", "https://www.nviro.co.uk/feed/"],
  ["Derrycourt Cleaning Specialists", "https://www.derrycourt.ie/", "Contractor", "https://www.derrycourt.ie/feed/"],
  ["Amulet (security, Churchill Group)", "https://www.amulet.co.uk/", "Contractor", "https://www.amulet.co.uk/feed/"],
  ["Principle Cleaning Services", "https://www.principleclean.com/", "Contractor", "https://www.principleclean.com/feed/"],
  ["Swiftclean", "https://www.swiftclean.co.uk/", "Contractor", "https://www.swiftclean.co.uk/feed/"],
  ["WCS Group (water hygiene and compliance)", "https://www.wcs-group.co.uk/", "Contractor", "https://www.wcs-group.co.uk/feed/"],
  ["Truvox International", "https://www.truvox.com/", "Supplier", "https://www.truvox.com/feed/"],
  ["Vectair Systems (washroom hygiene)", "https://www.vectairsystems.com/", "Supplier", "https://www.vectairsystems.com/feed/"],
  ["Killgerm (pest control supply)", "https://www.killgerm.com/", "Supplier", "https://www.killgerm.com/feed/"],
  ["Resolution Foundation", "https://www.resolutionfoundation.org/", "Research", "https://www.resolutionfoundation.org/feed/"],
  ["National Audit Office", "https://www.nao.org.uk/", "Research", "https://www.nao.org.uk/feed/"],
  ["Tenders Direct", "https://www.tendersdirect.co.uk/", "Research", "https://www.tendersdirect.co.uk/feed/"],
  ["Tracker Intelligence", "https://www.trackerintelligence.com/", "Research", "https://www.trackerintelligence.com/feed/"],
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
            ? "Seeded from scripts/fm-weekly-sources.mjs. Feed verified by fetch 2026-11-17."
            : "Seeded from scripts/fm-weekly-sources.mjs. No feed found 2026-11-17; hub autodiscovery plus outreach target.",
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
