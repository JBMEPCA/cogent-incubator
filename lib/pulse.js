import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { siteCredentials } from "./site";

// Cogent Pulse: readers each title counted for itself.
//
// Why this exists at all. Measured 2 Oct 2026 over 90 days, Search Console
// recorded 505 Google clicks across the fleet and GA4 recorded 185 organic
// sessions, so GA4 was seeing 37% of arrivals. The missing two thirds are not
// mislabelled as direct, they are absent: the consent banner denies
// analytics_storage by default, and with no client id there is no session to
// count. Pulse counts first party, with no cookie, so it sees the readers GA4
// cannot. The gap between the two columns is the point of showing both.
//
// Each title answers for itself over HTTP rather than the dashboard reading ten
// databases: Vercel cannot SSH into SiteGround, and this is the same fan-out
// the Search Console figures already use. The token goes in the query string
// because the SiteGround WAF rejects wp-json requests carrying an Authorization
// header.

const WINDOW_DAYS = 28;
const TIMEOUT_MS = 8000;
const CONCURRENCY = 5;

async function pulseForSite(site, days) {
  const { creds } = await siteCredentials(site.id);
  const base = creds?.wordpress?.url;
  const token = (process.env.PULSE_TOKEN || "").trim();
  if (!base || !token) return null;

  // The nc parameter gets past SiteGround's cache, which otherwise answers a
  // repeated GET with a stale copy (seen 4 Nov 2026: the report kept serving
  // its pre-update shape after Pulse 1.3.1 went in). Freshness is this app's
  // job, through the fifteen minute cache on fleetPulse.
  const url = `${String(base).replace(/\/$/, "")}/wp-json/cogent/v1/pulse/report?days=${days}&nc=${Date.now()}&token=${encodeURIComponent(token)}`;
  // One slow site must not hold up the page. A title that times out reports
  // nothing and is shown as not counting yet, which is honest: we do not know.
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "CogentDashboard/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${site.slug}: HTTP ${res.status}`);
  const json = await res.json();
  return {
    siteId: site.id,
    slug: site.slug,
    // The first day this title recorded anything. The totals are meaningless
    // without it: a figure that has been accumulating for two hours must not
    // be read as though it covers the same window as everything else.
    first: json.first || null,
    // The day Pulse 1.3.0 started on this title: three seconds on screen
    // before a visit counts, and email as its own source. Null on an older
    // plugin, which still counts every page load and files email as direct.
    ruleSince: json.rule_since || null,
    humans: Number(json.humans) || 0,
    bots: Number(json.bots) || 0,
    sources: json.sources || {},
    daily: Array.isArray(json.daily) ? json.daily : [],
    // Search arrivals per day, from Pulse 1.3.1. Null on an older plugin,
    // which still gives the search total in `sources`.
    dailySearch: Array.isArray(json.daily_search) ? json.daily_search : null,
    top: Array.isArray(json.top) ? json.top : [],
  };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const n = i++;
      out[n] = await fn(items[n]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Keyed by site id so the analytics table can look a title up directly.
 * Cached for fifteen minutes: the counts only move as fast as people read, and
 * this reaches out to ten WordPress installs.
 */
export const fleetPulse = unstable_cache(
  async (days = WINDOW_DAYS) => {
    const out = { days, bySite: {}, totals: { humans: 0, bots: 0 }, errors: [], counting: 0, first: null };
    if (!(process.env.PULSE_TOKEN || "").trim()) {
      out.errors.push("PULSE_TOKEN is not set, so no title can be read.");
      return out;
    }
    const sites = await prisma.site.findMany({
      where: { status: { in: ["live", "cold_start"] } },
      select: { id: true, slug: true },
    });

    const results = await mapLimit(sites, CONCURRENCY, async (site) => {
      try {
        return await pulseForSite(site, days);
      } catch (e) {
        out.errors.push(String(e.message).slice(0, 120));
        return null;
      }
    });

    for (const r of results) {
      if (!r) continue;
      out.bySite[r.siteId] = r;
      out.totals.humans += r.humans;
      out.totals.bots += r.bots;
      out.counting++;
      // Fleet-wide, the earliest day any title counted: the honest "since".
      if (r.first && (!out.first || r.first < out.first)) out.first = r.first;
    }
    return out;
  },
  ["fleet-pulse", "v5"],
  { revalidate: 900 }
);

// The plugin answers for at most 365 days, which covers "all time" for a count
// that started on 2 Oct 2026 until October 2027.
const MAX_DAYS = 365;

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/**
 * Pulse over one of the page's periods (lib/periods), as the headline visits
 * figure: per title, its visits, the window before for the change chip, and a
 * day-by-day line. Since November 2026 this is the number of record for how
 * many people read a title; GA4 only sees those who accept cookies.
 *
 * The window before is read as a second, double-length report and subtracted,
 * and only given where the title was already counting at its start, so a
 * young count never shows a rise against days it was not recording.
 */
export async function pulseForPeriod(period) {
  const days = period?.days || MAX_DAYS;
  const [now, wide] = await Promise.all([
    fleetPulse(days),
    period?.days && period.days * 2 <= MAX_DAYS ? fleetPulse(period.days * 2) : null,
  ]);
  const prevStart = period?.days ? isoDaysAgo(period.days * 2 - 1) : null;
  const sinceDay = isoDaysAgo(days - 1);

  // The report lists only days that counted something, so a quiet day is
  // filled in as zero rather than drawn as a line straight across it. From
  // the title's first counted day, never before it.
  const today = isoDaysAgo(0);
  const series = (daily, first) => {
    const by = new Map((daily || []).map((d) => [d.day, d.views]));
    const out = [];
    const start = first && first > sinceDay ? first : sinceDay;
    for (let t = Date.parse(`${start}T00:00:00Z`); ; t += 864e5) {
      const day = new Date(t).toISOString().slice(0, 10);
      if (day > today) break;
      out.push({ date: day, value: by.get(day) || 0 });
    }
    return out;
  };
  const addInto = (map, points) => {
    for (const d of points) map.set(d.date, (map.get(d.date) || 0) + d.value);
  };
  const sorted = (map) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));

  const bySite = {};
  let visits = 0;
  let search = 0;
  let prevVisits = 0;
  let prevSearch = 0;
  let prevCounted = 0;
  const fleetDaily = new Map();
  const fleetSearchDaily = new Map();
  let searchDays = 0;
  for (const [siteId, p] of Object.entries(now.bySite)) {
    const w = wide?.bySite?.[siteId];
    const full = w && p.first && p.first <= prevStart;
    const s = Number(p.sources?.search) || 0;
    const prev = full ? Math.max(0, w.humans - p.humans) : null;
    const prevS = full ? Math.max(0, (Number(w.sources?.search) || 0) - s) : null;
    const trend = series(p.daily, p.first);
    const searchTrend = p.dailySearch ? series(p.dailySearch, p.first) : null;
    addInto(fleetDaily, trend);
    if (searchTrend) {
      addInto(fleetSearchDaily, searchTrend);
      searchDays++;
    }
    bySite[siteId] = { ...p, visits: p.humans, prev, trend, search: s, prevSearch: prevS, searchTrend };
    visits += p.humans;
    search += s;
    if (prev != null) {
      prevVisits += prev;
      prevSearch += prevS;
      prevCounted++;
    }
  }
  // Only when every reporting title has a full window before; a partial sum
  // would make the fleet look as though it had grown.
  const fullPrev = prevCounted && prevCounted === now.counting;
  return {
    ...now,
    bySite,
    visits,
    search,
    prevVisits: fullPrev ? prevVisits : null,
    prevSearch: fullPrev ? prevSearch : null,
    trend: sorted(fleetDaily),
    // The fleet line only once every title sends one, or the sum would dip
    // wherever a title is still on the older plugin.
    searchTrend: searchDays && searchDays === now.counting ? sorted(fleetSearchDaily) : null,
  };
}

// CIM's established titles, shown beside the fleet for scale. They run no
// Pulse, so the comparison is GA4 ENGAGED SESSIONS over the same window, for
// them and for the fleet's three biggest, on one scale. Engaged, not page
// views, because MEPCA's GA4 carried ~31,000 bot views in October (Australia:
// 19,290 sessions, 29 engaged; 6,364 views of its 404 page), and a visit only
// counts as engaged after 10 seconds, a second page or a conversion, which
// bots almost never reach. Care Home sits in its own GA4 account and appears
// only while that property stays shared with the service account.
export const LEGACY_TITLES = [
  { name: "MEPCA Magazine", property: "385082229", domain: "mepca-engineering.com" },
  { name: "Bar Magazine", property: "548386988", domain: "barmagazine.co.uk" },
  { name: "The Hotel Magazine", property: "548405228", domain: "thehotelmagazine.co.uk" },
  { name: "Total Grooming Magazine", property: "548405042", domain: "totalgroomingmagazine.co.uk" },
  { name: "Care Home Magazine", property: "546437378", domain: "carehomemagazine.co.uk" },
];
const FLEET_IN_COMPARISON = 3;

// GA4's channel groups folded into Pulse's buckets. GA4 has no "internal":
// moving between pages stays inside one session.
const CHANNEL_TO_SOURCE = {
  Direct: "direct",
  Email: "email",
  "Organic Search": "search",
  "Paid Search": "search",
  "Organic Social": "social",
  "Paid Social": "social",
};

/**
 * The search count for a title over the comparison window. Our own titles use
 * Pulse's search arrivals, the fleet's search figure since Nov 2026. CIM's
 * established titles run no Pulse, so for them it is Search Console's Google
 * clicks or GA4, whichever is higher.
 *
 * CIM's established titles are read from Search Console only once the
 * dashboard's service account is a user on their properties; until then they
 * keep GA4's figure, which there is not hidden behind a consent banner.
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function betterSearch(t, startDate, gscToken) {
  // Our own titles: Pulse's search arrivals, the search figure of record since
  // Nov 2026 (every engine, and only visits that stayed 3 seconds).
  if (t.siteId && ISO_DAY.test(startDate)) {
    try {
      const days = Math.max(1, Math.round((Date.now() - Date.parse(`${startDate}T00:00:00Z`)) / 864e5) + 1);
      const p = await pulseForSite({ id: t.siteId, slug: t.slug }, days);
      if (p) return { count: Number(p.sources?.search) || 0, from: "Pulse" };
    } catch {
      // A site that does not answer falls back to Search Console below.
    }
  }
  const counts = [];
  const domain = t.domain || (t.slug ? await domainFor(t.siteId) : null);
  if (gscToken && domain && ISO_DAY.test(startDate)) {
    try {
      const { googlePost } = await import("./google");
      const end = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
      const r = await googlePost(
        gscToken,
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(`sc-domain:${domain}`)}/searchAnalytics/query`,
        { startDate, endDate: end, type: "web" }
      );
      const clicks = Number(r?.rows?.[0]?.clicks) || 0;
      if (clicks) counts.push({ count: clicks, from: "Search Console" });
    } catch {
      // No access to this property: fall through to the other counts.
    }
  }
  return counts.sort((a, b) => b.count - a.count)[0] || { count: 0, from: null };
}

async function domainFor(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { domain: true } });
  return site?.domain ? String(site.domain).replace(/^www\./, "") : null;
}

export const legacyComparison = unstable_cache(
  async (since) => {
    const { getGoogleAccessToken, googlePost } = await import("./google");
    const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
    const gscToken = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]).catch(() => null);
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(since || "") ? since : "30daysAgo";
    const fleetSites = await prisma.site.findMany({
      where: { status: { in: ["live", "cold_start"] } },
      select: { id: true, slug: true, name: true, accentHex: true },
    });
    const fleet = [];
    for (const s of fleetSites) {
      const { creds } = await siteCredentials(s.id).catch(() => ({ creds: {} }));
      const property = String(creds?.google_analytics?.ga4PropertyId || "").trim();
      if (property) fleet.push({ name: s.name, slug: s.slug, siteId: s.id, property, accentHex: s.accentHex, fleet: true });
    }
    const rows = await mapLimit([...LEGACY_TITLES, ...fleet], CONCURRENCY, async (t) => {
      try {
        const r = await googlePost(token, `https://analyticsdata.googleapis.com/v1beta/properties/${t.property}:runReport`, {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "engagedSessions" }],
        });
        const sources = {};
        for (const x of r.rows || []) {
          const k = CHANNEL_TO_SOURCE[x.dimensionValues[0].value] || "other";
          sources[k] = (sources[k] || 0) + Number(x.metricValues[0].value);
        }
        // Search is the one channel with a better count than GA4's. Search
        // Console's Google clicks need no cookie, and Pulse counts search
        // arrivals on the site itself; GA4 on our titles sees only readers who
        // press Accept (Smart SME, 28 days to 30 Oct 2026: 271 clicks against
        // 88 organic sessions). Pulse replaces GA4's figure on our titles, the
        // higher of the others on CIM's, and the total moves with it so the bar
        // still adds up.
        const ga4Search = sources.search || 0;
        const better = await betterSearch(t, startDate, gscToken);
        let searchFrom = "GA4";
        if (better.from === "Pulse" || better.count > ga4Search) {
          sources.search = better.count;
          searchFrom = better.from;
        }
        const views = Object.values(sources).reduce((a, b) => a + b, 0);
        return { name: t.name, slug: t.slug || null, views, sources, searchFrom, fleet: !!t.fleet, accentHex: t.accentHex || null };
      } catch {
        return null;
      }
    });
    const ok = rows.filter((r) => r && r.views > 0).sort((a, b) => b.views - a.views);
    return [...ok.filter((r) => !r.fleet), ...ok.filter((r) => r.fleet).slice(0, FLEET_IN_COMPARISON)].sort(
      (a, b) => b.views - a.views
    );
  },
  ["legacy-comparison", "v8-pulse-search"],
  { revalidate: 3600 }
);
