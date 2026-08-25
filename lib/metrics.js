/**
 * Daily authority snapshots.
 *
 * The question "is our authority going up" has no answer in this app today,
 * because every number it could be built from is a rolling window. Search
 * Console serves roughly sixteen months but the app only ever asks it for the
 * last 28 days, and a position of 78 on 4 August stops being retrievable the
 * moment it ages out. Nothing was writing any of it down.
 *
 * So: one row per title per day, written once and never recomputed.
 *
 * Deliberately NOT Domain Authority. DA is Moz's proprietary metric, it costs
 * money to read, and on a title with no referring domains it reads 1 and stays
 * there for months — a flat line is not a signal. Position, impression breadth
 * and referring domains are the things DA is modelling anyway, and they are
 * free, already available, and already moving.
 */

import { prisma, forSite } from "./prisma";
import { googlePost } from "./google";
import { getGoogleAccessToken } from "./google";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

// Search Console lands 2-3 days late, so the last two days are always
// incomplete and would draw a cliff at the right-hand edge of every graph.
const LAG_DAYS = 3;

/** Midnight UTC on the calendar date of `d`. Search Console reports by date. */
export function dayKey(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

const iso = (d) => dayKey(d).toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

/**
 * Referring DOMAINS as at the end of each day, cumulative.
 *
 * Counted by domain rather than by row: ten links from one site is one
 * referring domain to a search engine, and counting outreach rows would flatter
 * the number in precisely the way that makes it useless. Cumulative because a
 * link won in July is still a link in August — this is a stock, not a flow.
 */
async function referringDomainsByDay(siteId) {
  const db = forSite(siteId);
  const [won, referrers] = await Promise.all([
    db.outreachEmail.findMany({
      where: { status: "linked", linkedAt: { not: null } },
      select: { linkedAt: true, linkUrl: true, brand: { select: { website: true } } },
      orderBy: { linkedAt: "asc" },
    }),
    // Links nobody was emailed about. Counting only won outreach made this a
    // measure of the outreach queue rather than of the title's authority, and
    // it read zero for as long as the sweep failed to confirm anything.
    db.referringDomain.findMany({
      where: { ignored: false },
      select: { firstSeenAt: true, domain: true },
      orderBy: { firstSeenAt: "asc" },
    }),
  ]);

  const dated = [
    ...won.flatMap((row) => {
      let host = null;
      try {
        host = new URL(row.linkUrl || row.brand?.website || "").hostname.replace(/^www\./, "");
      } catch {
        return [];
      }
      return [{ at: row.linkedAt, host }];
    }),
    ...referrers.map((r) => ({ at: r.firstSeenAt, host: r.domain })),
  ].sort((a, b) => a.at - b.at);

  const seen = new Set();
  const runningTotal = [];
  for (const row of dated) {
    // Deduped across both sources: a brand we emailed that then sends us
    // traffic is one referring domain, not two.
    seen.add(row.host);
    runningTotal.push({ at: dayKey(row.at).getTime(), total: seen.size });
  }
  // As-at lookup: the last total recorded on or before that day.
  return (day) => {
    let total = 0;
    for (const p of runningTotal) {
      if (p.at <= day.getTime()) total = p.total;
      else break;
    }
    return total;
  };
}

/** One Search Console query, or null if the property is not reachable. */
async function gsc(token, property, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  try {
    return await googlePost(token, url, body);
  } catch {
    return null;
  }
}

/**
 * Fill (or refill) snapshots for the last `days` days.
 *
 * Idempotent by design — it upserts on (siteId, day), so running it daily keeps
 * the tail fresh and running it once backfills the whole history. Search Console
 * revises recent days upward for about 72 hours, which is exactly why the last
 * few days are rewritten on every run rather than written once and trusted.
 */
export async function snapshotSearchMetrics(site, ga, days = 90) {
  const property = ga?.gscSiteUrl;
  if (!property) return { skipped: "no Search Console property for this title" };

  let token;
  try {
    token = await getGoogleAccessToken(SCOPES);
  } catch (e) {
    return { skipped: `Google sign-in: ${e.message}` };
  }

  const range = { startDate: iso(daysAgo(days)), endDate: iso(daysAgo(LAG_DAYS)) };
  const [totals, byQuery, byPage] = await Promise.all([
    gsc(token, property, { ...range, dimensions: ["date"], rowLimit: 500 }),
    gsc(token, property, { ...range, dimensions: ["date", "query"], rowLimit: 25000 }),
    gsc(token, property, { ...range, dimensions: ["date", "page"], rowLimit: 25000 }),
  ]);
  if (!totals) return { skipped: "Search Console returned nothing for this property" };

  // Distinct queries and pages per day. Breadth moves before clicks do on a
  // young title: ranking for 40 things badly is a better sign than ranking for
  // 3 things badly, and clicks show neither.
  const countBy = (res) => {
    const map = new Map();
    for (const r of res?.rows || []) {
      const day = r.keys[0];
      if (!map.has(day)) map.set(day, new Set());
      map.get(day).add(r.keys[1]);
    }
    return map;
  };
  const queriesPerDay = countBy(byQuery);
  const pagesPerDay = countBy(byPage);
  const domainsAsAt = await referringDomainsByDay(site.id);

  let written = 0;
  for (const row of totals.rows || []) {
    const day = dayKey(new Date(`${row.keys[0]}T00:00:00Z`));
    const data = {
      clicks: Math.round(row.clicks || 0),
      impressions: Math.round(row.impressions || 0),
      position: row.position ?? null,
      queries: queriesPerDay.get(row.keys[0])?.size || 0,
      pages: pagesPerDay.get(row.keys[0])?.size || 0,
      referringDomains: domainsAsAt(day),
    };
    await prisma.metricSnapshot.upsert({
      where: { siteId_day: { siteId: site.id, day } },
      update: data,
      create: { siteId: site.id, day, ...data },
    });
    written += 1;
  }
  return { written, from: range.startDate, to: range.endDate };
}

/** The series behind the graph, oldest first. */
export async function authorityTrend(siteId, days = 60) {
  const rows = await prisma.metricSnapshot.findMany({
    where: { siteId, day: { gte: dayKey(daysAgo(days)) } },
    orderBy: { day: "asc" },
    select: {
      day: true, clicks: true, impressions: true,
      position: true, queries: true, pages: true, referringDomains: true,
    },
  });

  if (rows.length < 2) return { rows, summary: null };

  // Compared as halves rather than first-vs-last: a single quiet Sunday at
  // either end would otherwise decide the direction of the whole trend.
  const half = Math.floor(rows.length / 2);
  const mean = (list, key) => {
    const vals = list.map((r) => r[key]).filter((v) => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const older = rows.slice(0, half);
  const newer = rows.slice(half);
  const latest = rows[rows.length - 1];

  return {
    rows,
    summary: {
      position: { now: mean(newer, "position"), was: mean(older, "position") },
      impressions: { now: mean(newer, "impressions"), was: mean(older, "impressions") },
      queries: { now: mean(newer, "queries"), was: mean(older, "queries") },
      referringDomains: latest.referringDomains,
    },
  };
}
