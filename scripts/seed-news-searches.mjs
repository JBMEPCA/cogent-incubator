// Widen one title's newswire without adding a single company relationship.
//
// Two jobs, both idempotent and safe to re-run:
//
//   1. Seed that title's standing news searches as PrBrand rows. Their feedUrl
//      is set directly, so the scanner skips discovery and starts pulling on its
//      next pass.
//
//   2. Backfill newsHubUrl for that title's sources that have none. The scan
//      cron filters on `newsHubUrl: { not: null }`, so a source without one is
//      invisible to the rotation and has never been scanned even once. Pointing
//      it at the site root is enough: lib/feeds.js already tries /feed, /rss,
//      /rss.xml, /feed.xml, /atom.xml, /blog/feed and /news/feed off the origin.
//
//   node scripts/seed-news-searches.mjs --site=fleet-magazine
//   node scripts/seed-news-searches.mjs --site=fleet-magazine --dry-run
//
// WHY --site IS REQUIRED. This script predated multi-tenancy: it matched PrBrand
// rows on name alone and created them with no siteId at all, which on a fleet of
// titles means one title's wire silently becomes every title's wire. PrBrand is
// tenanted, so every query below carries an explicit siteId. It uses the bare
// client rather than forSite(), so there is no guard to catch a mistake here —
// that is exactly why the siteId is threaded by hand and the script refuses to
// run without one.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  NEWS_SEARCHES,
  FLEET_NEWS_SEARCHES,
  GOLF_NEWS_SEARCHES,
  BARBERING_NEWS_SEARCHES,
  AIRPORT_NEWS_SEARCHES,
  searchFeedUrl,
  searchHubUrl,
} from "../lib/news-searches.js";

// Which set belongs to which title. Keyed by slug because the wrong set is not a
// degraded outcome, it is a title full of another sector's news: seeding the
// fleet magazine from NEWS_SEARCHES would fill it with "small business" queries.
const SEARCH_SETS = {
  "smart-sme": NEWS_SEARCHES,
  "fleet-magazine": FLEET_NEWS_SEARCHES,
  "golf-resort-magazine": GOLF_NEWS_SEARCHES,
  "barbering-business": BARBERING_NEWS_SEARCHES,
  "airport-business-magazine": AIRPORT_NEWS_SEARCHES,
};

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry-run");
const slug = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1];

if (!slug) {
  console.error("Refusing to run without --site=<slug>.");
  console.error("Known sets: " + Object.keys(SEARCH_SETS).join(", "));
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) throw new Error(`No title with slug "${slug}"`);

  const searches = SEARCH_SETS[slug];
  if (!searches) {
    throw new Error(
      `No search set defined for "${slug}". Add one to SEARCH_SETS in this file ` +
        `and to lib/news-searches.js rather than borrowing another title's.`
    );
  }

  console.log(`${site.name} (${slug}) — ${searches.length} standing searches\n`);

  // A category that is not one of this title's sections is not fatal — the
  // Researcher assigns the real section anyway — but it is always a mistake,
  // and silently ignoring it is how a whole beat goes uncovered.
  const sectionNames = new Set((site.sections || []).map((s) => s.name));
  const strays = [...new Set(searches.map((s) => s.category))].filter((c) => !sectionNames.has(c));
  if (strays.length) {
    console.warn(`WARNING: categories not among this title's sections: ${strays.join(", ")}`);
    console.warn(`         sections are: ${[...sectionNames].join(", ")}\n`);
  }

  // --- 1. standing news searches ---------------------------------------
  let created = 0, updated = 0;
  for (const s of searches) {
    // s.locale is undefined for the two UK titles, which keeps them on the GB
    // edition exactly as before. Global titles name an edition per beat.
    const feedUrl = searchFeedUrl(s.query, s.locale);
    const existing = await prisma.prBrand.findFirst({ where: { siteId: site.id, name: s.name } });
    if (existing) {
      if (existing.feedUrl !== feedUrl) {
        if (!DRY) await prisma.prBrand.update({ where: { id: existing.id }, data: { feedUrl } });
        updated++;
      }
      continue;
    }
    if (!DRY) {
      await prisma.prBrand.create({
        data: {
          siteId: site.id,
          name: s.name,
          category: s.category,
          website: "https://news.google.com",
          newsHubUrl: searchHubUrl(s.query, s.locale),
          feedUrl,
          notes: "Standing news search. Defined in lib/news-searches.js.",
        },
      });
    }
    created++;
  }
  console.log(`News searches: ${created} created, ${updated} refreshed, ${searches.length} defined`);

  // --- 2. backfill newsHubUrl ------------------------------------------
  const orphans = await prisma.prBrand.findMany({
    where: { siteId: site.id, newsHubUrl: null, website: { not: null } },
    select: { id: true, website: true },
  });
  let fixed = 0;
  for (const b of orphans) {
    let root;
    try {
      root = new URL(b.website).origin;
    } catch {
      continue; // unparseable website, leave it alone
    }
    if (!DRY) await prisma.prBrand.update({ where: { id: b.id }, data: { newsHubUrl: root } });
    fixed++;
  }

  const stillNull = await prisma.prBrand.count({ where: { siteId: site.id, newsHubUrl: null } });
  console.log(`Backfilled newsHubUrl on ${fixed} source(s); ${stillNull} still have none (no usable website)`);

  const eligible = await prisma.prBrand.count({ where: { siteId: site.id, newsHubUrl: { not: null } } });
  const total = await prisma.prBrand.count({ where: { siteId: site.id } });
  console.log(`\nScannable sources for ${site.name}: ${eligible} of ${total}`);
  if (eligible) {
    console.log(`At 30 scans/hour the rotation takes about ${(eligible / 30 / 24).toFixed(1)} day(s) per full pass.`);
  }
  if (DRY) console.log("\n--- DRY RUN, nothing written ---");
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
