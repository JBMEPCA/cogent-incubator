import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { siteCredentials } from "./site";
import { isGoogleConfigured, getGoogleAccessToken, googlePost } from "./google";

// Rising Articles: our own pages whose Google impressions are climbing.
//
// Page-level, not query-level. The first version of this listed single search
// queries spiking on a title, and the numbers read as worthless next to Google
// Trends volumes (13 impressions against 20K searches) because Search Console
// only counts searches where we appeared. An article's total across every
// query it ranks for is the honest measure of whether it is taking off.
//
// The window is fixed and stated on the page: the last 7 days against the 7
// before, both ending yesterday, with 28 days of daily impressions drawn so the
// rise can be seen rather than taken on trust.

const DAYS = 28;
// "All time" means as far back as Search Console will go, which is about 16
// months. Every title in the fleet is younger than that, so for us the two are
// the same thing today. They will not be forever, which is why the label says
// all time rather than since launch.
const ALL_TIME_DAYS = 480;
// Below this an article's "growth" is noise: 3 impressions to 9 is +200%.
const MIN_RECENT = 25;
// Shown ten at a time on the page (Show more), so the list can run longer.
const TOP = 30;
// Listing pages rank for the title's own name and say nothing about an article.
const NOT_ARTICLES = /^\/$|\/(category|tag|author|page)\//;

const isoDay = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

/** "/emirates-a380-diverts-to-frankfurt/" -> "Emirates a380 diverts to frankfurt". */
function titleFromPath(path) {
  const slug = path.split("/").filter(Boolean).pop() || path;
  const words = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function risingForSite(token, site, property, dates) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  // Two queries, run together. The daily one drives the charts and the rise;
  // the second is page totals over the whole retained window, for the lifetime
  // clicks figure. It cannot be derived from the first, which only sees 28 days.
  const [data, allTime] = await Promise.all([
    googlePost(token, endpoint, {
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      dimensions: ["page", "date"],
      rowLimit: 25000,
      dataState: "all",
    }),
    googlePost(token, endpoint, {
      startDate: isoDay(ALL_TIME_DAYS),
      endDate: dates[dates.length - 1],
      dimensions: ["page"],
      rowLimit: 25000,
      dataState: "all",
    }).catch(() => ({ rows: [] })),
  ]);

  // Keyed on the url exactly as Search Console returns it, which is the same
  // key the daily query uses, so the two line up without normalising.
  const lifetime = new Map((allTime.rows || []).map((r) => [r.keys[0], r.clicks]));

  const index = new Map(dates.map((d, i) => [d, i]));
  const pages = new Map();
  for (const r of data.rows || []) {
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
      {
        url, path,
        daily: new Array(DAYS).fill(0),
        clicks7: 0, posWeight: 0, impr7: 0, posWeightPrev: 0, imprPrev: 0,
      };
    p.daily[i] += r.impressions;
    if (i >= DAYS - 7) {
      p.clicks7 += r.clicks;
      p.posWeight += r.position * r.impressions;
      p.impr7 += r.impressions;
    } else if (i >= DAYS - 14) {
      p.posWeightPrev += r.position * r.impressions;
      p.imprPrev += r.impressions;
    }
    pages.set(url, p);
  }

  return [...pages.values()].map((p) => {
    const recent = p.daily.slice(-7).reduce((a, b) => a + b, 0);
    const previous = p.daily.slice(-14, -7).reduce((a, b) => a + b, 0);
    return {
      siteId: site.id,
      siteSlug: site.slug,
      url: p.url,
      title: titleFromPath(p.path),
      daily: p.daily,
      recent,
      previous,
      change: recent - previous,
      pct: previous ? Math.round(((recent - previous) / previous) * 100) : null,
      clicks: p.clicks7,
      // Falls back to the 7 day figure rather than 0 if the long query failed,
      // because a zero here would read as "this has never been clicked".
      clicksAll: Math.round(lifetime.get(p.url) ?? p.clicks7),
      position: p.impr7 ? Math.round((p.posWeight / p.impr7) * 10) / 10 : null,
      positionPrev: p.imprPrev ? Math.round((p.posWeightPrev / p.imprPrev) * 10) / 10 : null,
    };
  });
}

/**
 * The fleet's top movers, biggest absolute rise first. Cached an hour: Search
 * Console updates a few times a day, and this reads every title.
 */
export const risingArticles = unstable_cache(
  async () => {
    // Day 0 is DAYS days ago, the last is yesterday. Today is left out because
    // it is always partial and would make every article look like it is falling.
    const dates = Array.from({ length: DAYS }, (_, i) => isoDay(DAYS - i));
    const out = { dates, rows: [], errors: [] };
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
          return await risingForSite(token, site, property, dates);
        } catch (e) {
          out.errors.push(`${site.slug}: ${e.message}`);
          return [];
        }
      })
    );

    out.rows = perSite
      .flat()
      .filter((r) => r.recent >= MIN_RECENT && r.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, TOP);
    return out;
  },
  // Bump this on every change to the row shape. Cached rows from the old key
  // do not carry new fields, and the panel degrades silently rather than
  // erroring: a missing figure just renders as a dash. Without the bump the
  // change looks like it did not work for an hour after deploying, which is
  // exactly long enough to go hunting for the bug somewhere else.
  ["rising-articles", "v4"],
  { revalidate: 3600 }
);
