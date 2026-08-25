/**
 * The targets board: every milestone a title is working towards, with the date
 * each one was crossed.
 *
 * Same philosophy as lib/milestones.js — everything is derived from what is
 * actually true in the database or the live APIs, never from a checkbox — with
 * one addition: the first time a target reads as met it is written to
 * TargetAchievement with the best date the evidence supports, because a derived
 * tick has no date and some of these numbers can go back DOWN (a Mailchimp list
 * clean, a GA4 property change) without un-happening.
 *
 * Backdating: where history exists, a freshly-recorded achievement takes its
 * date from the evidence — the 25th article's own publishedAt, the day the
 * MetricSnapshot running total crossed 100 clicks — rather than "the day the
 * code first looked". Where no history exists (GA4 visitors before
 * AudienceSnapshot started filling) the date is honest-but-late: the day we
 * first saw it crossed.
 */

import { unstable_cache } from "next/cache";
import { getGoogleAccessToken, googlePost, isGoogleConfigured } from "./google";
import { mc } from "./newsletter";
import { issueHistory } from "./newsletter-stats";
import { dayKey } from "./metrics";

const GA_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

export const TARGET_GROUPS = [
  { key: "foundations", label: "Foundations" },
  { key: "traffic", label: "Traffic" },
  { key: "newsletter", label: "Newsletter" },
  { key: "content", label: "Content" },
  { key: "seo", label: "Search & links" },
  { key: "commercial", label: "Commercial" },
];

/** 2500 → "2.5k", 500 → "500". For labels and the fleet chip. */
export const fmtCount = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n);

const addDays = (d, n) => (d ? new Date(new Date(d).getTime() + n * 864e5) : null);

/** First day a per-day series' RUNNING TOTAL reached `target`. */
const cumulativeCross = (rows, pick, target) => {
  let sum = 0;
  for (const r of rows) {
    sum += pick(r) || 0;
    if (sum >= target) return r.day;
  }
  return null;
};

/** First day a per-day LEVEL (already cumulative in the row) reached `target`. */
const levelCross = (rows, pick, target) => {
  for (const r of rows) if ((pick(r) || 0) >= target) return r.day;
  return null;
};

/**
 * The catalog. `value` reads the fact the target is measured against (null =
 * not measurable yet, which can never tick); `when` recovers the historical
 * crossing date where the evidence carries one. `tiered` marks the numeric
 * ladders that show progress bars and feed the fleet card's next-target chip.
 */
const ITEMS = [
  // ---- foundations ----
  {
    key: "setup_complete", group: "foundations", label: "Setup complete", target: 1,
    value: (f) => (f.site.status !== "setup" || (f.setupTotal > 0 && f.setupDone === f.setupTotal) ? 1 : 0),
    when: (f) => f.setupDoneAt,
    evidence: (f) => `${f.setupDone}/${f.setupTotal} provisioning steps done`,
  },
  {
    key: "launched", group: "foundations", label: "Launched", target: 1,
    value: (f) => (f.site.launchedAt || ["cold_start", "live"].includes(f.site.status) ? 1 : 0),
    when: (f) => f.site.launchedAt,
    evidence: (f) => (f.site.launchedAt ? "launch date set" : `status: ${f.site.status}`),
  },
  {
    key: "engine_on", group: "foundations", label: "Engine running", target: 1,
    value: (f) => (f.site.engineEnabled ? 1 : 0),
    evidence: (f) => (f.site.engineEnabled ? "AI team enabled" : "engine switched off"),
  },
  {
    key: "linkedin_started", group: "foundations", label: "LinkedIn started", target: 1,
    value: (f) => f.linkedInPosted,
    when: (f) => f.firstLinkedInAt,
    evidence: (f) => `${f.linkedInPosted} posts live`,
  },
  { key: "live_30", group: "foundations", label: "30 days live", target: 30, tiered: true,
    value: (f) => f.daysLive, when: (f) => addDays(f.site.launchedAt, 30), evidence: (f) => `${f.daysLive} days since launch` },
  { key: "live_90", group: "foundations", label: "90 days live", target: 90, tiered: true,
    value: (f) => f.daysLive, when: (f) => addDays(f.site.launchedAt, 90), evidence: (f) => `${f.daysLive} days since launch` },
  { key: "live_180", group: "foundations", label: "180 days live", target: 180, tiered: true,
    value: (f) => f.daysLive, when: (f) => addDays(f.site.launchedAt, 180), evidence: (f) => `${f.daysLive} days since launch` },

  // ---- traffic (cumulative unique visitors since launch, GA4 totalUsers) ----
  ...[100, 500, 1000, 5000, 25000].map((n) => ({
    key: `visits_${n}`, group: "traffic", label: `${fmtCount(n)} visitors`, target: n, tiered: true,
    value: (f) => f.visitors,
    when: (f) => levelCross(f.audRows, (r) => r.visitors, n),
    evidence: (f) =>
      f.visitors == null ? "GA4 not readable yet" : `${f.visitors} unique visitors since launch (${f.visitorsSource})`,
  })),

  // ---- newsletter ----
  {
    key: "issue_1", group: "newsletter", label: "First issue sent", target: 1,
    value: (f) => f.issuesSent,
    when: (f) => f.issueDates?.[0],
    evidence: (f) => (f.issuesSent == null ? "Mailchimp not readable yet" : `${f.issuesSent} issues sent`),
  },
  ...[4, 12].map((n) => ({
    key: `issues_${n}`, group: "newsletter", label: `${n} issues sent`, target: n, tiered: true,
    value: (f) => f.issuesSent,
    when: (f) => f.issueDates?.[n - 1],
    evidence: (f) => (f.issuesSent == null ? "Mailchimp not readable yet" : `${f.issuesSent} issues sent`),
  })),
  ...[500, 2500, 5000, 10000].map((n) => ({
    key: `subs_${n}`, group: "newsletter", label: `${fmtCount(n)} subscribers`, target: n, tiered: true,
    value: (f) => f.subscribers,
    when: (f) => levelCross(f.audRows, (r) => r.subscribers, n),
    evidence: (f) =>
      f.subscribers == null ? "Mailchimp not readable yet" : `${f.subscribers} on the list (${f.subscribersSource})`,
  })),

  // ---- content ----
  {
    key: "articles_1", group: "content", label: "First article live", target: 1,
    value: (f) => f.published, when: (f) => f.publishedDates[0],
    evidence: (f) => `${f.published} published`,
  },
  ...[25, 50, 100, 250].map((n) => ({
    key: `articles_${n}`, group: "content", label: `${n} articles`, target: n, tiered: true,
    value: (f) => f.published,
    // The date the Nth article went out — the article itself remembers.
    when: (f) => f.publishedDates[n - 1],
    evidence: (f) => `${f.published} published`,
  })),

  // ---- search & links (Search Console history via MetricSnapshot) ----
  {
    key: "click_1", group: "seo", label: "First search click", target: 1,
    value: (f) => f.clicksTotal,
    when: (f) => cumulativeCross(f.snapRows, (r) => r.clicks, 1),
    evidence: (f) => `${f.clicksTotal} clicks recorded`,
  },
  ...[100, 1000].map((n) => ({
    key: `clicks_${n}`, group: "seo", label: `${fmtCount(n)} search clicks`, target: n, tiered: true,
    value: (f) => f.clicksTotal,
    when: (f) => cumulativeCross(f.snapRows, (r) => r.clicks, n),
    evidence: (f) => `${f.clicksTotal} clicks recorded`,
  })),
  {
    key: "backlink_1", group: "seo", label: "First backlink", target: 1,
    value: (f) => f.backlinks,
    when: (f) => f.firstBacklinkAt,
    evidence: (f) => `${f.refDomains} referring domains, ${f.linkedOutreach} outreach links won`,
  },
  ...[10, 25, 50].map((n) => ({
    key: `domains_${n}`, group: "seo", label: `${n} referring domains`, target: n, tiered: true,
    value: (f) => f.refDomainsBest,
    when: (f) => levelCross(f.snapRows, (r) => r.referringDomains, n),
    evidence: (f) => `${f.refDomainsBest} referring domains`,
  })),

  // ---- commercial ----
  {
    key: "prospects_20", group: "commercial", label: "20 advertiser prospects", target: 20, tiered: true,
    value: (f) => f.prospects, when: (f) => f.prospect20At,
    evidence: (f) => `${f.prospects} researched`,
  },
  {
    key: "lead_1", group: "commercial", label: "First lead in CRM", target: 1,
    value: (f) => f.leads, when: (f) => f.firstLeadAt,
    evidence: (f) => `${f.leads} leads`,
  },
  {
    key: "deal_1", group: "commercial", label: "First deal won", target: 1,
    value: (f) => f.wonDeals,
    evidence: (f) => (f.wonDeals ? `${f.wonDeals} won` : "no won deals yet"),
  },
];

// ── Live reads, cached ───────────────────────────────────────────────────────
// Both keyed on the property/audience, never a token, and both 15 minutes —
// the same reasoning as lib/analytics.js. Failures fall back to the latest
// AudienceSnapshot in collectTargetFacts, so a Google outage shows yesterday's
// number rather than blanking the board.

const cachedVisitors = (propertyId, sinceIso) =>
  unstable_cache(
    async () => {
      const token = await getGoogleAccessToken(GA_SCOPES);
      const res = await googlePost(
        token,
        `https://analyticsdata.googleapis.com/v1beta/properties/${String(propertyId).trim()}:runReport`,
        { dateRanges: [{ startDate: sinceIso, endDate: "today" }], metrics: [{ name: "totalUsers" }] }
      );
      return Number(res.rows?.[0]?.metricValues?.[0]?.value || 0);
    },
    ["ga4-cumulative", String(propertyId), sinceIso],
    { revalidate: 900 }
  )();

const cachedNewsletterFacts = (audienceId) =>
  unstable_cache(
    async () => {
      const [list, issues] = await Promise.all([
        mc(`/lists/${audienceId}?fields=stats.member_count`),
        issueHistory(audienceId, 200),
      ]);
      return {
        subscribers: list?.stats?.member_count ?? 0,
        // Oldest first, so issueDates[n-1] is the day the nth issue went out.
        issueDates: issues.map((i) => i.sentAt).reverse(),
      };
    },
    ["newsletter-facts", String(audienceId)],
    { revalidate: 900 }
  )();

// ── Facts ────────────────────────────────────────────────────────────────────

async function collectTargetFacts(ctx) {
  const { site, creds, db } = ctx;

  const [
    steps, publishedRows, linkedInPosted, firstLinkedIn,
    prospects, prospect20, leads, firstLead, wonDeals,
    linkedOutreach, firstLinked, refDomains, firstRef,
    snapRows, audRows,
  ] = await Promise.all([
    db.siteProvisioningStep.findMany({ select: { done: true, doneAt: true } }),
    db.article.findMany({
      where: { status: "published", publishedAt: { not: null } },
      select: { publishedAt: true },
      orderBy: { publishedAt: "asc" },
    }),
    db.linkedInPost.count({ where: { postedAt: { not: null } } }),
    db.linkedInPost.findFirst({ where: { postedAt: { not: null } }, orderBy: { postedAt: "asc" }, select: { postedAt: true } }),
    db.advertiserProspect.count(),
    db.advertiserProspect.findMany({ orderBy: { createdAt: "asc" }, skip: 19, take: 1, select: { createdAt: true } }),
    db.lead.count(),
    db.lead.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.lead.count({ where: { stage: "won" } }),
    db.outreachEmail.count({ where: { linkedAt: { not: null } } }),
    db.outreachEmail.findFirst({ where: { linkedAt: { not: null } }, orderBy: { linkedAt: "asc" }, select: { linkedAt: true } }),
    db.referringDomain.count({ where: { ignored: false } }),
    db.referringDomain.findFirst({ where: { ignored: false }, orderBy: { firstSeenAt: "asc" }, select: { firstSeenAt: true } }),
    db.metricSnapshot.findMany({ orderBy: { day: "asc" }, select: { day: true, clicks: true, referringDomains: true } }),
    db.audienceSnapshot.findMany({ orderBy: { day: "asc" }, select: { day: true, visitors: true, subscribers: true } }),
  ]);

  const latestAud = audRows[audRows.length - 1] || {};

  // Live GA4, falling back to the newest snapshot so a failed read degrades to
  // a slightly stale number instead of an empty column.
  let visitors = null;
  let visitorsSource = "none";
  const sinceIso = new Date(site.launchedAt || site.createdAt).toISOString().slice(0, 10);
  if (isGoogleConfigured() && creds.google_analytics?.ga4PropertyId) {
    try {
      visitors = await cachedVisitors(creds.google_analytics.ga4PropertyId, sinceIso);
      visitorsSource = "live";
    } catch (e) {
      // Logged rather than surfaced: the board falls back to the last snapshot
      // and a GA4 hiccup should not blank a page, but the reason must be
      // findable when a title's visitor column sits empty.
      console.error(`targets: GA4 cumulative read failed for ${site.slug}: ${e.message}`);
    }
  }
  if (visitors == null && latestAud.visitors != null) {
    visitors = latestAud.visitors;
    visitorsSource = "last snapshot";
  }

  // Live Mailchimp, same fallback.
  let subscribers = null;
  let issuesSent = null;
  let issueDates = null;
  let subscribersSource = "none";
  if (creds.mailchimp?.audienceId) {
    try {
      const nl = await cachedNewsletterFacts(creds.mailchimp.audienceId);
      subscribers = nl.subscribers;
      issueDates = nl.issueDates.map((d) => new Date(d));
      issuesSent = issueDates.length;
      subscribersSource = "live";
    } catch {
      /* fall through */
    }
  }
  if (subscribers == null && latestAud.subscribers != null) {
    subscribers = latestAud.subscribers;
    subscribersSource = "last snapshot";
  }

  const clicksTotal = snapRows.reduce((s, r) => s + (r.clicks || 0), 0);
  const snapDomains = snapRows.length ? snapRows[snapRows.length - 1].referringDomains || 0 : 0;

  const backlinkDates = [firstLinked?.linkedAt, firstRef?.firstSeenAt].filter(Boolean);
  const setupDone = steps.filter((s) => s.done).length;

  return {
    site,
    setupDone,
    setupTotal: steps.length,
    setupDoneAt: steps.filter((s) => s.doneAt).map((s) => s.doneAt).sort((a, b) => b - a)[0] || null,
    daysLive: site.launchedAt ? Math.floor((Date.now() - new Date(site.launchedAt).getTime()) / 864e5) : 0,
    published: publishedRows.length,
    publishedDates: publishedRows.map((r) => r.publishedAt),
    linkedInPosted,
    firstLinkedInAt: firstLinkedIn?.postedAt || null,
    prospects,
    prospect20At: prospect20[0]?.createdAt || null,
    leads,
    firstLeadAt: firstLead?.createdAt || null,
    wonDeals,
    linkedOutreach,
    refDomains,
    // The snapshot column and the live table can disagree while a sweep is
    // behind; a target crossed by either reading is crossed.
    refDomainsBest: Math.max(refDomains, snapDomains),
    backlinks: linkedOutreach + refDomains,
    firstBacklinkAt: backlinkDates.length ? new Date(Math.min(...backlinkDates.map((d) => new Date(d)))) : null,
    snapRows,
    audRows,
    visitors,
    visitorsSource,
    subscribers,
    subscribersSource,
    issuesSent,
    issueDates,
  };
}

// ── The board ────────────────────────────────────────────────────────────────

/**
 * Evaluate every target for one title and (by default) record the new
 * crossings and today's audience snapshot. Called from the per-title dashboard
 * render and from /api/cron/targets, so the dates get written whether or not
 * anyone is looking.
 */
export async function targetBoard(ctx, { record = true } = {}) {
  const facts = await collectTargetFacts(ctx);
  const recorded = await ctx.db.targetAchievement.findMany({});
  const byKey = new Map(recorded.map((a) => [a.key, a]));

  const items = ITEMS.map((def) => {
    const value = def.value(facts);
    const measured = value != null && value >= def.target;
    const prior = byKey.get(def.key);
    const fresh = measured && !prior;
    return {
      key: def.key,
      group: def.group,
      label: def.label,
      target: def.target,
      tiered: Boolean(def.tiered),
      value,
      done: measured || Boolean(prior),
      achievedAt: prior?.achievedAt || (measured ? (def.when && def.when(facts)) || new Date() : null),
      progress: def.tiered && value != null ? Math.min(1, value / def.target) : null,
      evidence: def.evidence ? def.evidence(facts) : "",
      fresh,
    };
  });

  if (record) {
    for (const i of items.filter((x) => x.fresh)) {
      // The unique on (siteId, key) makes a race with the cron a no-op.
      await ctx.db.targetAchievement
        .create({ data: { key: i.key, value: i.value, achievedAt: i.achievedAt } })
        .catch(() => {});
    }

    // Only the halves actually measured live get written — see the model note.
    const data = {};
    if (facts.visitorsSource === "live") data.visitors = facts.visitors;
    if (facts.subscribersSource === "live") {
      data.subscribers = facts.subscribers;
      data.issuesSent = facts.issuesSent;
    }
    if (Object.keys(data).length) {
      const day = dayKey(new Date());
      await ctx.db.audienceSnapshot.upsert({
        where: { siteId_day: { siteId: ctx.site.id, day } },
        update: data,
        create: { day, ...data },
      });
    }
  }

  const groups = TARGET_GROUPS.map((g) => {
    const mine = items.filter((i) => i.group === g.key);
    return { ...g, items: mine, done: mine.filter((i) => i.done).length, total: mine.length };
  });

  return {
    groups,
    done: items.filter((i) => i.done).length,
    total: items.length,
    nextUp: nextTarget(facts, new Set(recorded.map((a) => a.key))),
    fresh: items.filter((i) => i.fresh).map((i) => i.key),
  };
}

/**
 * The single target a title should be chasing next: the undone numeric ladder
 * rung it is furthest through. Runs on partial facts too — the fleet overview
 * feeds it snapshot numbers only, so it must never need a live API.
 */
export function nextTarget(facts, achievedKeys) {
  let best = null;
  for (const def of ITEMS) {
    if (!def.tiered || achievedKeys.has(def.key)) continue;
    let value;
    try {
      value = def.value(facts);
    } catch {
      continue;
    }
    if (value != null && value >= def.target) continue; // measured-done, not yet recorded
    const progress = (value || 0) / def.target;
    if (!best || progress > best.progress) {
      best = { key: def.key, label: def.label, value: value ?? 0, target: def.target, progress };
    }
  }
  return best;
}

/**
 * Fleet-card facts shaped for nextTarget(): snapshot numbers only, no live
 * calls, safe to build thirty of on one page.
 */
export function fleetTargetFacts({ site, visitors, subscribers, issuesSent, published }) {
  return {
    site,
    daysLive: site.launchedAt ? Math.floor((Date.now() - new Date(site.launchedAt).getTime()) / 864e5) : 0,
    visitors: visitors ?? null,
    subscribers: subscribers ?? null,
    issuesSent: issuesSent ?? null,
    published: published || 0,
    // Ladders the fleet page has no cheap numbers for read as null and are
    // skipped by nextTarget rather than reported as zero progress.
    clicksTotal: null,
    refDomainsBest: null,
    prospects: null,
    snapRows: [],
    audRows: [],
  };
}
