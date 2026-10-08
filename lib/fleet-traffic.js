// Fleet traffic for the home page card: every period at once, so its Today /
// 7D / 1M / All time switch is instant in the browser instead of a round trip
// that re-asks Google.
//
// Lean on purpose. Group analytics needs Search Console, channels and top
// pages; this card needs visitors, the period before, average visit length and
// a daily line. Three GA4 reports per title, cached for fifteen minutes:
//   1. users/sessions/duration for today, 7 days, 30 days and all time
//   2. the same for the period before each (yesterday, the 7 and 30 before)
//   3. users per day, all time, which the card slices for each chart
// Unique users cannot be added up across days, which is why the totals are
// their own reports rather than sums of the daily line.

import { unstable_cache } from "next/cache";
import { getGoogleAccessToken, googlePost } from "./google";
import { listSites, siteCredentials } from "./site";
import { analyticsConfig } from "./analytics";

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];
const CACHE_SECONDS = 900;
const ALL_TIME = "2020-01-01";

const NOW_RANGES = [
  { name: "today", startDate: "today", endDate: "today" },
  { name: "7d", startDate: "7daysAgo", endDate: "yesterday" },
  { name: "1m", startDate: "30daysAgo", endDate: "yesterday" },
  { name: "all", startDate: ALL_TIME, endDate: "today" },
];
const BEFORE_RANGES = [
  { name: "today", startDate: "yesterday", endDate: "yesterday" },
  { name: "7d", startDate: "14daysAgo", endDate: "8daysAgo" },
  { name: "1m", startDate: "60daysAgo", endDate: "31daysAgo" },
];
const METRICS = [{ name: "activeUsers" }, { name: "sessions" }, { name: "averageSessionDuration" }];

function byRange(report, ranges) {
  const out = {};
  for (const row of report.rows || []) {
    const name = ranges.length > 1 ? row.dimensionValues?.[0]?.value : ranges[0].name;
    out[name] = {
      users: Number(row.metricValues[0].value) || 0,
      sessions: Number(row.metricValues[1].value) || 0,
      duration: Number(row.metricValues[2].value) || 0,
    };
  }
  return out;
}

async function fetchPropertyTraffic(token, propertyId) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${String(propertyId).trim()}:runReport`;
  const [now, before, daily] = await Promise.all([
    googlePost(token, url, { dateRanges: NOW_RANGES, metrics: METRICS }),
    googlePost(token, url, { dateRanges: BEFORE_RANGES, metrics: METRICS }),
    googlePost(token, url, {
      dateRanges: [{ startDate: ALL_TIME, endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 2000,
    }),
  ]);
  return {
    now: byRange(now, NOW_RANGES),
    before: byRange(before, BEFORE_RANGES),
    daily: (daily.rows || []).map((r) => [
      r.dimensionValues[0].value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
      Number(r.metricValues[0].value) || 0,
    ]),
  };
}

const cachedPropertyTraffic = (token, propertyId) =>
  unstable_cache(() => fetchPropertyTraffic(token, propertyId), ["ga4-traffic", String(propertyId), "v1"], {
    revalidate: CACHE_SECONDS,
  })();

/**
 * { periods: { today|7d|1m|all: { users, before, duration } }, daily: [[date, users]], connected, total }
 * `before` is null for all time. Duration is session-weighted across titles.
 */
export async function fleetTraffic() {
  const sites = await listSites();
  let token;
  try {
    token = await getGoogleAccessToken(SCOPES);
  } catch {
    return { periods: null, daily: [], connected: 0, total: sites.length };
  }

  const results = await Promise.all(
    sites.map(async (s) => {
      try {
        const { creds } = await siteCredentials(s.id);
        const prop = analyticsConfig(creds.google_analytics).ga4Property;
        if (!prop) return null;
        return await cachedPropertyTraffic(token, prop);
      } catch {
        return null;
      }
    })
  );
  const ok = results.filter(Boolean);

  const periods = {};
  for (const key of NOW_RANGES.map((r) => r.name)) {
    const users = ok.reduce((n, r) => n + (r.now[key]?.users || 0), 0);
    const sessions = ok.reduce((n, r) => n + (r.now[key]?.sessions || 0), 0);
    const durationSum = ok.reduce((n, r) => n + (r.now[key]?.duration || 0) * (r.now[key]?.sessions || 0), 0);
    const before = key === "all" ? null : ok.reduce((n, r) => n + (r.before[key]?.users || 0), 0);
    periods[key] = { users, before, duration: sessions ? durationSum / sessions : 0 };
  }

  const byDate = new Map();
  for (const r of ok) for (const [d, u] of r.daily) byDate.set(d, (byDate.get(d) || 0) + u);
  // Every day from the first day any title had a reader to yesterday. GA4
  // leaves out a day with no visitors at all, so those are filled in as zero:
  // skipped, they squeezed the timeline and joined the days either side.
  const seen = [...byDate.keys()].sort();
  const firstDay = seen.find((d) => byDate.get(d) > 0);
  const daily = [];
  if (firstDay) {
    const last = new Date(seen[seen.length - 1] + "T12:00:00Z");
    for (let d = new Date(firstDay + "T12:00:00Z"); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      daily.push([k, byDate.get(k) || 0]);
    }
  }

  return { periods, daily, connected: ok.length, total: sites.length };
}
