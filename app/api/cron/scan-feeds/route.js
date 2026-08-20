import { forEachSite, cronGuard } from "@/lib/cron";
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
// Brands that have never been scanned, and so need feed DISCOVERY rather than a
// feed fetch: up to eight guessed URLs each, against a host that may well not
// answer. Held to a small quota per run so the backlog drains steadily without
// the working sources paying for it. At eight a run it clears Fleet's 55 in
// seven hours and Smart SME's 789 in four days, which is the right trade.
const DISCOVERY_PER_RUN = 8;
// Sequential scanning spent the whole budget waiting on dead hosts: the measured
// rate was ~6 sources an hour against a config that allows 30. Nearly all of that
// is idle socket time, so a small pool multiplies throughput without adding load
// worth worrying about.
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 45_000;

const isSearch = { feedUrl: { startsWith: "https://news.google.com/rss/search" } };

// NOT isSearch is not the opposite of isSearch, and the gap swallowed most of
// the fleet's source list.
//
// `NOT { feedUrl: { startsWith: X } }` compiles to `NOT (feedUrl LIKE 'X%')`,
// and in SQL that is NULL for a NULL feedUrl, not true. So every brand that had
// never had a feed discovered was excluded from the rotation — and a brand is
// only ever given a feedUrl BY the rotation. Nothing new could ever be scanned:
// discovery ran solely on brands that no longer needed it.
//
// It hid 68 of Fleet's 97 sources, 30 of Golf's 88 and 789 of Smart SME's, and
// among Fleet's were all four of its trade bodies, which is the difference
// between a trade title and a press-release feed. Written out longhand rather
// than with NOT so the NULL case is stated instead of assumed.
const isRotation = { OR: [{ feedUrl: null }, { NOT: isSearch }] };

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
  const denied = cronGuard(request);
  if (denied) return denied;

  // The time budget is shared across the whole fleet, not per title, so a
  // long tail of dead hosts on title #1 cannot starve title #12 entirely.
  const deadline = Date.now() + TIME_BUDGET_MS;

  const out = await forEachSite(async ({ db }) => {

  const [searches, rotation, discovery] = await Promise.all([
    db.prBrand.findMany({ where: isSearch }),
    // Sources whose feed is already known: one fetch each, and the ones the
    // title actually runs on.
    db.prBrand.findMany({
      where: { ...isRotation, newsHubUrl: { not: null }, lastScannedAt: { not: null } },
      orderBy: [{ lastScannedAt: "asc" }],
      take: ROTATION_PER_RUN,
    }),
    // Sources nobody has looked at yet. Kept to a separate, smaller quota
    // rather than merged into the rotation with nulls-first: unblocking the
    // query above put 789 never-scanned brands at the head of Smart SME's
    // queue, and at thirty a run they would have held every working feed off
    // the air for a day. Oldest first, so a title's original source list is
    // worked through in the order it was written.
    db.prBrand.findMany({
      where: { ...isRotation, newsHubUrl: { not: null }, lastScannedAt: null },
      orderBy: [{ createdAt: "asc" }],
      take: DISCOVERY_PER_RUN,
    }),
  ]);

  // Searches first: if the budget runs out, it must be the rotation that waits.
  // Discovery last, because it is the most expensive per brand and the least
  // urgent — a source that has been unread for three days can be unread for
  // one more hour, whereas a wire item goes stale by lunchtime.
  const outcomes = [
    ...((await pool(searches, CONCURRENCY, deadline, (b) => scanBrand(db, b))) || []),
    ...((await pool(rotation, CONCURRENCY, deadline, (b) => scanBrand(db, b))) || []),
    ...((await pool(discovery, CONCURRENCY, deadline, (b) => scanBrand(db, b))) || []),
  ];

  const tally = (s) => outcomes.filter((r) => r?.status === s).length;
  return {
    scanned: outcomes.length,
    searchesScanned: Math.min(searches.length, outcomes.length),
    ok: tally("ok"),
    none: tally("none"),
    // A feed that parses to nothing. Was counted as ok, which is how a source
    // showed a green tick for days without ever producing an item.
    empty: tally("empty"),
    error: tally("error"),
    // What the run did NOT get to. The old report could not tell a quiet hour
    // from a budget that ran out three brands in.
    discoveryQueued: discovery.length,
    unscanned: searches.length + rotation.length + discovery.length - outcomes.length,
    itemsAdded: outcomes.reduce((n, r) => n + (r?.added || 0), 0),
    baselined: outcomes.reduce((n, r) => n + (r?.baselined || 0), 0),
    msElapsed: TIME_BUDGET_MS - (deadline - Date.now()),
  };
  });

  return Response.json(out);
}
