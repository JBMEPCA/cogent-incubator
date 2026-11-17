// Seed Retail Business Magazine's newswire with the sources verified on 2026-11-17.
//
// Same structure and same lesson as every source seed before it: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in SOURCES below was fetched on
// 2026-11-17 and returned valid RSS or Atom with at least one item.
//
// Returned by the wave-7 feed research. REVIEW FLAG: the agent filed several general-news feeds (BBC Business, Guardian, City AM, Finextra, Payments Dive, SmallBusiness, Startups) under 'Sector press (competitor)'. They are neither competitors nor retail-specific, and a broad national feed floods the wire with off-beat items. Reclassify or drop before seeding.
//
// DELIBERATELY NOT SEEDED:
//   - BBC News Business: national news, not a retail source; floods the wire
//   - The Guardian Supermarkets: consumer-facing national coverage; off-beat for a trade wire
//   - The Guardian Retail: same
//   - City AM: national business paper, not sector press
//   - Finextra: fintech, belongs to a different beat
//   - Payments Dive: US payments trade, too far from the shop floor
//   - SmallBusiness.co.uk: Smart SME's ground, not Retail's
//   - Startups.co.uk: same
//   - EuroCommerce: feed works but newest item Feb 2023, stale
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them. Every one
// was probed on 2026-11-17 and has no usable feed. Most are advertiser or
// monitoring targets regardless, which is why they are listed rather than
// forgotten:
//   - British Retail Consortium (BRC-KPMG sales and crime survey: no feed, needs mailing list)
//   - BIRA (key body for independents)
//   - Federation of Independent Retailers (The Fed)
//   - IGD
//   - Retail Trust
//   - Kantar
//   - NIQ
//   - GfK
//   - Retail Gazette (403 Cloudflare)
//   - Grocery Gazette (403)
//   - Retail Insight Network (403)
//   - Booker (403, advertiser)
//   - SPAR UK (403, advertiser)
//   - Tesco, Sainsbury's, Asda, Morrisons, Lidl GB, M&S, Waitrose, Co-op (no feed; Aldi is the only big grocer with one)
//   - Bestway, Nisa, Premier (advertisers)
//   - PayPoint (advertiser and convenience data source)
//   - Worldpay
//   - Square
//   - Shopify
//   - EPOS Now
//   - Retail Week (paywalled, JS-walled)
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/retail-business-magazine-sources.mjs --site=retail-business-magazine [--dry-run]
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
  ["The Grocer", "https://www.thegrocer.co.uk", "Sector press (competitor)", "https://www.thegrocer.co.uk/34272.rss"],
  ["Convenience Store", "https://www.conveniencestore.co.uk", "Sector press (competitor)", "https://www.conveniencestore.co.uk/34684.rss"],
  ["Talking Retail", "https://www.talkingretail.com", "Sector press (competitor)", "https://www.talkingretail.com/feed/"],
  ["Better Retailing (Retail Express)", "https://betterretailing.com", "Sector press (competitor)", "https://betterretailing.com/feed/"],
  ["Retail Times", "https://www.retailtimes.co.uk", "Sector press (competitor)", "https://www.retailtimes.co.uk/feed/"],
  ["Retail Sector", "https://www.retailsector.co.uk", "Sector press (competitor)", "https://www.retailsector.co.uk/feed/"],
  ["The Grocery Trader", "https://www.grocerytrader.co.uk", "Sector press (competitor)", "https://www.grocerytrader.co.uk/feed/"],
  ["Drapers", "https://www.drapersonline.com", "Sector press (competitor)", "https://www.drapersonline.com/feed"],
  ["InternetRetailing", "https://internetretailing.net", "Sector press (competitor)", "https://internetretailing.net/feed/"],
  ["TheIndustry.fashion", "https://www.theindustry.fashion", "Sector press (competitor)", "https://www.theindustry.fashion/feed/"],
  ["The Retail Bulletin", "https://www.theretailbulletin.com", "Sector press (competitor)", "https://www.theretailbulletin.com/feed/"],
  ["KamCity", "https://www.kamcity.com", "Sector press (competitor)", "https://www.kamcity.com/feed/"],
  ["Retail Technology Innovation Hub", "https://retailtechinnovationhub.com", "Sector press (competitor)", "https://retailtechinnovationhub.com/home?format=rss"],
  ["Better Wholesaling", "https://www.betterwholesaling.com", "Sector press (competitor)", "https://www.betterwholesaling.com/feed/"],
  ["Wholesale Manager", "https://www.wholesalemanager.co.uk", "Sector press (competitor)", "https://www.wholesalemanager.co.uk/feed/"],
  ["Food Manufacture", "https://www.foodmanufacture.co.uk", "Supplier", "https://www.foodmanufacture.co.uk/Info/FoodManufacture-RSS"],
  ["FoodNavigator", "https://www.foodnavigator.com", "Supplier", "https://www.foodnavigator.com/Info/FoodNavigator-RSS"],
  ["Packaging News", "https://www.packagingnews.co.uk", "Supplier", "https://www.packagingnews.co.uk/feed"],
  ["Co-op News", "https://www.thenews.coop", "Sector press (competitor)", "https://www.thenews.coop/feed/"],
  ["Association of Convenience Stores", "https://www.acs.org.uk", "Sector body", "https://www.acs.org.uk/rss.xml"],
  ["Aldi UK Press Centre", "https://www.aldipresscentre.co.uk", "Retailer", "https://www.aldipresscentre.co.uk/feed/"],
  ["Lightspeed Commerce UK", "https://www.lightspeedhq.co.uk", "Supplier", "https://www.lightspeedhq.co.uk/blog/feed/"],
  ["Stripe", "https://stripe.com", "Supplier", "https://stripe.com/blog/feed.rss"],
  ["Lumina Intelligence", "https://www.lumina-intelligence.com", "Research", "https://www.lumina-intelligence.com/feed/"],
  ["Department for Business and Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["HM Revenue and Customs", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Policy & tax", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["Groceries Code Adjudicator", "https://www.gov.uk/government/organisations/groceries-code-adjudicator", "Policy & tax", "https://www.gov.uk/government/organisations/groceries-code-adjudicator.atom"],
  ["Food Standards Agency", "https://www.gov.uk/government/organisations/food-standards-agency", "Policy & tax", "https://www.gov.uk/government/organisations/food-standards-agency.atom"],
  ["Defra", "https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs.atom"],
  ["Department of Health and Social Care", "https://www.gov.uk/government/organisations/department-of-health-and-social-care", "Policy & tax", "https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom"],
  ["Home Office", "https://www.gov.uk/government/organisations/home-office", "Policy & tax", "https://www.gov.uk/government/organisations/home-office.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Policy & tax", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["The Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Policy & tax", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Office for Product Safety and Standards", "https://www.gov.uk/government/organisations/office-for-product-safety-and-standards", "Policy & tax", "https://www.gov.uk/government/organisations/office-for-product-safety-and-standards.atom"],
  ["Office for National Statistics", "https://www.gov.uk/government/organisations/office-for-national-statistics", "Policy & tax", "https://www.gov.uk/government/organisations/office-for-national-statistics.atom"],
  ["Department for Work and Pensions", "https://www.gov.uk/government/organisations/department-for-work-pensions", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-work-pensions.atom"],
  ["Financial Conduct Authority", "https://www.gov.uk/government/organisations/financial-conduct-authority", "Policy & tax", "https://www.gov.uk/government/organisations/financial-conduct-authority.atom"],
  ["Environment Agency", "https://www.gov.uk/government/organisations/environment-agency", "Policy & tax", "https://www.gov.uk/government/organisations/environment-agency.atom"],
  ["Intellectual Property Office", "https://www.gov.uk/government/organisations/intellectual-property-office", "Policy & tax", "https://www.gov.uk/government/organisations/intellectual-property-office.atom"],
  ["Welsh Government", "https://www.gov.uk/government/organisations/welsh-government", "Policy & tax", "https://www.gov.uk/government/organisations/welsh-government.atom"],
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
            ? "Seeded from scripts/retail-business-magazine-sources.mjs. Feed verified by fetch 2026-11-17."
            : "Seeded from scripts/retail-business-magazine-sources.mjs. No feed found 2026-11-17; hub autodiscovery plus outreach target.",
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
