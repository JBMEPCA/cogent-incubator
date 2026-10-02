import { unstable_cache } from "next/cache";
import { siteCredentials } from "./site";
import { isGoogleConfigured, getGoogleAccessToken, googlePost } from "./google";

// How a trending article is doing once it is live: views from GA4, organic
// clicks, impressions and average position from Search Console, all for that
// one page since it was published.
//
// Neither source is instant. GA4 runs a few hours behind and Search Console a
// day or more, so a piece published this morning shows dashes until the data
// exists; a dash means "not reported yet", never zero.

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"];
const day = (d) => new Date(d).toISOString().slice(0, 10);

/** The post's public URL, from WordPress. Cached for a day: a slug rarely changes. */
const postLink = (siteId, wpPostId) =>
  unstable_cache(
    async () => {
      const { creds } = await siteCredentials(siteId);
      if (!creds.wordpress) return null;
      const { fetchPostRaw } = await import("./wordpress");
      try {
        return (await fetchPostRaw(creds.wordpress, wpPostId)).link || null;
      } catch {
        return null;
      }
    },
    ["trend-post-link", siteId, String(wpPostId)],
    { revalidate: 86400 }
  )();

async function ga4Views(token, propertyId, path, since) {
  const res = await googlePost(token, `https://analyticsdata.googleapis.com/v1beta/properties/${String(propertyId).trim()}:runReport`, {
    dateRanges: [{ startDate: day(since), endDate: "today" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: path } } },
  });
  const v = res.rows?.[0]?.metricValues?.[0]?.value;
  return v == null ? 0 : Number(v);
}

async function gscPage(token, property, link, since) {
  const res = await googlePost(token, `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    startDate: day(since),
    endDate: day(Date.now()),
    dataState: "all",
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: link }] }],
  });
  const r = res.rows?.[0];
  return r ? { clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 } : null;
}

/** One live article's numbers. Cached ten minutes so the tab stays quick. */
const performanceFor = (siteId, articleId, wpPostId, publishedAt) =>
  unstable_cache(
    async () => {
      const link = await postLink(siteId, wpPostId);
      const out = { link, views: null, clicks: null, impressions: null, position: null };
      if (!link || !isGoogleConfigured()) return out;
      const { creds } = await siteCredentials(siteId);
      const ga = creds.google_analytics || {};
      const since = publishedAt || Date.now();
      let token;
      try {
        token = await getGoogleAccessToken(SCOPES);
      } catch {
        return out;
      }
      const [views, gsc] = await Promise.allSettled([
        ga.ga4PropertyId ? ga4Views(token, ga.ga4PropertyId, new URL(link).pathname, since) : Promise.resolve(null),
        ga.gscSiteUrl ? gscPage(token, ga.gscSiteUrl, link, since) : Promise.resolve(null),
      ]);
      if (views.status === "fulfilled") out.views = views.value;
      if (gsc.status === "fulfilled" && gsc.value) Object.assign(out, gsc.value);
      return out;
    },
    ["trend-perf", articleId],
    { revalidate: 600 }
  )();

/** Numbers for a list of live articles, side by side. */
export async function livePerformance(items) {
  const rows = await Promise.all(
    items.map((i) =>
      performanceFor(i.siteId, i.articleId, i.wpPostId, i.publishedAt ? new Date(i.publishedAt).getTime() : null).catch(() => ({}))
    )
  );
  return new Map(items.map((i, n) => [i.articleId, rows[n]]));
}
