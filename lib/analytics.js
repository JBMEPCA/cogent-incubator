import { getGoogleAccessToken, googleGet, googlePost, isGoogleConfigured } from "./google";

// Live Search Console + GA4 for smartsme.co.uk, read straight through on page
// render — single-user app, so there is nothing to gain from a cron and a
// stored blob, and this way the numbers are never stale.
//
// Env: GSC_SITE_URL (domain properties use the "sc-domain:smartsme.co.uk"
// form), GA4_PROPERTY_ID (numeric, from GA4 Admin → Property settings), plus a
// service-account key the Google side has actually been granted access to.

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

// Search Console data lands 2-3 days late, so "current" is the 28 days ending
// 3 days ago, measured against the 28 before that.
const LAG_DAYS = 3;
const WINDOW = 28;

const dateStr = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

export function analyticsConfig() {
  return {
    google: isGoogleConfigured(),
    gscSite: process.env.GSC_SITE_URL || null,
    ga4Property: process.env.GA4_PROPERTY_ID || null,
  };
}

// ── Search Console ───────────────────────────────────────────────────────────

async function fetchSearchConsole(token, site) {
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const range = { startDate: dateStr(daysAgo(LAG_DAYS + WINDOW)), endDate: dateStr(daysAgo(LAG_DAYS)) };
  const prevRange = {
    startDate: dateStr(daysAgo(LAG_DAYS + WINDOW * 2)),
    endDate: dateStr(daysAgo(LAG_DAYS + WINDOW + 1)),
  };

  const [cur, prev, byDate, queries, pages, countries] = await Promise.all([
    googlePost(token, base, range),
    googlePost(token, base, prevRange),
    googlePost(token, base, { ...range, dimensions: ["date"], rowLimit: 60 }),
    googlePost(token, base, { ...range, dimensions: ["query"], rowLimit: 12 }),
    googlePost(token, base, { ...range, dimensions: ["page"], rowLimit: 10 }),
    googlePost(token, base, { ...range, dimensions: ["country"], rowLimit: 6 }),
  ]);

  const totals = (r) => (r.rows && r.rows[0]) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const c = totals(cur);
  const p = totals(prev);

  return {
    site,
    range,
    clicks: c.clicks,
    impressions: c.impressions,
    ctr: c.ctr * 100,
    position: c.position,
    prev: { clicks: p.clicks, impressions: p.impressions, ctr: p.ctr * 100, position: p.position },
    trend: (byDate.rows || []).map((r) => ({
      date: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
    })),
    topQueries: (queries.rows || []).map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr * 100,
      position: r.position,
    })),
    topPages: (pages.rows || []).map((r) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    })),
    countries: (countries.rows || []).map((r) => ({
      country: r.keys[0],
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

  const [totals, byDate, channels, pages, realtime] = await Promise.all([
    googlePost(token, url, {
      dateRanges: [
        { ...current, name: "current" },
        { startDate: `${WINDOW * 2}daysAgo`, endDate: `${WINDOW + 1}daysAgo`, name: "previous" },
      ],
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
      dateRanges: [current],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
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

  // With two named date ranges the range name comes back as an extra dimension.
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

  return {
    propertyId,
    ...(byRange.current || zero),
    prev: byRange.previous || zero,
    trend: (byDate.rows || []).map((r) => ({
      // GA4 hands back "20260801"; everything downstream wants "2026-08-01".
      date: r.dimensionValues[0].value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
      users: metricVal(r, 0),
      pageViews: metricVal(r, 1),
    })),
    channels: (channels.rows || []).map((r) => ({
      channel: r.dimensionValues[0].value,
      sessions: metricVal(r, 0),
    })),
    topPages: (pages.rows || []).map((r) => ({
      title: r.dimensionValues[0].value,
      path: r.dimensionValues[1].value,
      views: metricVal(r, 0),
      users: metricVal(r, 1),
    })),
    liveUsers: realtime?.rows?.[0] ? metricVal(realtime.rows[0], 0) : 0,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────
// Each source fails on its own: a missing GA4 grant should never blank out the
// Search Console half of the page.

export async function fetchAnalytics() {
  const config = analyticsConfig();
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
        result.errors.push("Search Console: GSC_SITE_URL is not set.");
        return;
      }
      try {
        result.gsc = await fetchSearchConsole(token, config.gscSite);
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
        result.errors.push("GA4: GA4_PROPERTY_ID is not set.");
        return;
      }
      try {
        result.ga4 = await fetchGa4(token, config.ga4Property);
      } catch (e) {
        result.errors.push(`GA4: ${e.message}`);
      }
    })(),
  ]);

  return result;
}
