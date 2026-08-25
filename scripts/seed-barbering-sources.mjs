// Seed Barbering Business's newswire with direct feeds, trade bodies and the
// advertiser map from the title #4 business case.
//
// Same structure as seed-golf-sources.mjs, same lesson behind it: a Google
// News query is not a source, direct feeds return real articles, and the
// launch target is 30+ verified feeds. Every URL in the FEEDS section below
// returned valid RSS/Atom with recent items when fetched on 21 Aug 2026
// (docs/barbering-business-sources.md holds the verification record with
// newest-item dates).
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them (all probed
// 21 Aug 2026): Modern Barber and Creative HEAD have no feeds at all. Wahl has
// no feed on any property (uk/pro/usa/global). Andis, BaByliss Pro UK, Takara
// Belmont, Salons Direct, Coolblades, Booksy, Fresha, Squire, Vagaro (403),
// Nearcut, SumUp, Square UK, Zettle, Dojo, EasyTip, FSB, BRC and BeautyMatter:
// no feeds. JRL's feed exists but is empty; American Crew's and Slick
// Gorilla's are stale (Oct 2025 / May 2025). These are hub-only rows below —
// autodiscovery may find what hand-probing missed, and every one earns its
// place as an outreach/backlink target regardless.
//
// COMPETITOR-FLAGGED SOURCES: the sector press rows marked "(competitor)" are
// monitoring sources — they tell the Researcher what the incumbents have
// covered; they are not outreach targets and their copy is never a source to
// rewrite without the underlying primary source.
//
//   node scripts/seed-barbering-sources.mjs --site=barbering-business [--dry-run]
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
// A fourth element means the feed was verified by hand on 21 Aug 2026 and goes
// straight in. Three elements means hub-only: lib/feeds.js autodiscovers, and
// if it finds nothing the row still earns its place as an outreach target.
const SOURCES = [
  // ---- Policy, trade bodies and regulators (verified feeds) ----
  ["NHBF", "https://www.nhbf.co.uk", "Trade body", "https://www.nhbf.co.uk/news-and-blogs/news/feed.xml"],
  ["British Beauty Council", "https://britishbeautycouncil.com", "Trade body", "https://britishbeautycouncil.com/feed/"],
  ["Hair & Barber Council", "https://www.haircouncil.org.uk", "Trade body", "https://www.haircouncil.org.uk/feed/"],
  ["HABIA", "https://www.habia.org", "Trade body", "https://www.habia.org/feed/"],
  ["VTCT", "https://www.vtct.org.uk", "Training & qualifications", "https://www.vtct.org.uk/feed/"],
  ["HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Policy & tax", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Policy & tax", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Dept for Business & Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Policy & tax", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Policy & tax", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Policy & tax", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Low Pay Commission", "https://www.gov.uk/government/organisations/low-pay-commission", "Policy & tax", "https://www.gov.uk/government/organisations/low-pay-commission.atom"],
  ["Valuation Office Agency", "https://www.gov.uk/government/organisations/valuation-office-agency", "Policy & tax", "https://www.gov.uk/government/organisations/valuation-office-agency.atom"],
  ["Skills England", "https://www.gov.uk/government/organisations/skills-england", "Training & qualifications", "https://www.gov.uk/government/organisations/skills-england.atom"],
  ["Dept for Education", "https://www.gov.uk/government/organisations/department-for-education", "Training & qualifications", "https://www.gov.uk/government/organisations/department-for-education.atom"],
  ["National Crime Agency (gov.uk)", "https://www.gov.uk/government/organisations/national-crime-agency", "Policy & enforcement", "https://www.gov.uk/government/organisations/national-crime-agency.atom"],
  ["NCA newsroom", "https://www.nationalcrimeagency.gov.uk", "Policy & enforcement", "https://www.nationalcrimeagency.gov.uk/news?format=feed&type=rss"],
  ["gov.uk wire: barbers", "https://www.gov.uk/search/news-and-communications?keywords=barbers", "Policy & enforcement", "https://www.gov.uk/search/news-and-communications.atom?keywords=barbers"],
  ["British Chambers of Commerce", "https://www.britishchambers.org.uk", "Business & economy", "https://www.britishchambers.org.uk/feed/"],

  // ---- Sector and market press (verified feeds; competitors labelled) ----
  ["BarberEVO", "https://barberevo.com", "Sector press (competitor)", "https://barberevo.com/feed/"],
  ["Professional Beauty", "https://professionalbeauty.co.uk", "Sector press (competitor)", "https://www.professionalbeauty.co.uk/rss"],
  ["Hairdressers Journal", "https://hji.co.uk", "Sector press (competitor)", "https://www.hji.co.uk/rss"],
  ["Scratch", "https://www.scratchmagazine.co.uk", "Sector press (competitor)", "https://www.scratchmagazine.co.uk/feed/"],
  ["Salon Business", "https://salonbusiness.co.uk", "Sector press (competitor)", "https://salonbusiness.co.uk/feed/"],
  ["Estetica", "https://www.esteticamagazine.com", "Sector press (competitor)", "https://www.esteticamagazine.com/feed/"],
  ["TheIndustry.beauty", "https://theindustry.beauty", "Sector press (competitor)", "https://theindustry.beauty/feed/"],
  ["Cosmetics Business", "https://www.cosmeticsbusiness.com", "Market press", "https://www.cosmeticsbusiness.com/rss"],
  ["GCI Magazine", "https://www.gcimagazine.com", "Market press", "https://www.gcimagazine.com/__rss/website-scheduled-content.xml?input=%7B%22sectionAlias%22%3A%22home%22%7D"],
  ["Mintel press centre", "https://www.mintel.com", "Market data", "https://www.mintel.com/press-centre/feed/"],
  ["SmallBusiness.co.uk", "https://smallbusiness.co.uk", "Business & economy", "https://smallbusiness.co.uk/feed/"],

  // ---- Brand newsrooms (verified feeds) ----
  ["Reuzel", "https://reuzel.com", "Grooming brands", "https://reuzel.com/blogs/news.atom"],
  ["The Bluebeards Revenge", "https://www.bluebeards-revenge.co.uk", "Grooming brands", "https://www.bluebeards-revenge.co.uk/blogs/blog.atom"],
  ["Uppercut Deluxe", "https://uppercutdeluxe.com", "Grooming brands", "https://uppercutdeluxe.com/blogs/blog.atom"],
  ["Captain Fawcett", "https://captainfawcett.com", "Grooming brands", "https://captainfawcett.com/blogs/the-captains-journal.atom"],
  ["StyleCraft", "https://stylecraftus.com", "Clippers & tools", "https://stylecraftus.com/blogs/posts.atom"],
  ["Denman", "https://denmanbrush.com", "Clippers & tools", "https://denmanbrush.com/blogs/news.atom"],
  ["REM UK", "https://www.rem.co.uk", "Furniture & fit-out", "https://www.rem.co.uk/feed/"],

  // ---- Wholesale, software, services, data (verified feeds) ----
  ["Barber Temple", "https://barbertemple.co.uk", "Wholesale", "https://barbertemple.co.uk/blogs/news.atom"],
  ["Phorest", "https://www.phorest.com", "Software & booking", "https://www.phorest.com/blog/feed/"],
  ["Treatwell", "https://www.treatwell.co.uk", "Software & booking", "https://www.treatwell.co.uk/treatment-files/feed/"],
  ["TiPJAR", "https://wearetipjar.com", "Payments & tipping", "https://wearetipjar.com/feed/"],
  ["Salon Gold", "https://www.salongold.co.uk", "Insurance & services", "https://www.salongold.co.uk/blog/feed/"],
  ["Simply Business", "https://www.simplybusiness.co.uk", "Insurance & services", "https://www.simplybusiness.co.uk/feed/"],
  ["Green Street EU (ex-LDC)", "https://eu.greenstreet.com", "High street data", "https://eu.greenstreet.com/feed/"],

  // ---- No feed, but load-bearing: hub-only + outreach/backlink targets ----
  // The advertiser map's biggest names publish no feeds at all. Autodiscovery
  // gets a second chance at them, and every row doubles as a prospect.
  ["Wahl UK", "https://www.wahl.co.uk", "Clippers & tools"],
  ["Andis", "https://andis.com", "Clippers & tools"],
  ["BaByliss Pro UK", "https://www.babylisspro.co.uk", "Clippers & tools"],
  ["JRL UK", "https://jrluk.co.uk", "Clippers & tools"],
  ["Kent Brushes", "https://kentbrushes.com", "Clippers & tools"],
  ["American Crew", "https://www.americancrew.com", "Grooming brands"],
  ["Slick Gorilla", "https://slickgorilla.co.uk", "Grooming brands"],
  ["Dapper Dan", "https://dapperdan.co.uk", "Grooming brands"],
  ["Morgan's Pomade", "https://www.morganspomade.co.uk", "Grooming brands"],
  ["Proraso", "https://uk.proraso.com", "Shaving"],
  ["Takara Belmont UK", "https://www.takarahairdressing.co.uk", "Furniture & fit-out"],
  ["WBX", "https://www.wbxonline.com", "Furniture & fit-out"],
  ["Salons Direct", "https://www.salonsdirect.co.uk", "Wholesale"],
  ["Coolblades", "https://www.coolblades.co.uk", "Wholesale"],
  ["Capital Hair & Beauty", "https://www.capitalhairandbeauty.co.uk", "Wholesale"],
  ["Booksy", "https://booksy.com", "Software & booking"],
  ["Fresha", "https://www.fresha.com", "Software & booking"],
  ["Squire", "https://getsquire.com", "Software & booking"],
  ["Vagaro", "https://www.vagaro.com", "Software & booking"],
  ["Nearcut", "https://www.nearcut.com", "Software & booking"],
  ["SumUp", "https://www.sumup.com", "Payments & tipping"],
  ["Square UK", "https://squareup.com/gb", "Payments & tipping"],
  ["Zettle", "https://www.zettle.com", "Payments & tipping"],
  ["EasyTip", "https://www.easytip.net", "Payments & tipping"],
  ["Ripe Insurance", "https://www.ripeinsurance.co.uk", "Insurance & services"],
  ["London School of Barbering", "https://www.londonschoolofbarbering.com", "Training & qualifications"],
  ["Menspire Academy", "https://menspireacademy.com", "Training & qualifications"],
  ["TotalBarber Academy", "https://totalbarberacademy.com", "Training & qualifications"],
  ["Great British Barber Bash", "https://www.greatbritishbarberbash.co.uk", "Events"],
  ["Barber Connect", "https://www.barberconnect.co.uk", "Events"],
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
            ? "Seeded from scripts/seed-barbering-sources.mjs. Feed verified by hand 21 Aug 2026 (docs/barbering-business-sources.md)."
            : "Seeded from scripts/seed-barbering-sources.mjs (title #4 advertiser map). No feed found 21 Aug 2026; hub autodiscovery + outreach target.",
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
