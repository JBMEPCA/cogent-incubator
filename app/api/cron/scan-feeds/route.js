import { prisma } from "@/lib/prisma";
import { scanBrand } from "@/lib/feeds";

export const dynamic = "force-dynamic";
// Hobby plan caps functions at 60s and crons at daily — GitHub Actions
// (.github/workflows/scan-feeds.yml) drives this hourly instead; the Vercel
// daily cron is a backstop.
export const maxDuration = 60;

// Two classes of source, and they want completely different polling.
//
// A standing news search (lib/news-searches.js) is where breaking news actually
// arrives, and it is worthless if polled weekly, so every one is scanned on every
// run. They are also cheap: one fast endpoint, no discovery.
//
// A company press page posts a handful of times a year, so a slow rotation is
// perfectly adequate. Previously both sat in the same oldest-first queue, which
// meant a funding round could sit unseen for a week behind 900 corporate about-us
// pages.
const ROTATION_PER_RUN = 30;
// Sequential scanning spent the whole budget waiting on dead hosts: the measured
// rate was ~6 sources an hour against a config that allows 30. Nearly all of that
// is idle socket time, so a small pool multiplies throughput without adding load
// worth worrying about.
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 45_000;

const isSearch = { feedUrl: { startsWith: "https://news.google.com/rss/search" } };

/** Run `worker` over `items` with a fixed pool, stopping when the budget is spent. */
async function pool(items, size, deadline, worker) {
  const queue = [...items];
  const results = [];
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      if (Date.now() > deadline) return;
      results.push(await worker(queue.shift()));
    }
  });
  await Promise.all(runners);
  return results;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deadline = Date.now() + TIME_BUDGET_MS;

  const [searches, rotation] = await Promise.all([
    prisma.prBrand.findMany({ where: isSearch }),
    prisma.prBrand.findMany({
      where: { newsHubUrl: { not: null }, NOT: isSearch },
      orderBy: [{ lastScannedAt: { sort: "asc", nulls: "first" } }],
      take: ROTATION_PER_RUN,
    }),
  ]);

  // Searches first: if the budget runs out, it must be the rotation that waits.
  const outcomes = [
    ...((await pool(searches, CONCURRENCY, deadline, (b) => scanBrand(prisma, b))) || []),
    ...((await pool(rotation, CONCURRENCY, deadline, (b) => scanBrand(prisma, b))) || []),
  ];

  const tally = (s) => outcomes.filter((r) => r?.status === s).length;
  return Response.json({
    scanned: outcomes.length,
    searchesScanned: Math.min(searches.length, outcomes.length),
    ok: tally("ok"),
    none: tally("none"),
    error: tally("error"),
    itemsAdded: outcomes.reduce((n, r) => n + (r?.added || 0), 0),
    msElapsed: TIME_BUDGET_MS - (deadline - Date.now()),
  });
}
