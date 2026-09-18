// Seed Dental Business News's newswire with direct feeds, regulators, trade
// bodies, deal advisers and the advertiser map from the dental business case
// (docs/vertical-brief-dental.md).
//
// Same structure as the other titles' source seeds, same lesson behind it: a Google
// News query is not a source, direct feeds return real articles, and the
// launch target is 30+ verified feeds. Every URL in the FEEDS rows below was
// fetched on 18 Sep 2026 and returned valid RSS/Atom with items
// (docs/dental-business-news-sources.md holds the verification record with
// newest-item dates and median body length).
//
// THE SEAM MATTERS MORE THAN THE COUNT. The brief found that UK practice sales
// and group deals do not reach Google News, and that roughly 40% of what does
// reach it is Dentistry.co.uk or BDA copy. So the rows that carry this title are
// the ones nobody else wires: Dental Group Signal (deals), NASDAL and the
// specialist accountants (profit and goodwill), NHSBSA and NHS England
// (contract data), the devolved governments (four contract regimes), and the
// deal advisers. Dentistry.co.uk is seeded so the Researcher can see what the
// incumbent has covered, never as a source to rewrite.
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them (all probed
// 18 Sep 2026): the GDC, CQC's own site, NHSBSA's own site, the BDA (403 to
// every feed path), Christie & Co, Frank Taylor & Associates, Samera, Denplan,
// Software of Excellence, Dentally, Carestream, Henry Schein (UK and IR, 403),
// Straumann (403), Dental Protection, DDU, MDDUS (403), Braemar Finance (401),
// Wesleyan, Tabeo, Dojo (403), mydentist, Bupa, PortmanDentex, Rodericks,
// Colosseum, the Dentistry Show sites, BDIA Dental Showcase, Scottish
// Government, Public Health Scotland, HIW, The Dentist (403), Dental Review and
// Dental Practice Owner: no working feed. Dental Elite's feed answered once
// then 403'd twice, and BDJ In Practice bounces through a cookie redirect, so
// both are hub-only below. Stale or dead: Dental Tribune (one test item from
// 2021), Dental Products Report (Dec 2024), NHS England statistics feed (Aug
// 2025), Swoop (2020). These are hub-only rows: autodiscovery may find what
// hand-probing missed, and every one earns its place as an outreach target.
//
// COMPETITOR-FLAGGED SOURCES: rows marked "(competitor)" are monitoring
// sources. They tell the Researcher what the incumbents have covered; they are
// not outreach targets and their copy is never a source to rewrite without the
// underlying primary source.
//
// FITNESS-TO-PRACTISE RULE: several regulator feeds (CQC, RQIA, HIS, the
// Scottish Dental feed) will carry named enforcement stories. The editorial
// standard's fitness-to-practise rule governs every one: published
// determinations only, names only as the regulator publishes them, no live
// cases.
//
//   node scripts/seed-dental-business-news-sources.mjs --site=dental-business-news [--dry-run]
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
  // ---- NHS, government and regulators (verified feeds) ----
  ["Dept of Health and Social Care", "https://www.gov.uk/government/organisations/department-of-health-and-social-care", "NHS & policy", "https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom"],
  ["NHS England (gov.uk)", "https://www.gov.uk/government/organisations/nhs-england", "NHS & policy", "https://www.gov.uk/government/organisations/nhs-england.atom"],
  ["NHS England news", "https://www.england.nhs.uk/news/", "NHS & policy", "https://www.england.nhs.uk/news/feed/"],
  ["NHS Business Services Authority (gov.uk)", "https://www.gov.uk/government/organisations/nhs-business-services-authority", "NHS data", "https://www.gov.uk/government/organisations/nhs-business-services-authority.atom"],
  ["gov.uk statistics wire: dental", "https://www.gov.uk/search/research-and-statistics?keywords=dental", "NHS data", "https://www.gov.uk/search/research-and-statistics.atom?keywords=dental&order=updated-newest"],
  ["gov.uk news wire: dental", "https://www.gov.uk/search/news-and-communications?keywords=dental", "NHS & policy", "https://www.gov.uk/search/news-and-communications.atom?keywords=dental&order=updated-newest"],
  ["Care Quality Commission (gov.uk)", "https://www.gov.uk/government/organisations/care-quality-commission", "Regulator", "https://www.gov.uk/government/organisations/care-quality-commission.atom"],
  ["Review Body on Doctors' and Dentists' Remuneration", "https://www.gov.uk/government/organisations/review-body-on-doctors-and-dentists-remuneration", "Pay & workforce", "https://www.gov.uk/government/organisations/review-body-on-doctors-and-dentists-remuneration.atom"],
  ["MHRA", "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency", "Regulator", "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom"],
  ["Competition and Markets Authority", "https://www.gov.uk/government/organisations/competition-and-markets-authority", "Regulator", "https://www.gov.uk/government/organisations/competition-and-markets-authority.atom"],
  ["Welsh Government", "https://www.gov.wales/announcements", "Devolved nations", "https://www.gov.wales/announcements/rss"],
  ["Dept of Health Northern Ireland", "https://www.health-ni.gov.uk", "Devolved nations", "https://www.health-ni.gov.uk/rss.xml"],
  ["RQIA", "https://www.rqia.org.uk", "Devolved nations", "https://www.rqia.org.uk/feed/"],
  ["Healthcare Improvement Scotland", "https://www.healthcareimprovementscotland.scot", "Devolved nations", "https://www.healthcareimprovementscotland.scot/feed/"],
  ["Healthwatch England", "https://www.healthwatch.co.uk", "NHS & policy", "https://www.healthwatch.co.uk/rss.xml"],
  ["House of Commons Library", "https://commonslibrary.parliament.uk", "NHS & policy", "https://commonslibrary.parliament.uk/feed/"],

  // ---- Tax, business, finance and immigration (verified feeds) ----
  ["HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs", "Tax & business", "https://www.gov.uk/government/organisations/hm-revenue-customs.atom"],
  ["HM Treasury", "https://www.gov.uk/government/organisations/hm-treasury", "Tax & business", "https://www.gov.uk/government/organisations/hm-treasury.atom"],
  ["Companies House", "https://www.gov.uk/government/organisations/companies-house", "Tax & business", "https://www.gov.uk/government/organisations/companies-house.atom"],
  ["Insolvency Service", "https://www.gov.uk/government/organisations/insolvency-service", "Tax & business", "https://www.gov.uk/government/organisations/insolvency-service.atom"],
  ["Dept for Business and Trade", "https://www.gov.uk/government/organisations/department-for-business-and-trade", "Tax & business", "https://www.gov.uk/government/organisations/department-for-business-and-trade.atom"],
  ["British Business Bank", "https://www.gov.uk/government/organisations/british-business-bank", "Finance", "https://www.gov.uk/government/organisations/british-business-bank.atom"],
  ["Bank of England", "https://www.bankofengland.co.uk", "Finance", "https://www.bankofengland.co.uk/rss/news"],
  ["Home Office", "https://www.gov.uk/government/organisations/home-office", "Pay & workforce", "https://www.gov.uk/government/organisations/home-office.atom"],
  ["UK Visas and Immigration", "https://www.gov.uk/government/organisations/uk-visas-and-immigration", "Pay & workforce", "https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom"],
  ["Low Pay Commission", "https://www.gov.uk/government/organisations/low-pay-commission", "Pay & workforce", "https://www.gov.uk/government/organisations/low-pay-commission.atom"],
  ["Skills England", "https://www.gov.uk/government/organisations/skills-england", "Pay & workforce", "https://www.gov.uk/government/organisations/skills-england.atom"],

  // ---- Trade bodies and professional associations (verified feeds) ----
  ["Association of Dental Groups", "https://www.theadg.co.uk", "Trade body", "https://www.theadg.co.uk/feed/"],
  ["British Dental Industry Association", "https://bdia.org.uk", "Trade body", "https://bdia.org.uk/feed/"],
  ["ADAM (practice managers)", "https://www.adam-aspire.co.uk", "Trade body", "https://www.adam-aspire.co.uk/feed/"],
  ["NASDAL", "https://nasdal.org.uk", "Accountants & lawyers", "https://nasdal.org.uk/feed/"],
  ["College of General Dentistry", "https://cgdent.uk", "Professional body", "https://cgdent.uk/feed/"],
  ["BSDHT (hygienists and therapists)", "https://www.bsdht.org.uk", "Professional body", "https://www.bsdht.org.uk/feed/"],
  ["Dental Laboratories Association", "https://dla.org.uk", "Trade body", "https://dla.org.uk/feed/"],
  ["Council of European Dentists", "https://www.cedentists.eu", "Professional body", "https://www.cedentists.eu/feed/"],
  ["FDI World Dental Federation", "https://www.fdiworlddental.org", "Professional body", "https://www.fdiworlddental.org/rss.xml"],

  // ---- Sector and market press (verified feeds; competitors labelled) ----
  ["Dentistry.co.uk (FMC)", "https://dentistry.co.uk", "Sector press (competitor)", "https://dentistry.co.uk/feed/"],
  ["The Probe", "https://the-probe.co.uk", "Sector press (competitor)", "https://the-probe.co.uk/feed/"],
  ["Scottish Dental magazine", "https://www.sdmag.co.uk", "Sector press (competitor)", "https://www.sdmag.co.uk/feed/"],
  ["British Dental Journal", "https://www.nature.com/bdj", "Sector press (competitor)", "https://www.nature.com/bdj.rss"],
  ["Dental Group Signal", "https://dentalgroupsignal.substack.com", "Sector press (competitor)", "https://dentalgroupsignal.substack.com/feed"],
  ["Group Dentistry Now (US DSO market)", "https://www.groupdentistrynow.com", "Market press", "https://www.groupdentistrynow.com/feed/"],
  ["LaingBuisson News", "https://www.laingbuissonnews.com", "Market data", "https://www.laingbuissonnews.com/feed/"],

  // ---- Deal advisers, accountants and lawyers (verified feeds) ----
  ["PFM Dental", "https://pfmdental.co.uk", "Brokers & valuers", "https://pfmdental.co.uk/feed/"],
  ["DJH", "https://www.djh.co.uk", "Accountants & lawyers", "https://www.djh.co.uk/feed/"],
  ["Scott Bailey", "https://www.scottbailey.co.uk", "Accountants & lawyers", "https://www.scottbailey.co.uk/feed"],
  ["Blake Morgan", "https://www.blakemorgan.co.uk", "Accountants & lawyers", "https://www.blakemorgan.co.uk/feed/"],

  // ---- Plans, finance, compliance, fit-out, insurance, events (verified feeds) ----
  ["Practice Plan", "https://www.practiceplan.co.uk", "Plans & patient finance", "https://www.practiceplan.co.uk/feed/"],
  ["Medenta", "https://www.medenta.com", "Plans & patient finance", "https://www.medenta.com/feed/"],
  ["Agilio Software", "https://agiliosoftware.com", "Compliance & software", "https://agiliosoftware.com/feed/"],
  ["Anglian Dental", "https://angliandental.co.uk", "Equipment & fit-out", "https://angliandental.co.uk/feed/"],
  ["Dentists' Provident", "https://www.dentistsprovident.co.uk", "Indemnity & insurance", "https://www.dentistsprovident.co.uk/feed"],
  ["Scottish Dental Show", "https://sdshow.co.uk", "Events", "https://sdshow.co.uk/feed/"],

  // ---- No feed, but load-bearing: hub-only + outreach/backlink targets ----
  // Regulators and data owners with no feed. Their news reaches us through the
  // gov.uk atoms above, the NHS England feed and the sector press.
  ["General Dental Council", "https://www.gdc-uk.org", "Regulator"],
  ["Care Quality Commission", "https://www.cqc.org.uk", "Regulator"],
  ["NHS Business Services Authority", "https://www.nhsbsa.nhs.uk", "NHS data"],
  ["British Dental Association", "https://www.bda.org", "Trade body"],
  ["BADN (dental nurses)", "https://www.badn.org.uk", "Trade body"],
  ["Scottish Government", "https://www.gov.scot", "Devolved nations"],
  ["Healthcare Inspectorate Wales", "https://www.hiw.org.uk", "Devolved nations"],
  ["BDJ In Practice", "https://www.nature.com/bdjinpractice", "Sector press (competitor)"],
  ["The Dentist", "https://www.the-dentist.co.uk", "Sector press (competitor)"],
  ["Dental Review", "https://dentalreview.news", "Sector press (competitor)"],
  ["Dental Practice Owner", "https://www.dentalpracticeowner.co.uk", "Sector press (competitor)"],
  // The deal and valuation layer: the SERP owners on our seam, and the first
  // advertiser call list.
  ["Christie & Co", "https://www.christie.com", "Brokers & valuers"],
  ["Frank Taylor & Associates", "https://www.ft-associates.com", "Brokers & valuers"],
  ["Dental Elite", "https://dentalelite.co.uk", "Brokers & valuers"],
  ["Samera", "https://samera.co.uk", "Brokers & valuers"],
  ["Humphrey & Co", "https://www.humph.co.uk", "Accountants & lawyers"],
  ["Hempsons", "https://www.hempsons.co.uk", "Accountants & lawyers"],
  ["Thorntons", "https://www.thorntons-law.co.uk", "Accountants & lawyers"],
  // Groups: the deals tracker's subjects, and buyers of the owner audience.
  ["mydentist", "https://www.mydentist.co.uk", "Dental groups"],
  ["Bupa Dental Care", "https://www.bupa.co.uk/dental", "Dental groups"],
  ["PortmanDentex", "https://www.portmandentex.com", "Dental groups"],
  ["Rodericks Dental Partners", "https://rodericksdentalpartners.co.uk", "Dental groups"],
  ["Colosseum Dental UK", "https://www.colosseumdental.co.uk", "Dental groups"],
  ["Clyde Munro", "https://www.clydemunro.com", "Dental groups"],
  // Plans, software, finance, insurance, kit.
  ["Denplan", "https://www.denplan.co.uk", "Plans & patient finance"],
  ["Tabeo", "https://www.tabeo.co.uk", "Plans & patient finance"],
  ["Software of Excellence", "https://www.softwareofexcellence.com/uk", "Compliance & software"],
  ["Dentally", "https://www.dentally.com/en-gb", "Compliance & software"],
  ["Carestream Dental", "https://www.carestreamdental.com", "Compliance & software"],
  ["Braemar Finance", "https://www.braemarfinance.co.uk", "Finance"],
  ["Wesleyan", "https://www.wesleyan.co.uk", "Finance"],
  ["Dental Protection", "https://www.dentalprotection.org/uk", "Indemnity & insurance"],
  ["DDU", "https://www.theddu.com", "Indemnity & insurance"],
  ["MDDUS", "https://www.mddus.com", "Indemnity & insurance"],
  ["Henry Schein UK", "https://www.henryschein.co.uk", "Equipment & fit-out"],
  ["Belmont Dental", "https://belmontdental.co.uk", "Equipment & fit-out"],
  // Events: exhibitor lists are the advertiser prospect list.
  ["Dentistry Show London", "https://london.dentistryshow.co.uk", "Events"],
  ["British Dental Conference and Dentistry Show", "https://birmingham.dentistryshow.co.uk", "Events"],
  ["BDIA Dental Showcase", "https://dentalshowcase.com", "Events"],
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
            ? "Seeded from scripts/seed-dental-business-news-sources.mjs. Feed verified by hand 18 Sep 2026 (docs/dental-business-news-sources.md)."
            : "Seeded from scripts/seed-dental-business-news-sources.mjs (dental advertiser and source map). No working feed found 18 Sep 2026; hub autodiscovery + outreach target.",
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
