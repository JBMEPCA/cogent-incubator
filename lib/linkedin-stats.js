// How each title's LinkedIn page is doing: reach, engagement and followers.
//
// None of the ten pages has a token of our own — app 266128203 never cleared
// the Community Management API review, which is why posting goes through Make.
// Reading goes the same way. A Make scenario holds the page-admin connection
// and forwards one LinkedIn API path per webhook call:
//
//   Custom webhook  ->  LinkedIn "Make an API Call" (URL {{1.path}}, GET,
//                       headers LinkedIn-Version 202607 and
//                       X-Restli-Protocol-Version 2.0.0, and "Send unencoded
//                       query string parameters" on)
//                   ->  Webhook response (body {{2.body}})
//   error route     ->  Webhook response, 502, with LinkedIn's message
//
// That is Make scenario 8192526, "LinkedIn stats API (Cogent analytics)", built
// 26 Oct 2026; its address lives in GlobalSetting make_linkedin_api_url. The
// error route matters: an unhandled error switches an instant scenario off.
// Make's edge rewrites a 502 body to "error code: 502", so LinkedIn's reason
// is only readable in the scenario's history.
//
// Every refresh costs Make operations (five calls a title, three operations a
// call), so the numbers are cached in GlobalSetting and refreshed at most once
// a day unless someone presses Refresh. LinkedIn's own figures lag by a day or
// so anyway; refreshing hourly would buy nothing.
import { prisma, fleetRead, forSite } from "./prisma.js";
import { lookupOrganisation } from "./social-bridge.js";

const HOOK_KEY = "make_linkedin_api_url";
const CACHE_KEY = "linkedin_stats";
const ORG_KEY = "linkedin_org_id";
const PAGE_KEY = "linkedin_page_url";

export const STALE_AFTER_MS = 24 * 36e5;

// Two 30-day windows: the month shown and the month before it, so 1M can carry
// a change figure the way the Google numbers do. LinkedIn keeps daily data for
// twelve months, so this is well inside what it will answer.
const DAILY_DAYS = 60;

// Make runs webhook scenarios in parallel, but ten titles at five calls each
// all at once is a burst LinkedIn's per-app throttle notices. Four in flight
// keeps a refresh to a few seconds a title.
const CONCURRENCY = 4;

const isMakeHook = (url) => Boolean(url) && /^https:\/\/hook\.[a-z0-9.-]*make\.com\//i.test(url);

export async function statsHook() {
  const row = await prisma.globalSetting.findUnique({ where: { key: HOOK_KEY } });
  const url = row?.value?.trim();
  return isMakeHook(url) ? url : null;
}

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

// One LinkedIn GET through Make. Throws with whatever came back, because the
// usual failures — a missing scope, a version LinkedIn has retired — are named
// exactly in LinkedIn's own error text and nowhere else.
async function linkedInGet(hook, path) {
  const res = await fetch(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // A scenario that errored before its Webhook response module answers with
    // Make's own plain "Accepted", which is not data and must not read as zero.
  }
  if (!res.ok || !body || typeof body !== "object") {
    throw new Error(`${res.status} ${text.slice(0, 160) || "empty reply"}`);
  }
  if (body.status && body.status >= 400) {
    throw new Error(`LinkedIn ${body.status}: ${body.message || JSON.stringify(body).slice(0, 160)}`);
  }
  return body;
}

// ---------- which page is which title's ----------

// From the page URL the follow box already uses. A numeric /company/<id> is
// the id itself; a vanity name is resolved through the existing lookup
// scenario once and remembered, since a page's id never changes.
async function orgIdFor(site) {
  const db = forSite(site.id);
  const rows = await db.engineSetting.findMany({ where: { key: { in: [ORG_KEY, PAGE_KEY] } } });
  const get = (k) => rows.find((r) => r.key === k)?.value?.trim();
  if (get(ORG_KEY)) return get(ORG_KEY);

  const m = /linkedin\.com\/company\/([^/?#]+)/i.exec(get(PAGE_KEY) || "");
  if (!m) return null;
  let id = /^\d+$/.test(m[1]) ? m[1] : null;
  if (!id) {
    const org = await lookupOrganisation(decodeURIComponent(m[1]));
    id = org?.id ? String(org.id) : null;
  }
  if (id) {
    await db.engineSetting.upsert({
      where: { key: ORG_KEY },
      update: { value: id },
      create: { key: ORG_KEY, value: id },
    });
  }
  return id;
}

// ---------- fetching ----------

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

function share(s = {}) {
  return {
    impressions: s.impressionCount || 0,
    uniqueImpressions: s.uniqueImpressionsCount || 0,
    clicks: s.clickCount || 0,
    likes: s.likeCount || 0,
    comments: s.commentCount || 0,
    shares: s.shareCount || 0,
  };
}

// The follower count, from the lifetime demographic breakdown. Every follower
// is counted in each facet they have filled in, so each facet's sum is a floor
// and the largest is the closest to the page's own figure. networkSizes would
// give it exactly, but is out of reach through Make (see fetchTitle).
function followerTotal(body) {
  const el = body?.elements?.[0];
  if (!el) return null;
  const sums = Object.values(el)
    .filter(Array.isArray)
    .map((rows) =>
      rows.reduce((n, r) => n + (r.followerCounts?.organicFollowerCount || 0) + (r.followerCounts?.paidFollowerCount || 0), 0),
    );
  return sums.length ? Math.max(...sums) : null;
}

async function fetchTitle(hook, site) {
  const orgId = await orgIdFor(site);
  if (!orgId) return { orgId: null, error: "No LinkedIn page URL is set for this title." };

  // Encoded once, here. The scenario sends the query string exactly as given
  // ("Send unencoded query string parameters" is on), because LinkedIn wants
  // the URN's colons encoded but Rest.li's parentheses left bare, and Make's
  // own encoding gets one or the other wrong. The same is why nothing below
  // puts a URN in the path: Make encodes paths a second time, so networkSizes
  // (the one endpoint with the URN in its path) cannot be reached at all.
  const urn = encodeURIComponent(`urn:li:organization:${orgId}`);
  const end = Date.now();
  const start = new Date(end - DAILY_DAYS * 864e5);
  start.setUTCHours(0, 0, 0, 0);
  // LinkedIn pages daily results ten to a page unless told otherwise.
  const interval = `timeIntervals=(timeRange:(start:${start.getTime()},end:${end}),timeGranularityType:DAY)&count=100`;
  const shareBase = `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${urn}`;
  const followerBase = `/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${urn}`;

  // Each call settles on its own: a page that refuses page-view statistics
  // should still show its impressions and followers.
  const calls = {
    lifetime: `${shareBase}`,
    daily: `${shareBase}&${interval}`,
    followers: `${followerBase}&${interval}`,
    audience: followerBase,
    pages: `/rest/organizationPageStatistics?q=organization&organization=${urn}&${interval}`,
  };
  const keys = Object.keys(calls);
  const settled = await Promise.allSettled(keys.map((k) => linkedInGet(hook, calls[k])));
  const got = Object.fromEntries(keys.map((k, i) => [k, settled[i]]));
  const ok = (k) => (got[k].status === "fulfilled" ? got[k].value : null);
  const errors = keys
    .filter((k) => got[k].status === "rejected")
    .map((k) => `${k}: ${got[k].reason.message}`);

  // One row per day in the window, so a day LinkedIn left out reads as zero
  // rather than collapsing the chart's spacing.
  const days = new Map();
  for (let t = start.getTime(); t <= end; t += 864e5) {
    days.set(dayKey(t), { date: dayKey(t), ...share(), followersGained: 0, pageViews: null });
  }
  for (const el of ok("daily")?.elements || []) {
    const d = days.get(dayKey(el.timeRange?.start));
    if (d) Object.assign(d, share(el.totalShareStatistics));
  }
  for (const el of ok("followers")?.elements || []) {
    const d = days.get(dayKey(el.timeRange?.start));
    const g = el.followerGains || {};
    if (d) d.followersGained = (g.organicFollowerGain || 0) + (g.paidFollowerGain || 0);
  }
  const pages = ok("pages");
  if (pages) {
    for (const d of days.values()) d.pageViews = 0;
    for (const el of pages.elements || []) {
      const d = days.get(dayKey(el.timeRange?.start));
      if (d) d.pageViews = el.totalPageStatistics?.views?.allPageViews?.pageViews || 0;
    }
  }

  const lifetime = ok("lifetime");
  return {
    orgId,
    lifetime: lifetime ? share(lifetime.elements?.[0]?.totalShareStatistics) : null,
    followers: followerTotal(ok("audience")),
    daily: ok("daily") || ok("followers") || pages ? [...days.values()] : [],
    errors,
    error: errors.length === keys.length ? "LinkedIn returned nothing for this page." : null,
  };
}

let refreshing = null;

/** Fetch every title afresh and cache the result. One refresh at a time. */
export async function refreshLinkedInStats() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const hook = await statsHook();
    if (!hook) throw new Error("GlobalSetting make_linkedin_api_url is not set.");
    const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true, name: true } });
    const results = await mapLimit(sites, CONCURRENCY, async (site) => {
      try {
        return [site.slug, await fetchTitle(hook, site)];
      } catch (e) {
        return [site.slug, { orgId: null, error: e.message, errors: [], daily: [] }];
      }
    });
    const value = { fetchedAt: Date.now(), titles: Object.fromEntries(results) };
    await prisma.globalSetting.upsert({
      where: { key: CACHE_KEY },
      update: { value: JSON.stringify(value) },
      create: { key: CACHE_KEY, value: JSON.stringify(value) },
    });
    return value;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function cachedLinkedInStats() {
  const row = await prisma.globalSetting.findUnique({ where: { key: CACHE_KEY } });
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

/** How old the snapshot is, as words, and whether it is due a refresh. */
export function freshness(cache) {
  if (!cache) return { stale: true, label: null };
  const m = Math.round((Date.now() - cache.fetchedAt) / 60000);
  const h = Math.round(m / 60);
  const label = m < 60 ? `${m} min ago` : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
  return { stale: m * 60000 > STALE_AFTER_MS, label };
}

// ---------- shaping for the page ----------

// Same keys as lib/periods.js, so the page's own period filter drives this
// view too. LinkedIn runs about a day behind, so Today is its latest day.
export const PERIODS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7D", days: 7 },
  { key: "1m", label: "1M", days: 30 },
  { key: "all", label: "All time", days: null },
];

const METRICS = ["impressions", "uniqueImpressions", "clicks", "likes", "comments", "shares", "followersGained", "pageViews"];

function sumDays(daily, from, to) {
  const out = Object.fromEntries(METRICS.map((m) => [m, 0]));
  let pageDays = 0;
  for (const d of daily.slice(from, to)) {
    for (const m of METRICS) out[m] += d[m] || 0;
    if (d.pageViews != null) pageDays++;
  }
  if (!pageDays) out.pageViews = null;
  return out;
}

// Interactions over impressions, worked out here rather than taken from
// LinkedIn's own `engagement` field: that one is only given for whole ranges
// and counts follows too, so it would not sum or compare across periods.
export const engagementRate = (m) =>
  m.impressions ? ((m.clicks + m.likes + m.comments + m.shares) / m.impressions) * 100 : null;

/**
 * Every title's figures for one period, plus the period before it where there
 * is one. `posts` comes from our own queue — posts the engine put out — so a
 * post someone made by hand on LinkedIn is in the reach figures but not the
 * count.
 */
export async function linkedInPeriod(cache, periodKey) {
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS.find((p) => p.key === "1m");
  const since = period.days ? new Date(Date.now() - period.days * 864e5) : null;
  const before = period.days ? new Date(Date.now() - 2 * period.days * 864e5) : null;

  const db = fleetRead();
  const [nowPosts, prevPosts] = await Promise.all([
    db.linkedInPost.groupBy({
      by: ["siteId"],
      where: { postedAt: since ? { gte: since } : { not: null } },
      _count: { _all: true },
    }),
    before
      ? db.linkedInPost.groupBy({ by: ["siteId"], where: { postedAt: { gte: before, lt: since } }, _count: { _all: true } })
      : [],
  ]);
  const count = (rows) => Object.fromEntries(rows.map((r) => [r.siteId, r._count._all]));
  const postsNow = count(nowPosts);
  const postsPrev = count(prevPosts);

  const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
  const idOf = Object.fromEntries(sites.map((s) => [s.slug, s.id]));

  const titles = {};
  for (const [slug, t] of Object.entries(cache?.titles || {})) {
    const daily = t.daily || [];
    let now;
    let prev = null;
    let trend = [];
    if (period.days) {
      // Today is LinkedIn's latest reported day: its own today stays empty
      // until the next morning, so the window ends at the last day with
      // anything in it rather than on a row that is bound to read zero.
      let n = daily.length;
      if (period.days === 1) {
        while (n > 1 && !(daily[n - 1].impressions || daily[n - 1].followersGained || daily[n - 1].pageViews)) n--;
      }
      now = sumDays(daily, Math.max(0, n - period.days), n);
      if (n >= 2 * period.days) prev = sumDays(daily, n - 2 * period.days, n - period.days);
      // A one-day window has no shape to draw, so Today charts the last month.
      trend = daily.slice(-(period.days === 1 ? 30 : period.days));
    } else {
      // All time: LinkedIn's lifetime totals for reach, the follower count
      // itself for gains (every follower was gained at some point), and the
      // page views LinkedIn has given us day by day — it has no lifetime
      // figure that is cheap to ask for, so that one is left blank.
      now = { ...(t.lifetime || sumDays(daily, 0, daily.length)), followersGained: t.followers ?? 0, pageViews: null };
      trend = daily;
    }
    const id = idOf[slug];
    titles[slug] = {
      orgId: t.orgId,
      error: t.error,
      errors: t.errors || [],
      followers: t.followers,
      now: { ...now, posts: postsNow[id] || 0 },
      prev: prev ? { ...prev, posts: postsPrev[id] || 0 } : null,
      trend,
    };
  }
  return { period, titles };
}
