// Every title's numbers, side by side.
//
// The per-title Analytics tab answers "how is this magazine doing". This
// answers "how is the operation doing, and which title is carrying it" — which
// is a different question the moment there is more than one, and the one that
// decides where the next hour of editorial effort goes.
//
// Two sources, deliberately kept apart:
//
//   Editorial figures come from our own database and are exact.
//   Audience figures come from Google, per title, and are only as complete as
//   the integrations are. A title with no GA4 property is not a title with no
//   readers, so it reads as "not connected" everywhere rather than as a zero.
import { fleetRead } from "./prisma";
import { siteCredentials } from "./site";
import { fetchAnalytics, analyticsConfig } from "./analytics";
import { fleetSnapshot } from "./fleet";

// The window every Google figure on the page is measured over. Has to match
// WINDOW in lib/analytics.js, or the editorial column and the audience columns
// beside it would be counting different months.
const WINDOW_DAYS = 28;

// Google is called once per title, so a fleet of thirty would open thirty sets
// of requests at once and meet the rate limiter rather than going faster. Four
// at a time keeps a small fleet effectively parallel and a large one polite.
const CONCURRENCY = 4;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const sum = (rows, pick) => rows.reduce((n, r) => n + (pick(r) || 0), 0);

// Impression-weighted, the way Search Console itself averages position and the
// way lib/analytics.js does it within a title: a title seen 40,000 times at 12
// and one seen 40 times at 90 averages near 12, not near 51.
function weighted(rows, value, weight) {
  const total = sum(rows, weight);
  if (!total) return null;
  return sum(rows, (r) => (value(r) || 0) * (weight(r) || 0)) / total;
}

/** Fold per-title daily series into one fleet series, summed by date. */
function mergeSeries(seriesList, keys) {
  const byDate = new Map();
  for (const series of seriesList) {
    for (const point of series || []) {
      const row =
        byDate.get(point.date) || { date: point.date, ...Object.fromEntries(keys.map((k) => [k, 0])) };
      for (const k of keys) row[k] += point[k] || 0;
      byDate.set(point.date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Everything, for every title, in one call.
 *
 * Editorial counts are grouped queries across the whole fleet rather than one
 * query per title, same as fleetSnapshot. The Google half genuinely is per
 * title — the properties are separate and there is no fleet-wide endpoint to
 * ask — but it is cached for fifteen minutes inside lib/analytics.js, so the
 * cost is paid a few times an hour rather than on every visit.
 */
export async function fleetAnalytics() {
  const snapshot = await fleetSnapshot();
  const sites = snapshot.sites;
  if (!sites.length) {
    return {
      windowDays: WINDOW_DAYS,
      rows: [],
      titleOrder: [],
      totals: null,
      trend: { search: [], audience: [] },
      channels: [],
      topPages: [],
      topQueries: [],
      connected: { gsc: 0, ga4: 0, total: 0 },
    };
  }

  const db = fleetRead();
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 864e5);

  // Published over the analytics window, so the editorial column and the
  // audience columns beside it measure the same 28 days. fleetSnapshot's own
  // count is seven days, which is the right number for the overview card and
  // the wrong one to sit next to a 28-day clicks figure.
  const publishedWindow = await db.article.groupBy({
    by: ["siteId"],
    where: { publishedAt: { gte: windowStart } },
    _count: { _all: true },
  });
  const pubWindow = Object.fromEntries(publishedWindow.map((r) => [r.siteId, r._count._all]));

  const rows = await mapLimit(sites, CONCURRENCY, async (site) => {
    let analytics;
    try {
      const { creds } = await siteCredentials(site.id);
      analytics = await fetchAnalytics(creds.google_analytics);
    } catch (err) {
      // One title's credentials failing to decrypt must not blank the fleet.
      analytics = { config: analyticsConfig(null), gsc: null, ga4: null, errors: [err.message] };
    }
    return {
      id: site.id,
      slug: site.slug,
      name: site.name,
      status: site.status,
      accentHex: site.accentHex,
      engineEnabled: site.engineEnabled,
      createdAt: site.createdAt,
      publishedWindow: pubWindow[site.id] || 0,
      publishedWeek: site.stats.publishedWeek,
      pipeline: site.stats.pipeline,
      awaiting: site.stats.awaiting,
      blocked: site.stats.blocked,
      spendMonth: site.stats.spendMonth,
      lastPublishedAt: site.stats.lastPublishedAt,
      config: analytics.config,
      gsc: analytics.gsc,
      ga4: analytics.ga4,
      errors: analytics.errors,
    };
  });

  const withGsc = rows.filter((r) => r.gsc);
  const withGa4 = rows.filter((r) => r.ga4);

  // Fleet-level change is measured on the full 28-day window against the 28
  // before it, from each title's own `prev` totals. Deliberately not the
  // `compare` block the per-title page uses: that narrows to seven days for a
  // title too young to have a previous month, and folding a seven-day title
  // into a 28-day fleet figure would quietly understate the whole comparison.
  const totals = {
    // Editorial — exact, every title counted.
    publishedWindow: sum(rows, (r) => r.publishedWindow),
    publishedWeek: snapshot.totals.publishedWeek,
    pipeline: sum(rows, (r) => r.pipeline),
    awaiting: snapshot.totals.awaiting,
    blocked: snapshot.totals.blocked,
    spendMonth: snapshot.totals.spendMonth,

    // Search — only the titles Search Console can see.
    clicks: sum(withGsc, (r) => r.gsc.clicks),
    impressions: sum(withGsc, (r) => r.gsc.impressions),
    position: weighted(withGsc, (r) => r.gsc.position, (r) => r.gsc.impressions),
    prevClicks: sum(withGsc, (r) => r.gsc.prev?.clicks),
    prevImpressions: sum(withGsc, (r) => r.gsc.prev?.impressions),
    prevPosition: weighted(withGsc, (r) => r.gsc.prev?.position, (r) => r.gsc.prev?.impressions),

    // Audience — only the titles GA4 can see. A reader who visits two titles
    // counts once in each, because the properties are separate and there is no
    // identifier shared across them. At fleet level this is a sum of audiences
    // rather than a deduplicated one, which is the honest reading of what
    // separate magazines are.
    users: sum(withGa4, (r) => r.ga4.users),
    sessions: sum(withGa4, (r) => r.ga4.sessions),
    pageViews: sum(withGa4, (r) => r.ga4.pageViews),
    liveUsers: sum(withGa4, (r) => r.ga4.liveUsers),
    prevUsers: sum(withGa4, (r) => r.ga4.prev?.users),
    prevSessions: sum(withGa4, (r) => r.ga4.prev?.sessions),
    prevPageViews: sum(withGa4, (r) => r.ga4.prev?.pageViews),
  };
  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.prevCtr = totals.prevImpressions ? (totals.prevClicks / totals.prevImpressions) * 100 : 0;
  // Session-weighted: a title with 4,000 sessions should move the fleet average
  // far more than one with 40.
  totals.avgDuration = weighted(withGa4, (r) => r.ga4.avgDuration, (r) => r.ga4.sessions) || 0;

  // Sessions by channel, summed across every connected title.
  const channelMap = new Map();
  for (const r of withGa4) {
    for (const c of r.ga4.channels || []) {
      channelMap.set(c.channel, (channelMap.get(c.channel) || 0) + c.sessions);
    }
  }
  const channelTotal = [...channelMap.values()].reduce((a, b) => a + b, 0);
  const channels = [...channelMap]
    .map(([channel, sessions]) => ({
      channel,
      sessions,
      share: channelTotal ? (sessions / channelTotal) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Pages and queries stay attributed to their title rather than being pooled.
  // "/" is the home page of three different magazines, and a query that works
  // for Fleet is a different fact from the same query working for Smart SME.
  //
  // Attributed as siteName/siteSlug, not name/slug: a GA4 page row already has
  // a `title` of its own — the page title — and spreading the magazine over it
  // would silently relabel every row with the name of its magazine.
  const topPages = withGa4
    .flatMap((r) =>
      (r.ga4.topPages || []).map((p) => ({ ...p, siteName: r.name, siteSlug: r.slug, accentHex: r.accentHex }))
    )
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  const topQueries = withGsc
    .flatMap((r) =>
      (r.gsc.topQueries || []).map((q) => ({ ...q, siteName: r.name, siteSlug: r.slug, accentHex: r.accentHex }))
    )
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 12);

  // The order the charts assign colour from — oldest title first, and fixed.
  //
  // Taken before the sort below on purpose. Every other ordering on this page
  // moves: rows sort by audience, fleetSnapshot sorts by what needs attention.
  // Assigning colour from a moving order would repaint every chart the moment
  // a title overtook another, and the four donuts would stop agreeing with
  // each other about which colour Smart SME is.
  const titleOrder = [...rows]
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map((r) => r.slug);

  // Biggest audience first. A title with no GA4 yet falls to the bottom on
  // users and is ordered by output instead, so it never sits above a title
  // that is genuinely being read.
  rows.sort((a, b) => (b.ga4?.users || 0) - (a.ga4?.users || 0) || b.publishedWindow - a.publishedWindow);

  return {
    windowDays: WINDOW_DAYS,
    rows,
    titleOrder,
    totals,
    trend: {
      search: mergeSeries(withGsc.map((r) => r.gsc.trend), ["clicks", "impressions"]),
      audience: mergeSeries(withGa4.map((r) => r.ga4.trend), ["users", "pageViews"]),
    },
    channels,
    topPages,
    topQueries,
    connected: { gsc: withGsc.length, ga4: withGa4.length, total: rows.length },
  };
}
