// Monthly targets: what each title is aiming for this calendar month, and how
// far it has got.
//
// Set by hand on the home page: one number per measure for the whole fleet,
// per month, kept in GlobalSetting under monthly_targets:<month>. (JB, 8 Oct
// 2026: one target for all titles, not one each.) The figures measured
// against them are per title, summed.
//
// Not to be confused with lib/targets.js, which is the milestone board: one-off
// thresholds a title crosses once ("50 articles", "2,500 subscribers"). These
// reset every month.

import { fleetRead } from "./prisma";

export { METRICS, METRIC_KEYS, RINGS_KEY, TARGET_PREFIX, DEFAULT_RINGS, monthKey, monthStart, monthName } from "./monthly-target-metrics";
import { METRIC_KEYS, DEFAULT_RINGS, RINGS_KEY, TARGET_PREFIX, monthKey, monthStart } from "./monthly-target-metrics";

const TARGET_KEY = (month) => `${TARGET_PREFIX}${month}`;

/** { [metric]: value } for one month, exactly as saved, or null. */
async function targetsFor(db, month) {
  const row = await db.globalSetting.findUnique({ where: { key: TARGET_KEY(month) } });
  if (!row) return null;
  try {
    const v = JSON.parse(row.value);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The fleet's targets in force for `month`: one number per measure, for all
 * titles together. When nothing has been saved for the month, the most recent
 * earlier month carries forward, and `carriedFrom` says which, so the editor
 * can say so rather than looking like a fresh save.
 */
export async function targetsInForce(month = monthKey()) {
  const db = fleetRead();
  const own = await targetsFor(db, month);
  if (own) return { month, values: own, saved: true, carriedFrom: null };
  // Keys sort by month because the month is zero-padded ISO.
  const last = await db.globalSetting.findFirst({
    where: { key: { startsWith: TARGET_PREFIX, lt: TARGET_KEY(month) } },
    orderBy: { key: "desc" },
    select: { key: true },
  });
  if (!last) return { month, values: {}, saved: false, carriedFrom: null };
  const from = last.key.slice(TARGET_PREFIX.length);
  return { month, values: (await targetsFor(db, from)) || {}, saved: false, carriedFrom: from };
}

/** Saved ring choice, or the default when unset or unreadable. */
export async function ringMetrics() {
  try {
    const row = await fleetRead().globalSetting.findUnique({ where: { key: RINGS_KEY } });
    const keys = JSON.parse(row?.value || "null");
    if (Array.isArray(keys)) return keys.filter((k) => METRIC_KEYS.includes(k));
  } catch {
    // fall through to the default
  }
  return DEFAULT_RINGS;
}

/**
 * Month-to-date figures per title, for every measure.
 *
 * Visitors and newsletter growth come from AudienceSnapshot, whose figures are
 * running totals, so the month's number is the newest reading less the last
 * reading before the 1st. A title launched this month has no earlier reading
 * and counts from zero. A title with no snapshots at all reads as null, which
 * the page shows as "not connected" rather than as a zero.
 *
 * Spend comes in from the caller (Group costs' own per-title figures, in
 * pounds), so the ring and that page always agree.
 */
export async function monthActuals(sites, { spendGbpBySite = {}, month = monthKey() } = {}) {
  const db = fleetRead();
  const start = monthStart(month);
  const ids = sites.map((s) => s.id);

  const [published, links, latest, before] = await Promise.all([
    db.article.groupBy({
      by: ["siteId"],
      where: { siteId: { in: ids }, status: "published", publishedAt: { gte: start } },
      _count: { _all: true },
    }),
    db.referringDomain.groupBy({
      by: ["siteId"],
      where: { siteId: { in: ids }, ignored: false, firstSeenAt: { gte: start } },
      _count: { _all: true },
    }),
    db.audienceSnapshot.findMany({
      where: { siteId: { in: ids } },
      distinct: ["siteId"],
      orderBy: [{ siteId: "asc" }, { day: "desc" }],
      select: { siteId: true, visitors: true, subscribers: true },
    }),
    db.audienceSnapshot.findMany({
      where: { siteId: { in: ids }, day: { lt: start } },
      distinct: ["siteId"],
      orderBy: [{ siteId: "asc" }, { day: "desc" }],
      select: { siteId: true, visitors: true, subscribers: true },
    }),
  ]);

  const count = (rows) => Object.fromEntries(rows.map((r) => [r.siteId, r._count._all]));
  const pub = count(published);
  const bl = count(links);
  const now = Object.fromEntries(latest.map((r) => [r.siteId, r]));
  const then = Object.fromEntries(before.map((r) => [r.siteId, r]));
  const growth = (id, field) => {
    const v = now[id]?.[field];
    if (v == null) return null;
    return Math.max(0, v - (then[id]?.[field] ?? 0));
  };

  const out = {};
  for (const s of sites) {
    out[s.id] = {
      articles: pub[s.id] || 0,
      visitors: growth(s.id, "visitors"),
      backlinks: bl[s.id] || 0,
      subscribers: growth(s.id, "subscribers"),
      spend: spendGbpBySite[s.id] ?? null,
    };
  }
  return out;
}

/** Sum of one measure across titles, ignoring the ones with no reading. */
export function fleetSum(bySite, metric) {
  return Object.values(bySite).reduce((n, v) => n + (Number(v?.[metric]) || 0), 0);
}
