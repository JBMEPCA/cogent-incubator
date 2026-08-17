import { unstable_cache } from "next/cache";
import { getGoogleAccessToken, googleGet, googlePost, isGoogleConfigured } from "./google";

// Live Search Console + GA4 for smartsme.co.uk, read straight through on page
// render — single-user app, so there is nothing to gain from a cron and a
// stored blob, and this way the numbers are never stale.
//
// The property ids are per title and arrive as the `google_analytics`
// credential: gscSiteUrl (domain properties use the "sc-domain:smartsme.co.uk"
// form) and ga4PropertyId (numeric, from GA4 Admin → Property settings). The
// service-account key behind them is fleet-wide, and has to have been granted
// access in both consoles before either returns anything.

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

// Search Console data lands 2-3 days late, so "current" is the 28 days ending
// 3 days ago, measured against the 28 before that.
const LAG_DAYS = 3;
const WINDOW = 28;
// Fallback comparison window, used while a title is too young to have a
// previous 28 days to measure against.
const RECENT = 7;
// Fetched per dimension, then cut down locally — see pickRows.
const FETCH_ROWS = 250;
const QUERY_ROWS = 14;
const PAGE_ROWS = 10;

const dateStr = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

export function analyticsConfig(ga) {
  return {
    google: isGoogleConfigured(),
    gscSite: ga?.gscSiteUrl || null,
    ga4Property: ga?.ga4PropertyId || null,
  };
}

// ── Search Console ───────────────────────────────────────────────────────────

const mapRows = (res, keyIndex = 0) =>
  (res.rows || []).map((r) => ({
    key: r.keys[keyIndex],
    date: keyIndex > 0 ? r.keys[0] : null,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr * 100,
    position: r.position,
  }));

// Impression-weighted, the way Search Console itself averages position: a query
// seen 300 times at 15 and once at 90 sits near 15, not near 52.
function aggregate(rows) {
  const acc = new Map();
  for (const r of rows) {
    const a = acc.get(r.key) || { clicks: 0, impressions: 0, weighted: 0 };
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.weighted += r.position * r.impressions;
    acc.set(r.key, a);
  }
  return new Map(
    [...acc].map(([k, a]) => [
      k,
      {
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.impressions ? (a.clicks / a.impressions) * 100 : 0,
        position: a.impressions ? a.weighted / a.impressions : 0,
      },
    ])
  );
}

function windowStats(days) {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const d of days) {
    clicks += d.clicks;
    impressions += d.impressions;
    weighted += d.position * d.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    position: impressions ? weighted / impressions : 0,
  };
}

// searchAnalytics.query takes no orderBy — it always returns rows by clicks
// descending. Asking it for twelve rows on a young site therefore returns the
// handful that were clicked followed by an arbitrary tail of zero-click ties,
// which is how the query table filled up with one-impression bot queries while
// the pages driving hundreds of impressions had no visible source. So fetch
// wide and choose here: keep every row that converted, then fill the rest by
// impressions, because those are the near-misses worth writing for.
function pickRows(rows, limit) {
  const clicked = rows
    .filter((r) => r.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
  const rest = rows
    .filter((r) => r.clicks === 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, Math.max(0, limit - clicked.length));
  // Left in two groups rather than merged and re-sorted: a query that converted
  // once off one impression belongs at the top with the other converters, not
  // buried under a hundred-impression row it has nothing to do with.
  return [...clicked, ...rest];
}

async function fetchSearchConsole(token, site) {
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const range = { startDate: dateStr(daysAgo(LAG_DAYS + WINDOW)), endDate: dateStr(daysAgo(LAG_DAYS)) };
  const prevRange = {
    startDate: dateStr(daysAgo(LAG_DAYS + WINDOW * 2)),
    endDate: dateStr(daysAgo(LAG_DAYS + WINDOW + 1)),
  };

  const [cur, prev, byDate, queries, pages, prevQueries, prevPages, countries] = await Promise.all([
    googlePost(token, base, range),
    googlePost(token, base, prevRange),
    googlePost(token, base, { ...range, dimensions: ["date"], rowLimit: 60 }),
    googlePost(token, base, { ...range, dimensions: ["query"], rowLimit: FETCH_ROWS }),
    googlePost(token, base, { ...range, dimensions: ["page"], rowLimit: FETCH_ROWS }),
    googlePost(token, base, { ...prevRange, dimensions: ["query"], rowLimit: FETCH_ROWS }),
    googlePost(token, base, { ...prevRange, dimensions: ["page"], rowLimit: FETCH_ROWS }),
    googlePost(token, base, { ...range, dimensions: ["country"], rowLimit: 6 }),
  ]);

  const totals = (r) => (r.rows && r.rows[0]) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const asTotals = (t) => ({
    clicks: t.clicks,
    impressions: t.impressions,
    ctr: t.ctr * 100,
    position: t.position,
  });
  const c = totals(cur);
  const p = totals(prev);

  const trend = (byDate.rows || []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
  }));

  // A title launched inside the last month has no previous 28-day window at
  // all, so every delta on the page read "no prior data" exactly when the trend
  // was most worth watching. In that case measure the last seven days against
  // the seven before instead — and carry the basis through to the UI, because
  // it is not the same comparison and should not be labelled as one.
  let compare = { basis: "prev 28d", now: asTotals(c), before: asTotals(p) };
  let beforeQueries = aggregate(mapRows(prevQueries));
  let beforePages = aggregate(mapRows(prevPages));
  // null means each row is compared using its own 28-day average position.
  let nowQueries = null;
  let nowPages = null;

  if (p.impressions === 0 && trend.length >= RECENT * 2) {
    const boundary = dateStr(daysAgo(LAG_DAYS + RECENT - 1));
    const sub = { startDate: dateStr(daysAgo(LAG_DAYS + RECENT * 2 - 1)), endDate: range.endDate };
    // Only reachable for a site with no prior 28-day window, so fourteen days of
    // query rows is a small set and the row limit will not bite.
    const [qByDate, pByDate] = await Promise.all([
      googlePost(token, base, { ...sub, dimensions: ["date", "query"], rowLimit: 5000 }),
      googlePost(token, base, { ...sub, dimensions: ["date", "page"], rowLimit: 5000 }),
    ]);
    const split = (rows) => [
      rows.filter((r) => r.date >= boundary),
      rows.filter((r) => r.date < boundary),
    ];
    const [recentQ, earlierQ] = split(mapRows(qByDate, 1));
    const [recentP, earlierP] = split(mapRows(pByDate, 1));
    nowQueries = aggregate(recentQ);
    beforeQueries = aggregate(earlierQ);
    nowPages = aggregate(recentP);
    beforePages = aggregate(earlierP);
    compare = {
      basis: "prev 7d",
      now: windowStats(trend.filter((d) => d.date >= boundary)),
      before: windowStats(trend.filter((d) => d.date < boundary && d.date >= sub.startDate)),
    };
  }

  // Positive means the row moved up the results page.
  const deltaWith = (nowMap, beforeMap) => (key, ownPosition) => {
    const before = beforeMap.get(key);
    if (!before || !before.impressions) return null;
    const now = nowMap ? nowMap.get(key) : null;
    if (nowMap && !now) return null;
    return before.position - (now ? now.position : ownPosition);
  };
  const queryDelta = deltaWith(nowQueries, beforeQueries);
  const pageDelta = deltaWith(nowPages, beforePages);

  return {
    site,
    range,
    clicks: c.clicks,
    impressions: c.impressions,
    ctr: c.ctr * 100,
    position: c.position,
    prev: asTotals(p),
    compare,
    trend,
    topQueries: pickRows(mapRows(queries), QUERY_ROWS).map((r) => ({
      query: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
      posDelta: queryDelta(r.key, r.position),
    })),
    topPages: pickRows(mapRows(pages), PAGE_ROWS).map((r) => ({
      page: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
      posDelta: pageDelta(r.key, r.position),
    })),
    countries: mapRows(countries).map((r) => ({
      country: r.key,
      clicks: r.clicks,
      impressions: r.impressions,
    })),
  };
}

// ── GA4 ──────────────────────────────────────────────────────────────────────

const metricVal = (row, i) => Number(row.metricValues[i].value);

async function fetchGa4(token, propertyId) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId.trim()}:runReport`;
  const realtimeUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId.trim()}:runRealtimeReport`;
  const metrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }];
  const current = { startDate: `${WINDOW}daysAgo`, endDate: "yesterday" };
  // Four ranges in one request — the Data API allows up to four. The 7-day pair
  // is the fallback for a title with no previous 28 days, same as Search
  // Console: asking for both up front costs nothing and avoids a second call.
  const RANGES = [
    { ...current, name: "current" },
    { startDate: `${WINDOW * 2}daysAgo`, endDate: `${WINDOW + 1}daysAgo`, name: "previous" },
    { startDate: `${RECENT}daysAgo`, endDate: "yesterday", name: "recent" },
    { startDate: `${RECENT * 2}daysAgo`, endDate: `${RECENT + 1}daysAgo`, name: "earlier" },
  ];

  const [totals, byDate, channels, pages, realtime] = await Promise.all([
    googlePost(token, url, {
      dateRanges: RANGES,
      metrics: [...metrics, { name: "averageSessionDuration" }],
    }),
    googlePost(token, url, {
      dateRanges: [current],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 60,
    }),
    googlePost(token, url, {
      dateRanges: RANGES,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      // Rows are one per channel per range, so this is four times the number of
      // channels, not the number of channels.
      limit: 40,
    }),
    googlePost(token, url, {
      dateRanges: [current],
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    googlePost(token, realtimeUrl, { metrics: [{ name: "activeUsers" }] }).catch(() => null),
  ]);

  // With named date ranges the range name comes back as an extra dimension,
  // appended after any dimensions the report asked for.
  const byRange = {};
  for (const row of totals.rows || []) {
    const name = row.dimensionValues?.[0]?.value || "current";
    byRange[name] = {
      users: metricVal(row, 0),
      sessions: metricVal(row, 1),
      pageViews: metricVal(row, 2),
      avgDuration: metricVal(row, 3),
    };
  }
  const zero = { users: 0, sessions: 0, pageViews: 0, avgDuration: 0 };

  // Same fallback as Search Console: with no previous 28 days to compare
  // against, every delta reads "no prior data", so drop to seven against seven.
  const mature = (byRange.previous?.sessions || 0) > 0;
  const compare = {
    basis: mature ? "prev 28d" : "prev 7d",
    now: (mature ? byRange.current : byRange.recent) || zero,
    before: (mature ? byRange.previous : byRange.earlier) || zero,
  };

  // One row per channel per range; fold them back into a row per channel.
  const channelMap = new Map();
  for (const r of channels.rows || []) {
    const name = r.dimensionValues[0].value;
    const range = r.dimensionValues[1]?.value || "current";
    const entry = channelMap.get(name) || { channel: name, sessions: 0, previous: 0, recent: 0, earlier: 0 };
    if (range === "current") entry.sessions = metricVal(r, 0);
    else entry[range] = metricVal(r, 0);
    channelMap.set(name, entry);
  }
  const totalSessions = [...channelMap.values()].reduce((n, c) => n + c.sessions, 0);
  const channelList = [...channelMap.values()]
    .map((c) => ({
      channel: c.channel,
      sessions: c.sessions,
      share: totalSessions ? (c.sessions / totalSessions) * 100 : 0,
      now: mature ? c.sessions : c.recent,
      before: mature ? c.previous : c.earlier,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Named outright because they are the two the dashboard is asked about most:
  // organic is the Search Console half arriving, direct is everything Google
  // could not attribute — which, on this site, is mostly newsletter clicks.
  const channelBy = (name) =>
    channelList.find((c) => c.channel === name) || { channel: name, sessions: 0, share: 0, now: 0, before: 0 };

  return {
    propertyId,
    ...(byRange.current || zero),
    prev: byRange.previous || zero,
    compare,
    organic: channelBy("Organic Search"),
    direct: channelBy("Direct"),
    email: channelBy("Email"),
    referral: channelBy("Referral"),
    trend: (byDate.rows || []).map((r) => ({
      // GA4 hands back "20260801"; everything downstream wants "2026-08-01".
      date: r.dimensionValues[0].value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
      users: metricVal(r, 0),
      pageViews: metricVal(r, 1),
    })),
    channels: channelList,
    topPages: (pages.rows || []).map((r) => ({
      title: r.dimensionValues[0].value,
      path: r.dimensionValues[1].value,
      views: metricVal(r, 0),
      users: metricVal(r, 1),
    })),
    liveUsers: realtime?.rows?.[0] ? metricVal(realtime.rows[0], 0) : 0,
  };
}

// ── Caching ──────────────────────────────────────────────────────────────────
// A full render is about ten Google calls — six Search Console, four GA4 — and
// the page is force-dynamic, so every visit paid for all of them. The header
// comment above is right that a cron and a stored blob would be overkill; this
// is the middle option, and the freshness argument does not really apply:
// LAG_DAYS already says Search Console data is three days behind, so serving it
// fifteen minutes old changes nothing anyone can see.
//
// Keyed on the property, never the token: tokens rotate hourly and would bust
// the key every hour for no reason. The token is closed over instead, so a miss
// runs with whatever is current and a hit never looks at it.
//
// The two sources are cached separately, so a title whose GA4 grant is missing
// still gets a cached Search Console half.
const CACHE_SECONDS = 900;

// The version segment guards the shape, not the data: the data cache outlives a
// deployment, so without it a redeploy can serve a blob written by the previous
// code to a page that now expects new fields. Bump it whenever the returned
// object changes shape.
const cachedSearchConsole = (token, site) =>
  unstable_cache(() => fetchSearchConsole(token, site), ["gsc", site, "v2"], {
    revalidate: CACHE_SECONDS,
  })();

const cachedGa4 = (token, propertyId) =>
  unstable_cache(() => fetchGa4(token, propertyId), ["ga4", String(propertyId), "v2"], {
    revalidate: CACHE_SECONDS,
  })();

// ── Entry point ──────────────────────────────────────────────────────────────
// Each source fails on its own: a missing GA4 grant should never blank out the
// Search Console half of the page.

export async function fetchAnalytics(ga) {
  const config = analyticsConfig(ga);
  const result = { config, gsc: null, ga4: null, errors: [] };
  if (!config.google) return result;

  let token;
  try {
    token = await getGoogleAccessToken(SCOPES);
  } catch (e) {
    result.errors.push(`Google sign-in: ${e.message}`);
    return result;
  }

  await Promise.all([
    (async () => {
      if (!config.gscSite) {
        result.errors.push("Search Console: no property set for this title. Add it under Integrations.");
        return;
      }
      try {
        result.gsc = await cachedSearchConsole(token, config.gscSite);
      } catch (e) {
        result.errors.push(`Search Console: ${e.message}`);
        // A wrong property form is the usual cause, so name the alternative.
        if (/403|404/.test(e.message)) {
          try {
            const list = await googleGet(token, "https://www.googleapis.com/webmasters/v3/sites");
            const have = (list.siteEntry || []).map((s) => s.siteUrl);
            result.errors.push(
              have.length
                ? `Search Console properties this service account can see: ${have.join(", ")}`
                : "This service account cannot see any Search Console property yet."
            );
          } catch {}
        }
      }
    })(),
    (async () => {
      if (!config.ga4Property) {
        result.errors.push("GA4: no property id set for this title. Add it under Integrations.");
        return;
      }
      try {
        result.ga4 = await cachedGa4(token, config.ga4Property);
      } catch (e) {
        result.errors.push(`GA4: ${e.message}`);
      }
    })(),
  ]);

  return result;
}
