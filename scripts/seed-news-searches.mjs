// Widen the newswire without adding a single new company relationship.
//
// Two jobs, both idempotent and safe to re-run:
//
//   1. Seed the standing news searches in lib/news-searches.js as PrBrand rows.
//      Their feedUrl is set directly, so the scanner skips discovery and starts
//      pulling on its next pass.
//
//   2. Backfill newsHubUrl for sources that have none. The scan cron filters on
//      `newsHubUrl: { not: null }`, so a source without one is invisible to the
//      rotation and has never been scanned even once. Pointing it at the site
//      root is enough: lib/feeds.js already tries /feed, /rss, /rss.xml,
//      /feed.xml, /atom.xml, /blog/feed and /news/feed off the origin.
//
//   node scripts/seed-news-searches.mjs            # apply
//   node scripts/seed-news-searches.mjs --dry-run  # report only
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { NEWS_SEARCHES, searchFeedUrl, searchHubUrl } from "../lib/news-searches.js";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

try {
  // --- 1. standing news searches ---------------------------------------
  let created = 0, updated = 0;
  for (const s of NEWS_SEARCHES) {
    const feedUrl = searchFeedUrl(s.query);
    const existing = await prisma.prBrand.findFirst({ where: { name: s.name } });
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
          name: s.name,
          category: s.category,
          website: "https://news.google.com",
          newsHubUrl: searchHubUrl(s.query),
          feedUrl,
          notes: "Standing news search. Defined in lib/news-searches.js.",
        },
      });
    }
    created++;
  }
  console.log(`News searches: ${created} created, ${updated} refreshed, ${NEWS_SEARCHES.length} defined`);

  // --- 2. backfill newsHubUrl ------------------------------------------
  const orphans = await prisma.prBrand.findMany({
    where: { newsHubUrl: null, website: { not: null } },
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

  const stillNull = await prisma.prBrand.count({ where: { newsHubUrl: null } });
  console.log(`Backfilled newsHubUrl on ${fixed} source(s); ${stillNull} still have none (no usable website)`);

  const eligible = await prisma.prBrand.count({ where: { newsHubUrl: { not: null } } });
  const total = await prisma.prBrand.count();
  console.log(`\nScannable sources: ${eligible} of ${total}`);
  console.log(`At 30 scans/hour the rotation now takes about ${(eligible / 30 / 24).toFixed(1)} day(s) per full pass.`);
  if (DRY) console.log("\n--- DRY RUN, nothing written ---");
} catch (e) {
  console.error("FAILED: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
