// What the whole operation costs, and where it goes.
//
// The per-title Costs tab answers "is this magazine worth running". This
// answers a different question — "what am I spending in total, and on what" —
// and the split matters because the two kinds of cost behave differently:
//
//   Model spend is MEASURED, per title, from real token usage on every run.
//   Subscriptions are DECLARED, and most of them are shared. Vercel, Neon,
//   Cloudflare and the Anthropic account do not get more expensive per title,
//   so charging each magazine a full copy would overstate the fleet badly at
//   two titles and absurdly at twenty. They are held once, fleet-wide, and
//   apportioned per title only for the per-title view.
//
// Per-title fixed costs — the domain, hosting if billed separately — stay on
// the title, because those genuinely do multiply.
import { prisma, fleetRead } from "./prisma";
import { listSites } from "./site";
import { getFixedCosts, getRate, DEFAULT_USD_TO_GBP } from "./agents/costs";

/** What each agent's spend is called on Group costs and the home page. */
export const AGENT_LABELS = {
  editor: "Writing articles",
  researcher: "Research",
  seo: "SEO",
  designer: "Images",
  director: "Planning (Director)",
  finance: "Finance checks",
  linkedin: "LinkedIn posts",
  backlink: "Backlink outreach",
  newsletter: "Newsletters",
  scripted: "Batch-written articles",
};

export const FLEET_SUBSCRIPTIONS_KEY = "finance:fleetSubscriptions";

// Shared across every title. Zeros are real: most of this runs on free tiers
// today, and a line at £0 is worth keeping so the moment it stops being free
// there is somewhere obvious for the number to go.
export const DEFAULT_FLEET_SUBSCRIPTIONS = [
  { key: "anthropic", label: "Anthropic API", monthlyUsd: 0, note: "Usage-billed — measured below, not a subscription." },
  { key: "vercel", label: "Vercel", monthlyUsd: 0, note: "Hobby plan. ~$20/mo per member on Pro.", confirm: true },
  { key: "neon", label: "Neon Postgres", monthlyUsd: 0, note: "Free tier, 0.5GB. Watch this as titles are added.", confirm: true },
  { key: "cloudflare", label: "Cloudflare Workers", monthlyUsd: 0, note: "Free plan covers the cron triggers." },
  { key: "mailchimp", label: "Mailchimp", monthlyUsd: 0, note: "Shared account. Scales with total subscribers, not titles.", confirm: true },
  { key: "claude-jb", label: "Anthropic subscription (JB)", monthlyUsd: 0, note: "JB's Claude plan. Separate from the API spend measured below.", confirm: true },
  { key: "make", label: "Make.com", monthlyUsd: 0, note: "Automation platform. Plan billed monthly.", confirm: true },
  { key: "google-workspace", label: "Google Workspace email", monthlyUsd: 0, note: "Billed per mailbox, per month.", confirm: true },
  { key: "millionverifier", label: "MillionVerifier", monthlyUsd: 0, note: "Pay-as-you-go credit." },
  { key: "pexels", label: "Pexels images", monthlyUsd: 0, note: "Free, no attribution required." },
  { key: "google", label: "Google APIs", monthlyUsd: 0, note: "Search Console and GA4 are free." },
];

export async function getFleetSubscriptions() {
  const row = await prisma.globalSetting.findUnique({ where: { key: FLEET_SUBSCRIPTIONS_KEY } });
  if (!row) return DEFAULT_FLEET_SUBSCRIPTIONS;
  try {
    const saved = JSON.parse(row.value);
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_FLEET_SUBSCRIPTIONS;
  } catch {
    return DEFAULT_FLEET_SUBSCRIPTIONS;
  }
}

export async function saveFleetSubscriptions(items) {
  await prisma.globalSetting.upsert({
    where: { key: FLEET_SUBSCRIPTIONS_KEY },
    update: { value: JSON.stringify(items) },
    create: { key: FLEET_SUBSCRIPTIONS_KEY, value: JSON.stringify(items) },
  });
}

/** The USD→GBP rate every fleet figure is shown at. */
export async function fleetRate() {
  const sites = await listSites();
  return (await getRate(sites[0]?.id).catch(() => null)) || DEFAULT_USD_TO_GBP;
}

/**
 * Set one shared bill from the Group costs page, adding it if the key is new.
 *
 * Bills arrive in whichever currency the invoice is in — Google Workspace and
 * Mailchimp bill JB in pounds, Vercel and Make in dollars — so the figure is
 * kept exactly as typed (`amount`, `currency`) and `monthlyUsd` is derived
 * from it. Showing the typed figure back means £14.00 stays £14.00 rather than
 * reappearing as £13.99 after a round trip through dollars.
 */
export async function setFleetSubscription({ key, label, amount, currency }) {
  const rate = await fleetRate();
  const monthlyUsd = currency === "USD" ? amount : amount / rate;
  const items = await getFleetSubscriptions();
  const existing = items.find((i) => i.key === key);
  const next = existing
    ? // Once a figure is set by hand it is no longer awaiting confirmation.
      items.map((i) => (i.key === key ? { ...i, monthlyUsd, amount, currency, confirm: false } : i))
    : [...items, { key, label, monthlyUsd, amount, currency }];
  await saveFleetSubscriptions(next);
}

export async function removeFleetSubscription(key) {
  const items = await getFleetSubscriptions();
  await saveFleetSubscriptions(items.filter((i) => i.key !== key));
}

// Calendar months in UTC, the same boundary the overview's "fleet spend, month"
// uses, so the two screens agree. Through BST that starts the month an hour
// late; at these volumes that is pennies, and two pages disagreeing would cost
// more trust than the hour is worth.
const monthStart = (d, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
const monthLabel = (d) => d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
const monthShort = (d) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

// How far back the month-by-month bars go.
const HISTORY_MONTHS = 6;

// The projection runs on the last seven days' daily rate, not on "spent so far
// divided by days elapsed". On the 2nd of the month the second form projects a
// whole month off one day, and it lags every time a title launches mid-month —
// the fleet went from three to ten titles in September, and a month-average
// would have kept projecting the old fleet for weeks.
const RATE_WINDOW_DAYS = 7;

/**
 * Everything the Group costs page shows, in one call.
 *
 * One read of every costed run and every script-costed article since the start
 * of the history window, then everything — headline tiles, the running-total
 * chart, the month bars, per title and per agent — is summed from those same
 * rows. A separate query per figure is how a headline ends up disagreeing with
 * the chart under it.
 *
 * Zero-cost rows are skipped at the database: they are mostly Director ticks
 * that found nothing to do, about half of all runs, and add nothing here.
 *
 * Spend has two sources and both are counted:
 *   AgentRun.costUsd  — every model call inside an agent turn.
 *   Article.costUsd   — articles written by scripts outside the agent runtime
 *                       (batch-publish). The per-title Costs tab has counted
 *                       these all along; this page did not, and read about 7%
 *                       low because of it.
 *
 * Every figure includes the month's fixed bills (per-title fixed lines plus
 * shared subscriptions) in full from the 1st, because that is when they go out.
 */
export async function fleetCosts({ now = new Date() } = {}) {
  const sites = await listSites();
  const db = fleetRead();

  const thisStart = monthStart(now);
  const nextStart = monthStart(now, 1);
  const prevStart = monthStart(now, -1);
  const historyStart = monthStart(now, -(HISTORY_MONTHS - 1));

  const elapsedMs = now - thisStart;
  const daysInMonth = Math.round((nextStart - thisStart) / 864e5);
  const prevDays = Math.round((thisStart - prevStart) / 864e5);
  const daysElapsed = elapsedMs / 864e5;
  const daysLeft = (nextStart - now) / 864e5;
  // "This point last month": the same number of hours into it, capped at its
  // end so the 31st compares against all of a 30-day month.
  const prevSamePoint = new Date(Math.min(prevStart.getTime() + elapsedMs, thisStart.getTime()));
  const rateSince = new Date(now.getTime() - RATE_WINDOW_DAYS * 864e5);

  const [runs, scripted, publishedThis, publishedPrev] = await Promise.all([
    db.agentRun.findMany({
      where: { startedAt: { gte: historyStart }, costUsd: { gt: 0 } },
      select: { siteId: true, agentKey: true, articleId: true, costUsd: true, startedAt: true },
    }),
    db.article.findMany({
      where: { publishedAt: { gte: historyStart }, costUsd: { gt: 0 } },
      select: { id: true, siteId: true, costUsd: true, publishedAt: true },
    }),
    db.article.groupBy({ by: ["siteId"], where: { publishedAt: { gte: thisStart } }, _count: { _all: true } }),
    db.article.groupBy({ by: ["siteId"], where: { publishedAt: { gte: prevStart, lt: thisStart } }, _count: { _all: true } }),
  ]);

  // One flat list of spend events, whatever produced them.
  const events = [
    ...runs.map((r) => ({ siteId: r.siteId, agent: r.agentKey, articleId: r.articleId, usd: r.costUsd, at: r.startedAt })),
    ...scripted.map((a) => ({ siteId: a.siteId, agent: "scripted", articleId: a.id, usd: a.costUsd, at: a.publishedAt })),
  ];

  const subscriptions = await getFleetSubscriptions();
  const subscriptionsUsd = subscriptions.reduce((n, s) => n + (Number(s.monthlyUsd) || 0), 0);
  // A line still marked to confirm is a placeholder, not a bill that happens to
  // be free. The page names them, rather than letting a total that leaves out
  // Vercel and Mailchimp read as everything. Saving a figure clears the mark.
  const unconfirmed = subscriptions.filter((s) => s.confirm).map((s) => s.label);
  // Apportioned evenly. Crude on purpose: any usage-weighted split would imply
  // a precision the underlying bills do not have, and would move a title's
  // number when a different title got busier, which reads as a bug.
  const perTitleShareUsd = sites.length ? subscriptionsUsd / sites.length : 0;

  const rate = await fleetRate();

  const fixedBySite = {};
  await Promise.all(
    sites.map(async (site) => {
      const fixed = await getFixedCosts(site.id).catch(() => []);
      fixedBySite[site.id] = fixed.reduce((n, f) => n + (Number(f.monthlyUsd) || 0), 0);
    })
  );
  const titleFixedUsd = Object.values(fixedBySite).reduce((a, b) => a + b, 0);
  const fixedUsd = titleFixedUsd + subscriptionsUsd;

  const sum = (xs) => xs.reduce((n, e) => n + e.usd, 0);
  const inThis = events.filter((e) => e.at >= thisStart);
  const inPrev = events.filter((e) => e.at >= prevStart && e.at < thisStart);
  const inPrevToPoint = inPrev.filter((e) => e.at < prevSamePoint);
  const inRate = events.filter((e) => e.at >= rateSince);

  const produced = (xs) => new Set(xs.filter((e) => e.articleId).map((e) => e.articleId)).size;
  const project = (mtdUsd, windowUsd) => mtdUsd + (windowUsd / RATE_WINDOW_DAYS) * daysLeft;

  // ---- per title
  const countFor = (rows, id) => rows.find((r) => r.siteId === id)?._count?._all ?? 0;
  const titles = sites.map((site) => {
    const mine = (xs) => xs.filter((e) => e.siteId === site.id);
    const fixed = fixedBySite[site.id] + perTitleShareUsd;
    const thisUsd = sum(mine(inThis)) + fixed;
    const producedThis = produced(mine(inThis));
    // A title that started spending partway through last month has half a
    // month to compare against, and "up 290%" on that is launch, not drift.
    const firstAt = mine(events).reduce((m, e) => (m && m < e.at ? m : e.at), null);
    const launchedLastMonth = !!firstAt && firstAt >= new Date(prevStart.getTime() + 3 * 864e5) && firstAt < thisStart;
    return {
      id: site.id,
      slug: site.slug,
      name: site.name,
      accentHex: site.accentHex,
      launchedLastMonth,
      thisUsd,
      prevUsd: sum(mine(inPrev)) + fixed,
      projectedUsd: project(sum(mine(inThis)), sum(mine(inRate))) + fixed,
      publishedThis: countFor(publishedThis, site.id),
      publishedPrev: countFor(publishedPrev, site.id),
      producedThis,
      // JB, 6 Oct 2026: cost per article on Group costs and the director's
      // report is AI spend only — every model call, failures included —
      // divided by every article PRODUCED. Subscriptions and domains are the
      // cost of running at all, not of one more article, and folding them in
      // made the figure move whenever a bill was entered. (The per-title Costs
      // tab still shows an all-in figure beside its AI-only one.) Both sides
      // are this calendar month: dividing a month-to-date total by thirty days
      // of articles read far too cheap for the first half of every month.
      perArticleUsd: producedThis ? sum(mine(inThis)) / producedThis : null,
    };
  });
  titles.sort((a, b) => b.projectedUsd - a.projectedUsd);

  // ---- fleet totals
  const thisUsd = sum(inThis) + fixedUsd;
  const prevUsd = sum(inPrev) + fixedUsd;
  const projectedUsd = project(sum(inThis), sum(inRate)) + fixedUsd;
  const producedThis = produced(inThis);
  const producedPrev = produced(inPrev);

  // ---- running total, day by day, this month against last
  const cumulative = (xs, start, days) => {
    const byDay = new Array(days).fill(0);
    for (const e of xs) {
      const d = Math.floor((e.at - start) / 864e5);
      if (d >= 0 && d < days) byDay[d] += e.usd;
    }
    let run = fixedUsd;
    return byDay.map((v) => (run += v));
  };

  // ---- month by month
  const months = [];
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const a = monthStart(now, -i);
    const b = monthStart(now, -i + 1);
    const xs = events.filter((e) => e.at >= a && e.at < b);
    if (!xs.length && !months.length) continue; // before the first spend
    months.push({
      key: a.toISOString().slice(0, 7),
      label: monthShort(a),
      usd: sum(xs) + fixedUsd,
      projectedUsd: i === 0 ? projectedUsd : null,
    });
  }

  // ---- what the money is spent on, this month against last
  const byAgent = {};
  for (const [bucket, xs] of [["thisUsd", inThis], ["prevUsd", inPrev]]) {
    for (const e of xs) {
      (byAgent[e.agent] ||= { agent: e.agent, thisUsd: 0, prevUsd: 0 })[bucket] += e.usd;
    }
  }

  return {
    rate,
    month: {
      label: monthLabel(thisStart),
      prevLabel: monthLabel(prevStart),
      daysInMonth,
      prevDays,
      daysElapsed,
      daysLeft,
    },
    totals: {
      thisUsd,
      prevUsd,
      prevSamePointUsd: sum(inPrevToPoint) + fixedUsd,
      // Measured AI spend alone, without the fixed bills, for the report's
      // "where it went" split.
      prevUsageUsd: sum(inPrev),
      projectedUsd,
      dailyRateUsd: sum(inRate) / RATE_WINDOW_DAYS,
      fixedUsd,
      titleFixedUsd,
      subscriptionsUsd,
      publishedThis: titles.reduce((n, t) => n + t.publishedThis, 0),
      publishedPrev: titles.reduce((n, t) => n + t.publishedPrev, 0),
      producedThis,
      producedPrev,
      // AI spend only; see perArticleUsd on each title.
      perArticleUsd: producedThis ? sum(inThis) / producedThis : null,
      perArticlePrevUsd: producedPrev ? sum(inPrev) / producedPrev : null,
    },
    running: {
      this: cumulative(inThis, thisStart, daysInMonth).slice(0, Math.ceil(daysElapsed)),
      prev: cumulative(inPrev, prevStart, prevDays),
    },
    months,
    titles,
    byAgent: Object.values(byAgent).sort((a, b) => b.thisUsd - a.thisUsd || b.prevUsd - a.prevUsd),
    subscriptions,
    unconfirmed,
  };
}
