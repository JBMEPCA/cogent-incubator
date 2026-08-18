// Seed Golf Resort Magazine's newswire with direct feeds, trade bodies and the
// advertiser map from the title #3 business case.
//
// WHY THIS ONE CARRIES feedUrl AND THE FLEET SEEDER DID NOT
//
// The playbook's hardest-won lesson from title #2: a Google News query is not a
// source. It yields a headline and a redirect stub, the fetch returns the literal
// string "Google News", and every news rewrite fleet produced scored 42-71 with
// the same complaint — "thin source with no figures limits depth". Direct feeds
// return ~1,600 words of real article. The target is 30+ direct feeds at launch.
//
// seed-fleet-sources.mjs set only `newsHubUrl` and left lib/feeds.js to
// autodiscover, which the playbook measures at roughly a one-in-five hit rate.
// So the feeds below were resolved and tested by hand on 18 Aug 2026 instead:
// every URL in the FEEDS block returned valid RSS/Atom with at least one item.
// Three candidates that parsed but were dead were dropped rather than shipped
// (golfcoursetrades.com/news/feed and ngf.org/feed returned zero items;
// golfindustrycentral.com.au last published in June 2024).
//
// NOTABLE ABSENCES, so nobody wastes an afternoon re-finding them:
//   - Golf Business News is the strongest pure golf-B2B site in the world and has
//     NO feed. It is a JS app; /feed/ 404s. Hub-only below.
//   - Golf Inc advertises /feed/ in its head and then 301s it to an HTML page.
//   - Golf Course Industry serves a bot-block interstitial to non-browser agents.
//   - GCSAA, BIGGA, R&A and USGA advertise no feed at all; USGA returns 403.
//   These four are the sector's most authoritative publishers, which is precisely
//   why the Google News set in lib/news-searches.js is not optional here.
//
//   node scripts/seed-golf-sources.mjs --site=golf-resort-magazine [--dry-run]
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
// A fourth element means the feed was verified by hand and goes straight in.
// Three elements means hub-only: lib/feeds.js autodiscovers, and if it finds
// nothing the row still earns its place as a Backlink Manager target.
const SOURCES = [
  // ---- Golf trade press (verified feeds) ----
  ["Club + Resort Business", "https://clubandresortbusiness.com", "Golf trade press", "https://clubandresortbusiness.com/feed/"],
  ["The Golf Business", "https://thegolfbusiness.co.uk", "Golf trade press", "https://thegolfbusiness.co.uk/feed/"],
  ["The Golf Wire", "https://thegolfwire.com", "Golf trade press", "https://thegolfwire.com/feed/"],
  ["Golfdom", "https://www.golfdom.com", "Golf trade press", "https://www.golfdom.com/feed/"],
  ["Golf Business (NGCOA)", "https://golfbusiness.com", "Golf trade press", "https://golfbusiness.com/feed/"],
  ["Golf Management (EMEA)", "https://www.golfmanagement.online", "Golf trade press", "https://www.golfmanagement.online/feed/"],
  ["LINKS Magazine", "https://linksmagazine.com", "Golf trade press", "https://linksmagazine.com/feed/"],
  ["Golf Range Association", "https://www.golfrange.org", "Golf trade press", "https://www.golfrange.org/feed/"],
  ["Golf Sustainable", "https://golfsustainable.com", "Sustainability", "https://golfsustainable.com/en/feed/"],
  ["TurfNet", "https://www.turfnet.com", "Course & grounds", "https://www.turfnet.com/rss/"],
  ["ASGCA", "https://www.asgca.org", "Development & design", "https://www.asgca.org/feed/"],
  ["Club Industry", "https://www.clubindustry.com", "Club operations", "https://www.clubindustry.com/rss.xml"],
  ["Leisure Opportunities", "https://www.leisureopportunities.co.uk", "Club operations", "https://www.leisureopportunities.co.uk/rss/"],

  // ---- Bodies and federations (verified feeds) ----
  ["European Golf Association", "https://www.ega-golf.ch", "Bodies & data", "https://www.ega-golf.ch/rss.xml"],
  ["Golf Canada", "https://www.golfcanada.ca", "Bodies & data", "https://www.golfcanada.ca/feed/"],

  // ---- Hospitality crossover (verified feeds) ----
  // The commercial thesis of the whole title: a golf resort is a hotel with a
  // very expensive garden, and Hotel Magazine already sells to this half.
  ["Hospitality Net", "https://www.hospitalitynet.org", "Hospitality", "https://www.hospitalitynet.org/rss/news.xml"],
  ["Hotel Dive", "https://www.hoteldive.com", "Hospitality", "https://www.hoteldive.com/feeds/news/"],
  ["Hotel Business", "https://www.hotelbusiness.com", "Hospitality", "https://www.hotelbusiness.com/feed/"],
  ["Hotel Management", "https://www.hotelmanagement.net", "Hospitality", "https://www.hotelmanagement.net/rss.xml"],
  ["Boutique Hotel News", "https://boutiquehotelnews.com", "Hospitality", "https://boutiquehotelnews.com/feed/"],
  ["Hospitality Investor", "https://www.hospitalityinvestor.com", "Investment", "https://www.hospitalityinvestor.com/rss.xml"],
  ["Skift", "https://skift.com", "Travel trade", "https://skift.com/feed/"],

  // ---- Vendor content programmes (verified feeds) ----
  // Every vendor running a content programme has a proven budget and a proven
  // belief in this audience. Source and prospect are the same row.
  ["Lightspeed Golf", "https://www.lightspeedhq.com", "Technology", "https://www.lightspeedhq.com/blog/feed/"],

  // ---- Consumer titles: BUSINESS STORIES ONLY ----
  // These break real trade news (course closures, green-fee inflation, club
  // finances) that the trade press is too slow or too close to cover. They are
  // also the single biggest contamination risk on the title — see the buyer rule
  // in docs/editorial-standard.md. Kept deliberately, labelled loudly.
  ["Golf Monthly", "https://www.golfmonthly.com", "Consumer title (business only)", "https://www.golfmonthly.com/feeds/all"],
  ["National Club Golfer", "https://www.nationalclubgolfer.com", "Consumer title (business only)", "https://www.nationalclubgolfer.com/feed/"],
  ["GOLF.com", "https://golf.com", "Consumer title (business only)", "https://golf.com/feed/"],
  ["bunkered", "https://www.bunkered.co.uk", "Consumer title (business only)", "https://www.bunkered.co.uk/feed/"],
  ["Your Golf Travel — 19th Hole", "https://www.yourgolftravel.com", "Consumer title (business only)", "https://www.yourgolftravel.com/19th-hole/feed/"],

  // ---- No feed, but authoritative: hub-only + Backlink Manager targets ----
  ["Golf Business News", "https://golfbusinessnews.com", "Golf trade press"],
  ["Golf Inc", "https://golfincmagazine.com", "Golf trade press"],
  ["Golf Course Industry", "https://www.golfcourseindustry.com", "Course & grounds"],
  ["Golf Course Architecture", "https://www.golfcoursearchitecture.net", "Development & design"],
  ["GCSAA", "https://www.gcsaa.org", "Bodies & data"],
  ["BIGGA", "https://www.bigga.org.uk", "Bodies & data"],
  ["The R&A", "https://www.randa.org", "Bodies & data"],
  ["USGA", "https://www.usga.org", "Bodies & data"],
  ["National Golf Foundation", "https://www.ngf.org", "Bodies & data"],
  ["IAGTO", "https://www.iagto.com", "Travel trade"],
  ["IGTM", "https://www.igtmarket.com", "Travel trade"],
  ["GEO Foundation", "https://sustainable.golf", "Sustainability"],
  ["EIGCA", "https://www.eigca.org", "Development & design"],

  // ---- Advertiser map: turf, irrigation and agronomy ----
  ["Toro", "https://www.toro.com", "Turf machinery"],
  ["John Deere Golf", "https://www.deere.com", "Turf machinery"],
  ["Jacobsen (Textron)", "https://www.jacobsen.com", "Turf machinery"],
  ["Husqvarna", "https://www.husqvarna.com", "Turf machinery"],
  ["Rain Bird", "https://www.rainbird.com", "Irrigation"],
  ["Hunter Industries", "https://www.hunterindustries.com", "Irrigation"],
  ["Syngenta Turf", "https://www.syngenta.com", "Agronomy"],
  ["ICL Growing Solutions", "https://icl-growingsolutions.com", "Agronomy"],

  // ---- Advertiser map: golf cars, tech and revenue ----
  ["Club Car", "https://www.clubcar.com", "Golf cars"],
  ["E-Z-GO", "https://www.ezgo.txtsv.com", "Golf cars"],
  ["TrackMan", "https://www.trackman.com", "Technology"],
  ["Toptracer", "https://toptracer.com", "Technology"],
  ["Golf Genius", "https://www.golfgenius.com", "Technology"],
  ["Jonas Club Software", "https://www.jonasclub.com", "Technology"],
  ["Teesnap", "https://www.teesnap.com", "Technology"],
  ["Sagacity Golf", "https://www.sagacitygolf.com", "Revenue management"],
  ["Priswing", "https://www.priswing.com", "Revenue management"],
  ["GolfBack", "https://golfbacksolutions.com", "Revenue management"],
  ["GolfNow", "https://www.golfnow.com", "Distribution"],
  ["Golfbreaks", "https://www.golfbreaks.com", "Travel trade"],

  // ---- Advertiser map: operators, owners and advisory ----
  ["Troon", "https://www.troon.com", "Management companies"],
  ["Arcis Golf", "https://www.arcisgolf.com", "Management companies"],
  ["Invited Clubs", "https://www.invitedclubs.com", "Management companies"],
  ["KSL Capital Partners", "https://www.kslcapital.com", "Investment"],
  ["CBRE Golf & Resort", "https://www.cbre.com", "Investment"],
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
            ? "Seeded from scripts/seed-golf-sources.mjs. Feed verified by hand 18 Aug 2026."
            : "Seeded from scripts/seed-golf-sources.mjs (title #3 advertiser map). No feed found; hub autodiscovery + outreach target.",
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
