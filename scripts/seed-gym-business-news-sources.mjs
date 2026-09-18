// Seed Gym Business News's newswire with direct feeds, sector bodies and the
// advertiser map from docs/vertical-brief-gym-fitness-spa.md (incl. the
// 18 Sep 2026 refresh).
//
// Same structure and same lesson as the earlier source seeds: a Google News
// query is not a source, direct feeds return real articles, and the launch
// target is 30+ verified feeds. Every URL in the FEEDS sections below returned
// valid RSS/Atom with at least one item when fetched on 18 Sep 2026
// (docs/gym-business-news-sources.md holds the record: item counts and
// newest-item dates).
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them (all probed
// 18 Sep 2026): ukactive 403s every feed path. Health Club Management's /rss
// lands on a bot-challenged "TEST PAGE". Gym Owner Monthly has its feed
// disabled (both /feed/ and ?feed=rss2 redirect home). Club Industry, ALM,
// Wellhub, Ripe, Escape Fitness and Concept2 403; Daxko 429s. TeamUp,
// PushPress, Mindbody, Wodify, Exercise.com, Gymdesk, Perfect Gym, Resamania,
// EGYM, Myzone, Technogym, Life Fitness and GoCardless expose no feed at the
// usual paths. These are hub-only rows below: autodiscovery may find what
// hand-probing missed, and every one earns its place as an advertiser or
// monitoring target regardless.
//
// DELIBERATELY NOT SEEDED: gov.uk keyword search wires (loose matching, the
// top item for "gym" on 18 Sep was a knife-crime release), and the DHSC, OHID
// and DfE organisation feeds. Health guidance is exactly what the scope rule
// keeps out, so a feed that is mostly health guidance is a liability.
//
// COMPETITOR-FLAGGED SOURCES: rows categorised "Sector press (competitor)" are
// monitoring sources. They tell the Researcher what the incumbents covered;
// they are not outreach targets and their copy is never a source to rewrite
// without the underlying primary source.
//
//   node scripts/seed-gym-business-news-sources.mjs --site=gym-business-news [--dry-run]
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
  // ---- Policy, regulators and sector bodies (verified feeds) ----
  ["CIMSPA", "https://cimspa.co.uk", "Sector body", "https://cimspa.co.uk/feed/"],
  ["Sport England", "https://www.gov.uk/government/organisations/sport-england", "Sector body", "https://www.gov.uk/government/organisations/sport-england.atom"],
  ["DCMS", "https://www.gov.uk/government/organisations/department-for-culture-media-and-sport", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-culture-media-and-sport.atom"],
  ["HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Dept for Business & Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Policy & tax", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Low Pay Commission", "https://www.gov.uk/government/organisations/low-pay-commission", "Policy & tax", "https://www.gov.uk/government/organisations/low-pay-commission.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Policy & tax", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["HSE (gov.uk)", "https://www.gov.uk/government/organisations/health-and-safety-executive", "Regulation & compliance", "https://www.gov.uk/government/organisations/health-and-safety-executive.atom"],
  ["HSE press office", "https://press.hse.gov.uk", "Regulation & compliance", "https://press.hse.gov.uk/feed/"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Regulation & compliance", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["Skills England", "https://www.gov.uk/government/organisations/skills-england", "Training & qualifications", "https://www.gov.uk/government/organisations/skills-england.atom"],
  ["PPL PRS", "https://pplprs.co.uk", "Regulation & compliance", "https://pplprs.co.uk/feed/"],
  ["PPL", "https://www.ppluk.com", "Regulation & compliance", "https://www.ppluk.com/feed/"],
  ["British Chambers of Commerce", "https://www.britishchambers.org.uk", "Business & economy", "https://www.britishchambers.org.uk/feed/"],
  ["Health and Fitness Association", "https://www.healthandfitness.org", "Sector body", "https://www.healthandfitness.org/feed/"],
  ["Swimming Teachers' Association", "https://www.sta.co.uk", "Sector body", "https://www.sta.co.uk/feed/"],
  ["YMCA Awards", "https://www.ymcaawards.co.uk", "Training & qualifications", "https://www.ymcaawards.co.uk/feed/"],
  ["Swim England", "https://www.swimming.org/swimengland", "Sector body", "https://www.swimming.org/swimengland/feed/"],
  ["International Franchise Association", "https://www.franchise.org", "Franchising", "https://www.franchise.org/feed/"],
  ["AUSactive", "https://ausactive.org.au", "Sector body", "https://ausactive.org.au/feed/"],
  ["Exercise New Zealand", "https://www.exercise.org.nz", "Sector body", "https://www.exercise.org.nz/feed/"],

  // ---- Sector, market and small-business press (verified feeds; competitors labelled) ----
  ["Athletech News", "https://athletechnews.com", "Sector press (competitor)", "https://athletechnews.com/feed/"],
  ["Club Solutions Magazine", "https://clubsolutionsmagazine.com", "Sector press (competitor)", "https://clubsolutionsmagazine.com/feed/"],
  ["WellNation", "https://wellnation.uk", "Sector press (competitor)", "https://wellnation.uk/feed/"],
  ["Franchise Times", "https://www.franchisetimes.com", "Franchising", "https://www.franchisetimes.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc"],
  ["The PT Development Center", "https://www.theptdc.com", "Training & qualifications", "https://www.theptdc.com/feed"],
  ["Future Fit", "https://www.futurefit.co.uk", "Training & qualifications", "https://www.futurefit.co.uk/blog/feed/"],
  ["SmallBusiness.co.uk", "https://smallbusiness.co.uk", "Business & economy", "https://smallbusiness.co.uk/feed/"],
  ["Simply Business", "https://www.simplybusiness.co.uk", "Insurance & finance", "https://www.simplybusiness.co.uk/feed/"],
  ["Mintel press centre", "https://www.mintel.com", "Market data", "https://www.mintel.com/press-centre/feed/"],

  // ---- Press-release wires (verified feeds; expect a third off-seam) ----
  ["PR Newswire: sports", "https://www.prnewswire.com", "Press-release wire", "https://www.prnewswire.com/rss/sports-latest-news/sports-latest-news-list.rss"],
  ["GlobeNewswire: fitness", "https://www.globenewswire.com", "Press-release wire", "https://www.globenewswire.com/RssFeed/keyword/fitness"],
  ["GlobeNewswire: gym", "https://www.globenewswire.com/search/keyword/gym", "Press-release wire", "https://www.globenewswire.com/RssFeed/keyword/gym"],

  // ---- Software, payments, equipment and developers (verified feeds) ----
  ["ClubWise", "https://www.clubwise.com", "Software & payments", "https://www.clubwise.com/feed/"],
  ["Xplor", "https://xplor.com", "Software & payments", "https://xplor.com/feed/"],
  ["Glofox", "https://www.glofox.com", "Software & payments", "https://www.glofox.com/feed/"],
  ["ABC Fitness", "https://abcfitness.com", "Software & payments", "https://abcfitness.com/feed/"],
  ["Zen Planner", "https://www.zenplanner.com", "Software & payments", "https://www.zenplanner.com/feed"],
  ["Legend", "https://www.legendware.co.uk", "Software & payments", "https://www.legendware.co.uk/feed/"],
  ["Wattbike", "https://wattbike.com", "Equipment", "https://wattbike.com/blogs/news.atom"],
  ["Indigo Fitness", "https://indigofitness.com", "Equipment", "https://indigofitness.com/feed/"],
  ["Alliance Leisure", "https://allianceleisure.co.uk", "Fit-out & development", "https://allianceleisure.co.uk/feed/"],

  // ---- No feed, but load-bearing: hub-only + outreach/monitoring targets ----
  ["ukactive", "https://www.ukactive.com", "Sector body"],
  ["British Franchise Association", "https://www.thebfa.org", "Franchising"],
  ["EuropeActive", "https://www.europeactive.eu", "Sector body"],
  ["Community Leisure UK", "https://communityleisureuk.org", "Sector body"],
  ["Active IQ", "https://www.activeiq.co.uk", "Training & qualifications"],
  ["Health Club Management", "https://www.healthclubmanagement.co.uk", "Sector press (competitor)"],
  ["Leisure Opportunities", "https://www.leisureopportunities.co.uk", "Sector press (competitor)"],
  ["Sports Management", "https://www.sportsmanagement.co.uk", "Sector press (competitor)"],
  ["Gym Owner Monthly", "https://gymownermonthly.com", "Sector press (competitor)"],
  ["Fitt Insider", "https://insider.fitt.co", "Sector press (competitor)"],
  ["Club Industry", "https://www.clubindustry.com", "Sector press (competitor)"],
  ["Australasian Leisure Management", "https://www.ausleisure.com.au", "Sector press"],
  ["1851 Franchise", "https://1851franchise.com", "Franchising"],
  ["What Franchise", "https://www.whatfranchise.co.uk", "Franchising"],
  ["TeamUp", "https://goteamup.com", "Software & payments"],
  ["PushPress", "https://www.pushpress.com", "Software & payments"],
  ["Mindbody", "https://www.mindbodyonline.com", "Software & payments"],
  ["Wodify", "https://www.wodify.com", "Software & payments"],
  ["Exercise.com", "https://www.exercise.com", "Software & payments"],
  ["Gymdesk", "https://gymdesk.com", "Software & payments"],
  ["Perfect Gym", "https://www.perfectgym.com", "Software & payments"],
  ["Resamania UK", "https://resamania.co.uk", "Software & payments"],
  ["ClubRight", "https://clubright.co.uk", "Software & payments"],
  ["Gantner", "https://www.gantner.com", "Software & payments"],
  ["Daxko", "https://www.daxko.com", "Software & payments"],
  ["Wellhub", "https://wellhub.com", "Aggregators"],
  ["Hussle", "https://www.hussle.com", "Aggregators"],
  ["EGYM", "https://egym.com", "Equipment"],
  ["Myzone", "https://www.myzone.org", "Equipment"],
  ["Harlands", "https://www.harlandsgroup.co.uk", "Software & payments"],
  ["Ashbourne Management", "https://www.ashbournemanagement.co.uk", "Software & payments"],
  ["GoCardless", "https://gocardless.com", "Software & payments"],
  ["Ripe Insurance", "https://www.ripe.co.uk", "Insurance & finance"],
  ["Insure4Sport", "https://www.insure4sport.co.uk", "Insurance & finance"],
  ["Technogym", "https://www.technogym.com", "Equipment"],
  ["Life Fitness", "https://www.lifefitness.com", "Equipment"],
  ["Matrix Fitness UK", "https://www.matrixfitness.com", "Equipment"],
  ["Precor", "https://www.precor.com", "Equipment"],
  ["Escape Fitness", "https://escapefitness.com", "Equipment"],
  ["Concept2 UK", "https://www.concept2.co.uk", "Equipment"],
  ["Physical Company", "https://www.physicalcompany.co.uk", "Equipment"],
  ["Anytime Fitness UK", "https://www.anytimefitness.co.uk", "Operators & franchisors"],
  ["Snap Fitness UK", "https://www.snapfitness.com/gb", "Operators & franchisors"],
  ["PureGym", "https://www.puregym.com", "Operators & franchisors"],
  ["The Gym Group", "https://www.tggplc.com", "Operators & franchisors"],
  ["Elevate", "https://www.elevatearena.com", "Events"],
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
            ? "Seeded from scripts/seed-gym-business-news-sources.mjs. Feed verified by hand 18 Sep 2026 (docs/gym-business-news-sources.md)."
            : "Seeded from scripts/seed-gym-business-news-sources.mjs (advertiser map). No feed found 18 Sep 2026; hub autodiscovery + outreach target.",
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
