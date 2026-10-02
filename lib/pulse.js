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

  const url = `${String(base).replace(/\/$/, "")}/wp-json/cogent/v1/pulse/report?days=${days}&token=${encodeURIComponent(token)}`;
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
    humans: Number(json.humans) || 0,
    bots: Number(json.bots) || 0,
    sources: json.sources || {},
    daily: Array.isArray(json.daily) ? json.daily : [],
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
    const out = { days, bySite: {}, totals: { humans: 0, bots: 0 }, errors: [], counting: 0 };
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
    }
    return out;
  },
  ["fleet-pulse", "v1"],
  { revalidate: 900 }
);
