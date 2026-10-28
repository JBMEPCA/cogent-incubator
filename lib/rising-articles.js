import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { siteCredentials } from "./site";
import { isGoogleConfigured, getGoogleAccessToken, googlePost } from "./google";
import { isArticlePath } from "./fleet-analytics";

// Rising Articles: our own pages, ranked on Google Search Console figures.
//
// Page-level, not query-level. The first version of this listed single search
// queries spiking on a title, and the numbers read as worthless next to Google
// Trends volumes (13 impressions against 20K searches) because Search Console
// only counts searches where we appeared. An article's total across every
// query it ranks for is the honest measure of whether it is taking off.
//
// Since 28 Oct 2026 the list has a period (7 days, 30 days, all time) and a
// sort (rising, impressions, position, clicks), both chosen on the page. Every
// figure on a row is for the chosen period, compared with the period of the
// same length before it; all time has nothing before it, so it has no rise.

// The period switch. chart: how many days of daily impressions each row draws,
// with the period itself highlighted at the end of it.
export const RISING_RANGES = [
// posMin: the position sort only ranks articles seen at least this often in
// the period, or a page seen 21 times over months tops it on a fluke.
  { key: "7d", label: "7D", days: 7, chart: 28, phrase: "7 days", before: "the week before", posMin: 20 },
  { key: "1m", label: "1M", days: 30, chart: 60, phrase: "30 days", before: "the 30 days before", posMin: 50 },
  { key: "all", label: "All time", days: null, chart: 90, phrase: "all time", before: null, posMin: 100 },
];
export const RISING_SORTS = [
  { key: "rising", label: "Rising" },
  { key: "impressions", label: "Impressions" },
  { key: "position", label: "Position" },
  { key: "clicks", label: "Clicks" },
];
export const risingRange = (k) => RISING_RANGES.find((r) => r.key === k) || RISING_RANGES[0];
export const risingSort = (k, range) => {
  const s = RISING_SORTS.find((x) => x.key === k)?.key || "rising";
  // All time has no earlier period, so nothing can be shown rising against it.
  return s === "rising" && !risingRange(range).days ? "impressions" : s;
};

// "All time" means as far back as Search Console will go, which is about 16
// months. Every title in the fleet is younger than that, so for us the two are
// the same thing today. They will not be forever, which is why the label says
// all time rather than since launch.
const ALL_TIME_DAYS = 480;
// Below this an article's figures are noise: 3 impressions to 9 is +200%, and
// position 1.0 off two impressions says nothing.
//
// Scaled to the title since 20 Oct 2026. A fixed 25, ranked by absolute rise
// across the fleet, meant the list was Smart SME and Fleet every week: Dental
// drew about 30 impressions a day across its whole site, so one of its pages
// clearing 25 in a week was rare, and when one did it could never outrank a
// Smart SME page rising by hundreds. The floor is 1% of the title's own
// period, between 5 and 25 a week (scaled up for longer periods), and the
// rising sort ranks the rise as a share of the title's period, so a small
// title's breakout sits beside a big title's.
const MIN_RECENT = 25;
const MIN_RECENT_FLOOR = 5;
const MIN_RECENT_SHARE = 0.01;
// Shown ten at a time on the page (Show more), so the list can run longer.
const TOP = 30;
// Articles only, by the analytics page's own rule (lib/fleet-analytics.js): no
// home, listing or site pages. The old pattern let "About" top the position
// sort on 28 Oct 2026, a page that ranks for the title's own name.
const NOT_ARTICLES = { test: (path) => !isArticlePath(path) };

const isoDay = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

/** "/emirates-a380-diverts-to-frankfurt/" -> "Emirates a380 diverts to frankfurt". */
function titleFromPath(path) {
  const slug = path.split("/").filter(Boolean).pop() || path;
  const words = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Every row of a Search Console query. One response holds at most 25,000 rows,
 * and page by day over 60 or 90 days on Smart SME is more than that, so later
 * rows are fetched with startRow rather than silently cut off.
 */
async function allRows(token, endpoint, body) {
  const out = [];
  for (let startRow = 0; startRow < 100000; startRow += 25000) {
    const res = await googlePost(token, endpoint, { ...body, rowLimit: 25000, startRow });
    const rows = res.rows || [];
    out.push(...rows);
    if (rows.length < 25000) break;
  }
  return out;
}

export async function risingForSite(token, site, property, dates, windowDays) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const span = dates.length;
  // Two queries, run together. The daily one drives the charts and the
  // period figures; the second is page totals over the whole retained window,
  // for all-time clicks, and for every figure when the period is all time.
  const [daily, allTime] = await Promise.all([
    allRows(token, endpoint, { startDate: dates[0], endDate: dates[span - 1], dimensions: ["page", "date"], dataState: "all" }),
    allRows(token, endpoint, { startDate: isoDay(ALL_TIME_DAYS), endDate: dates[span - 1], dimensions: ["page"], dataState: "all" }).catch(() => []),
  ]);

  // Keyed on the url exactly as Search Console returns it, which is the same
  // key the daily query uses, so the two line up without normalising.
  const lifetime = new Map(allTime.map((r) => [r.keys[0], r]));

  const index = new Map(dates.map((d, i) => [d, i]));
  const W = windowDays || 0;
  const pages = new Map();
  for (const r of daily) {
    const [url, date] = r.keys;
    const i = index.get(date);
    if (i == null) continue;
    let path;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    if (NOT_ARTICLES.test(path)) continue;
    const p =
      pages.get(url) ||
      { url, path, daily: new Array(span).fill(0), clicksW: 0, posWeight: 0, imprW: 0, posWeightPrev: 0, imprPrev: 0 };
    p.daily[i] += r.impressions;
    if (W && i >= span - W) {
      p.clicksW += r.clicks;
      p.posWeight += r.position * r.impressions;
      p.imprW += r.impressions;
    } else if (W && i >= span - 2 * W) {
      p.posWeightPrev += r.position * r.impressions;
      p.imprPrev += r.impressions;
    }
    pages.set(url, p);
  }
  // All time: a page with lifetime figures but no recent days still counts.
  if (!W) {
    for (const r of allTime) {
      const url = r.keys[0];
      if (pages.has(url)) continue;
      let path;
      try {
        path = new URL(url).pathname;
      } catch {
        continue;
      }
      if (NOT_ARTICLES.test(path)) continue;
      pages.set(url, { url, path, daily: new Array(span).fill(0), clicksW: 0, posWeight: 0, imprW: 0, posWeightPrev: 0, imprPrev: 0 });
    }
  }

  const round1 = (x) => Math.round(x * 10) / 10;
  return [...pages.values()].map((p) => {
    const life = lifetime.get(p.url);
    const clicksAll = Math.round(life?.clicks ?? p.clicksW);
    if (!W) {
      return {
        siteId: site.id, siteSlug: site.slug, url: p.url, path: p.path, title: titleFromPath(p.path), daily: p.daily,
        recent: Math.round(life?.impressions ?? 0), previous: null, change: null, pct: null,
        clicks: clicksAll, clicksAll,
        position: life?.position != null ? round1(life.position) : null, positionPrev: null,
      };
    }
    const recent = p.daily.slice(-W).reduce((a, b) => a + b, 0);
    const previous = p.daily.slice(-2 * W, -W).reduce((a, b) => a + b, 0);
    return {
      siteId: site.id, siteSlug: site.slug, url: p.url, path: p.path, title: titleFromPath(p.path), daily: p.daily,
      recent, previous, change: recent - previous,
      pct: previous ? Math.round(((recent - previous) / previous) * 100) : null,
      clicks: p.clicksW,
      // Falls back to the period figure rather than 0 if the long query failed,
      // because a zero here would read as "this has never been clicked".
      clicksAll,
      position: p.imprW ? round1(p.posWeight / p.imprW) : null,
      positionPrev: p.imprPrev ? round1(p.posWeightPrev / p.imprPrev) : null,
    };
  });
}

/**
 * Every article worth listing for one period, across the fleet, unsorted.
 * Cached an hour per period: Search Console updates a few times a day, and
 * this reads every title.
 */
export const risingCandidates = (rangeKey = "7d") =>
  unstable_cache(
    async () => {
      const range = risingRange(rangeKey);
      // The last day is yesterday. Today is left out because it is always
      // partial and would make every article look like it is falling.
      const dates = Array.from({ length: range.chart }, (_, i) => isoDay(range.chart - i));
      const out = { range: range.key, dates, rows: [], errors: [] };
      if (!isGoogleConfigured()) return out;

      let token;
      try {
        token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
      } catch (e) {
        out.errors.push(e.message);
        return out;
      }

      const sites = await prisma.site.findMany({ where: { status: { in: ["live", "cold_start"] } } });
      const perSite = await Promise.all(
        sites.map(async (site) => {
          const { creds } = await siteCredentials(site.id);
          const property = creds.google_analytics?.gscSiteUrl;
          if (!property) return [];
          try {
            return await risingForSite(token, site, property, dates, range.days);
          } catch (e) {
            out.errors.push(`${site.slug}: ${e.message}`);
            return [];
          }
        })
      );

      // The floor scales with the period: 25 a week becomes about 107 over 30
      // days. All time uses the 30 day floor: it is a total, not a rate, and a
      // 90 day floor left out most articles a reader would expect to see.
      const weeks = Math.min(range.days || 30, 30) / 7;
      out.rows = perSite.flatMap((rows) => {
        const total = rows.reduce((t, r) => t + r.recent, 0);
        const floor = Math.round(
          Math.min(MIN_RECENT * weeks, Math.max(MIN_RECENT_FLOOR * weeks, total * MIN_RECENT_SHARE))
        );
        return rows
          .filter((r) => r.recent >= floor)
          .map((r) => ({ ...r, share: total && r.change != null ? Math.round((r.change / total) * 1000) / 10 : 0 }));
      });
      return out;
    },
    // Bump this on every change to the row shape. Cached rows from the old key
    // do not carry new fields, and the panel degrades silently rather than
    // erroring: a missing figure just renders as a dash. Without the bump the
    // change looks like it did not work for an hour after deploying, which is
    // exactly long enough to go hunting for the bug somewhere else.
    ["rising-candidates", rangeKey, "v1"],
    { revalidate: 3600 }
  )();

/** The list as shown: sorted the chosen way, top thirty. */
export function rankRising(data, sortKey) {
  const sort = risingSort(sortKey, data?.range);
  let rows = [...(data?.rows || [])];
  if (sort === "rising") {
    rows = rows.filter((r) => r.change > 0).sort((a, b) => b.share - a.share || b.change - a.change);
  } else if (sort === "impressions") {
    rows.sort((a, b) => b.recent - a.recent);
  } else if (sort === "clicks") {
    rows.sort((a, b) => b.clicks - a.clicks || b.recent - a.recent);
  } else if (sort === "position") {
    rows = rows
      .filter((r) => r.position != null && r.recent >= risingRange(data?.range).posMin)
      .sort((a, b) => a.position - b.position || b.recent - a.recent);
  }
  return { ...data, sort, rows: rows.slice(0, TOP) };
}

/** The default view, as the Trending tab used to call it. */
export async function risingArticles() {
  return rankRising(await risingCandidates("7d"), "rising");
}
