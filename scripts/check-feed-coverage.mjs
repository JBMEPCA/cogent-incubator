// Which of a title's sources are actually being read?
//
//   node --import ./scripts/_register.mjs scripts/check-feed-coverage.mjs
//   node --import ./scripts/_register.mjs scripts/check-feed-coverage.mjs fleet-magazine
//
// Read-only. Reproduces the exact queries in app/api/cron/scan-feeds and shows
// where every brand lands, so "we have 97 sources" can be checked against how
// many of them a scan can see.
//
// It exists because that gap was invisible and large. `NOT { feedUrl: { startsWith } }`
// is NULL, not true, for a brand with no feedUrl, so the rotation query silently
// dropped every source that had never had a feed discovered — and discovery only
// happened inside the rotation. 68 of Fleet's 97 sources, including all four of
// its trade bodies, were unreachable by construction while the settings page
// showed them present and correct. Nothing errored; the numbers simply never
// added up, and nothing was adding them up.
//
// The last column is the check that matters: accounted must equal total.
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { prisma, forSite } = await import("../lib/prisma.js");

// Kept in step with app/api/cron/scan-feeds/route.js by hand. If they drift,
// this script reports on a scan that is not the one running.
const isSearch = { feedUrl: { startsWith: "https://news.google.com/rss/search" } };
const isRotation = { OR: [{ feedUrl: null }, { NOT: isSearch }] };

const onlySlug = process.argv[2];
const sites = await prisma.site.findMany({
  where: onlySlug ? { slug: onlySlug } : {},
  orderBy: { createdAt: "asc" },
});

for (const site of sites) {
  const db = forSite(site.id);
  const [total, searches, known, awaiting, noHub, empty, errored] = await Promise.all([
    db.prBrand.count(),
    db.prBrand.count({ where: isSearch }),
    db.prBrand.count({ where: { ...isRotation, newsHubUrl: { not: null }, lastScannedAt: { not: null } } }),
    db.prBrand.count({ where: { ...isRotation, newsHubUrl: { not: null }, lastScannedAt: null } }),
    db.prBrand.count({ where: { ...isRotation, newsHubUrl: null } }),
    db.prBrand.count({ where: { feedStatus: "empty" } }),
    db.prBrand.count({ where: { feedStatus: "error" } }),
  ]);
  const accounted = searches + known + awaiting + noHub;

  const week = new Date(Date.now() - 7 * 864e5);
  const [items, itemsWeek, live] = await Promise.all([
    db.feedItem.count(),
    db.feedItem.count({ where: { discoveredAt: { gte: week } } }),
    db.feedItem.count({ where: { status: "new" } }),
  ]);

  console.log(`\n=== ${site.name} (${site.slug}) ===`);
  console.log(`  sources          ${total}`);
  console.log(`  · news searches  ${searches}   scanned every run`);
  console.log(`  · known feeds    ${known}   in the hourly rotation`);
  console.log(`  · awaiting first ${awaiting}   queued for discovery, 8 a run`);
  console.log(`  · no news hub    ${noHub}   nothing to scan; mentions and contacts only`);
  console.log(`  accounted        ${accounted}/${total}  ${accounted === total ? "OK" : "<-- SOURCES ARE FALLING THROUGH THE SCAN QUERIES"}`);
  if (empty || errored) console.log(`  needs attention  ${empty} feed(s) parse to nothing, ${errored} erroring`);
  console.log(`  feed items       ${items} total, ${itemsWeek} in the last 7 days, ${live} unread`);

  // The sources a trade title is least able to do without, listed by name
  // rather than counted: two working feeds out of six reads as fine in a total.
  const bodies = await db.prBrand.findMany({
    where: { category: { contains: "rade bod" } },
    orderBy: { name: "asc" },
    select: { name: true, feedStatus: true, lastScannedAt: true, _count: { select: { feedItems: true } } },
  });
  if (bodies.length) {
    console.log(`  trade bodies:`);
    for (const b of bodies) {
      const live = b._count.feedItems;
      console.log(
        `    ${(b.feedStatus || "NEVER SCANNED").padEnd(14)} ${String(live).padStart(4)} items  ${b.name}`
      );
    }
  }
}

await prisma.$disconnect();
