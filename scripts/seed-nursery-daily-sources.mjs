// Seed Nursery Daily's newswire with direct feeds, regulators, associations
// and the advertiser map from docs/vertical-brief-nurseries.md.
//
// Same structure and the same lesson as the earlier source seeds: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in the FEEDS rows below returned
// valid RSS or Atom with items when fetched on 18 Sep 2026
// (docs/nursery-daily-sources.md holds the record with newest-item dates).
//
// This title leans on gov.uk harder than any before it, on purpose. The brief
// measured about 2.3 sector-grade Google News items a day, and the biggest
// story class in the sector (enforcement) may only be covered at group level
// from an official source. Ofsted, DfE and nine gov.uk keyword/topic searches
// are that source.
//
// NOTABLE ABSENCES (all probed 18 Sep 2026): Nursery World 403s every fetch;
// Nursery Management Today has no feed; CYP Now 403s; the Early Years Alliance
// 403s site-wide; Christie & Co, Insider Media and TheBusinessDesk (the brief's
// three deal sources) have no readable feed. Those rows are hub-only below:
// autodiscovery may find what hand-probing missed, and each is an outreach or
// monitoring target regardless.
//
// HELD BACK: Kids Planet, GrandirUK, Monkey Puzzle, High Speed Training,
// Cheqdin and the DfE Education Hub all have working feeds, but they carry
// parent-facing or practitioner content the buyer rule would reject. They are
// seeded as hub-only rows so the wire is not filled with items the Researcher
// has to pay to discard.
//
// COMPETITOR-FLAGGED SOURCES: rows in "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/seed-nursery-daily-sources.mjs --site=nursery-daily [--dry-run]
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
const GS = "https://www.gov.uk/search";
const SOURCES = [
  // ---- Policy, regulators and government (verified feeds) ----
  ["Ofsted", "https://www.gov.uk/government/organisations/ofsted", "Regulator", "https://www.gov.uk/government/organisations/ofsted.atom"],
  ["Dept for Education", "https://www.gov.uk/government/organisations/department-for-education", "Policy & funding", "https://www.gov.uk/government/organisations/department-for-education.atom"],
  ["HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Dept for Business & Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Policy & tax", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Low Pay Commission", "https://www.gov.uk/government/organisations/low-pay-commission", "Pay & workforce", "https://www.gov.uk/government/organisations/low-pay-commission.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Property", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["Skills England", "https://www.gov.uk/government/organisations/skills-england", "Pay & workforce", "https://www.gov.uk/government/organisations/skills-england.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Regulator", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["HSE press", "https://press.hse.gov.uk", "Regulator", "https://press.hse.gov.uk/feed/"],
  ["gov.uk news: childcare", `${GS}/news-and-communications?keywords=childcare`, "Policy & funding", `${GS}/news-and-communications.atom?keywords=childcare`],
  ["gov.uk news: early years", `${GS}/news-and-communications?keywords=%22early+years%22`, "Policy & funding", `${GS}/news-and-communications.atom?keywords=%22early+years%22`],
  ["gov.uk news: nurseries", `${GS}/news-and-communications?keywords=nurseries`, "Policy & funding", `${GS}/news-and-communications.atom?keywords=nurseries`],
  ["gov.uk statistics: childcare", `${GS}/research-and-statistics?keywords=childcare`, "Market data", `${GS}/research-and-statistics.atom?keywords=childcare`],
  ["gov.uk guidance: early years", `${GS}/guidance-and-regulation?keywords=%22early+years%22`, "Regulator", `${GS}/guidance-and-regulation.atom?keywords=%22early+years%22`],
  ["gov.uk consultations: childcare", `${GS}/policy-papers-and-consultations?keywords=childcare`, "Policy & funding", `${GS}/policy-papers-and-consultations.atom?keywords=childcare`],
  ["gov.uk all: Ofsted early years", `${GS}/all?keywords=%22early+years%22&organisations%5B%5D=ofsted&order=updated-newest`, "Regulator", `${GS}/all.atom?keywords=%22early+years%22&organisations%5B%5D=ofsted&order=updated-newest`],
  ["gov.uk all: DfE early years", `${GS}/all?keywords=%22early+years%22&organisations%5B%5D=department-for-education&order=updated-newest`, "Policy & funding", `${GS}/all.atom?keywords=%22early+years%22&organisations%5B%5D=department-for-education&order=updated-newest`],
  ["gov.uk all: wraparound childcare", `${GS}/all?keywords=wraparound+childcare&order=updated-newest`, "Policy & funding", `${GS}/all.atom?keywords=wraparound+childcare&order=updated-newest`],
  ["Ofsted early years blog", "https://earlyyears.blog.gov.uk", "Regulator", "https://earlyyears.blog.gov.uk/feed/"],
  ["Ofsted education inspection blog", "https://educationinspection.blog.gov.uk", "Regulator", "https://educationinspection.blog.gov.uk/feed/"],
  ["Welsh Government", "https://www.gov.wales", "Nations", "https://www.gov.wales/announcements/rss"],
  ["NI Dept of Education", "https://www.education-ni.gov.uk", "Nations", "https://www.education-ni.gov.uk/news/feed/education"],
  ["House of Commons Library", "https://commonslibrary.parliament.uk", "Policy & funding", "https://commonslibrary.parliament.uk/feed/"],

  // ---- Associations, research and data (verified feeds) ----
  ["NDNA", "https://ndna.org.uk", "Trade body", "https://ndna.org.uk/feed/"],
  ["Coram PACEY", "https://www.corampacey.org.uk", "Trade body", "https://www.corampacey.org.uk/feed/"],
  ["Early Education", "https://early-education.org.uk", "Trade body", "https://early-education.org.uk/feed/"],
  ["Early Years Scotland", "https://earlyyearsscotland.org", "Nations", "https://earlyyearsscotland.org/feed/"],
  ["Foundation Years", "https://www.foundationyears.org.uk", "Policy & funding", "https://www.foundationyears.org.uk/feed/"],
  ["Early Childhood Ireland", "https://www.earlychildhoodireland.ie", "Nations", "https://www.earlychildhoodireland.ie/feed/"],
  ["Pobal", "https://www.pobal.ie", "Nations", "https://www.pobal.ie/feed/"],
  ["Resolution Foundation", "https://www.resolutionfoundation.org", "Research", "https://www.resolutionfoundation.org/feed/"],
  ["Sutton Trust", "https://www.suttontrust.com", "Research", "https://www.suttontrust.com/feed/"],
  ["Nuffield Foundation", "https://www.nuffieldfoundation.org", "Research", "https://www.nuffieldfoundation.org/feed"],
  ["British Chambers of Commerce", "https://www.britishchambers.org.uk", "Business & economy", "https://www.britishchambers.org.uk/feed/"],

  // ---- Business and deal wires (verified feeds) ----
  ["Business Live", "https://www.business-live.co.uk", "Deal wire", "https://www.business-live.co.uk/?service=rss"],
  ["Business Sale Report", "https://www.business-sale.com", "Deal wire", "https://www.business-sale.com/news/rss"],
  ["Growth Business", "https://growthbusiness.co.uk", "Business & economy", "https://growthbusiness.co.uk/feed/"],
  ["Local Government Chronicle", "https://www.lgcplus.com", "Market press", "https://www.lgcplus.com/feed/"],

  // ---- Suppliers and software (verified feeds) ----
  ["Famly", "https://www.famly.co", "Nursery software", "https://www.famly.co/blog/rss.xml"],
  ["Parenta", "https://www.parenta.com", "Nursery software", "https://www.parenta.com/feed/"],
  ["Tapestry", "https://tapestry.info", "Nursery software", "https://tapestry.info/feed/"],
  ["Connect Childcare", "https://connectchildcare.com", "Nursery software", "https://connectchildcare.com/feed/"],
  ["Kinderly", "https://kinderly.co.uk", "Nursery software", "https://kinderly.co.uk/feed/"],
  ["Ovivio UK", "https://ovivio.com/uk", "Nursery software", "https://ovivio.com/uk/feed/"],
  ["Nursery Kitchen", "https://nurserykitchen.co.uk", "Food & catering", "https://nurserykitchen.co.uk/feed/"],
  ["Early Excellence", "https://earlyexcellence.com", "Furniture & resources", "https://earlyexcellence.com/feed/"],

  // ---- Brokers and law firms (verified feeds) ----
  ["Owen Froebel", "https://owenfroebel.co.uk", "M&A & valuation", "https://owenfroebel.co.uk/feed/"],
  ["SHMA (Shakespeare Martineau)", "https://www.shma.co.uk", "Legal & accountancy", "https://www.shma.co.uk/feed/"],
  ["Lester Aldridge", "https://www.lesteraldridge.com", "Legal & accountancy", "https://www.lesteraldridge.com/feed/"],

  // ---- Sector press: monitoring only, no readable feed ----
  ["Nursery World", "https://www.nurseryworld.co.uk", "Sector press (competitor)"],
  ["Nursery Management Today", "https://nmt-magazine.co.uk", "Sector press (competitor)"],
  ["CYP Now", "https://www.cypnow.co.uk", "Sector press (competitor)"],
  ["Teach Early Years", "https://www.teachearlyyears.com", "Sector press (competitor)"],
  ["daynurseries.co.uk", "https://www.daynurseries.co.uk", "Sector press (competitor)"],
  ["The Sector (AU)", "https://thesector.com.au", "Sector press (competitor)"],

  // ---- Verified feeds held back (parent-facing or stale): hub-only ----
  ["Kids Planet", "https://www.kidsplanetdaynurseries.co.uk", "Nursery groups"],
  ["GrandirUK", "https://www.grandiruk.com", "Nursery groups"],
  ["Monkey Puzzle Day Nurseries", "https://monkeypuzzledaynurseries.com", "Nursery groups"],
  ["High Speed Training", "https://www.highspeedtraining.co.uk", "Training & qualifications"],
  ["Cheqdin", "https://cheqdin.com", "Nursery software"],

  // ---- No feed, but load-bearing: hub-only + outreach/advertiser targets ----
  ["Early Years Alliance", "https://www.eyalliance.org.uk", "Trade body"],
  ["Institute for Fiscal Studies", "https://ifs.org.uk", "Research"],
  ["Education Policy Institute", "https://epi.org.uk", "Research"],
  ["NFER", "https://www.nfer.ac.uk", "Research"],
  ["Care Inspectorate", "https://www.careinspectorate.com", "Nations"],
  ["Early Years Wales", "https://www.earlyyears.wales", "Nations"],
  ["Mudiad Meithrin", "https://meithrin.cymru", "Nations"],
  ["Employers For Childcare", "https://www.employersforchildcare.org", "Nations"],
  ["Christie & Co", "https://www.christie.com", "M&A & valuation"],
  ["Christie Finance", "https://www.christiefinance.com", "M&A & valuation"],
  ["Savills", "https://www.savills.co.uk", "M&A & valuation"],
  ["Abacus Day Nursery Sales", "https://www.abacusdaynurserysales.com", "M&A & valuation"],
  ["Eclipse Corporate Finance", "https://eclipsecf.com", "M&A & valuation"],
  ["Redwoods Dowling Kerr", "https://www.redwoodsdk.com", "M&A & valuation"],
  ["NewOwner", "https://newowner.co.uk", "M&A & valuation"],
  ["LaingBuisson", "https://www.laingbuisson.com", "Market data"],
  ["Insider Media", "https://www.insidermedia.com", "Deal wire"],
  ["TheBusinessDesk", "https://www.thebusinessdesk.com", "Deal wire"],
  ["Busy Bees", "https://www.busybeeschildcare.co.uk", "Nursery groups"],
  ["Bright Horizons UK", "https://www.brighthorizons.co.uk", "Nursery groups"],
  ["Storal", "https://storal.co.uk", "Nursery groups"],
  ["Bright Stars Nursery Group", "https://www.brightstarsnurseries.co.uk", "Nursery groups"],
  ["Morton Michel", "https://www.mortonmichel.com", "Insurance"],
  ["Blossom Educational", "https://blossomeducational.com", "Nursery software"],
  ["Nursery in a Box", "https://www.nurseryinabox.co.uk", "Nursery software"],
  ["Funding Loop", "https://www.fundingloop.co.uk", "Payments & funding"],
  ["Tickit", "https://www.tickit.co.uk", "Payments & funding"],
  ["Community Playthings", "https://www.communityplaythings.co.uk", "Furniture & resources"],
  ["Hope Education", "https://www.hope-education.co.uk", "Furniture & resources"],
  ["YPO", "https://www.ypo.co.uk", "Furniture & resources"],
  ["Cosy", "https://www.cosydirect.com", "Furniture & resources"],
  ["Zebedees", "https://www.zebedees.co.uk", "Food & catering"],
  ["Apetito", "https://www.apetito.co.uk", "Food & catering"],
  ["JBD Recruitment", "https://www.jbdrecruitment.co.uk", "Recruitment"],
  ["Eden Training Solutions", "https://www.edentrainingsolutions.co.uk", "Training & qualifications"],
  ["Childcare Marketing", "https://childcaremarketing.co.uk", "Marketing"],
  ["Stephensons", "https://www.stephensons.co.uk", "Legal & accountancy"],
  ["Childcare & Education Expo", "https://www.childcareeducationexpo.co.uk", "Events"],
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
          //
          // gov.uk search rows keep their full URL as the hub: the origin alone
          // (https://www.gov.uk) would make every one of them the same hub.
          newsHubUrl: website.includes("gov.uk/search") ? website : new URL(website).origin,
          // feedStatus is deliberately left null even for verified feeds. It is
          // the scan cron's field to own.
          feedUrl: feedUrl || null,
          notes: feedUrl
            ? "Seeded from scripts/seed-nursery-daily-sources.mjs. Feed verified by hand 18 Sep 2026 (docs/nursery-daily-sources.md)."
            : "Seeded from scripts/seed-nursery-daily-sources.mjs (nursery brief advertiser and source map). No usable feed 18 Sep 2026; hub autodiscovery + outreach or monitoring target.",
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
