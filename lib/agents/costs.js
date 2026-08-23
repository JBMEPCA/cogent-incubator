// One cost model, used by both the Finance Manager and the Costs tab, so the
// page and the agent can never disagree about the numbers.
//
// AI spend is measured from real token usage on every agent run. Fixed
// infrastructure is editable and stored as a setting, because only a human
// knows whether the hosting is already paid for elsewhere.
import { forSite } from "../prisma";

export const FINANCE_REPORT_KEY = "finance:report";
export const FIXED_COSTS_KEY = "finance:fixedCosts";
export const TARGET_KEY = "finance:monthlyTargetGbp";
export const RATE_KEY = "finance:usdToGbp";

export const DEFAULT_TARGET_GBP = 50;
// Anthropic bills in dollars, JB budgets in pounds. A stored rate keeps the
// conversion explicit and adjustable rather than pretending it is exact.
export const DEFAULT_USD_TO_GBP = 0.79;

async function setting(siteId, key, fallback) {
  const db = forSite(siteId);
  const row = await db.engineSetting.findFirst({ where: { key } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const getTargetGbp = (siteId) => setting(siteId, TARGET_KEY, DEFAULT_TARGET_GBP);
export const getRate = (siteId) => setting(siteId, RATE_KEY, DEFAULT_USD_TO_GBP);

export async function saveSetting(siteId, key, value) {
  await forSite(siteId).engineSetting.upsert({
    where: { siteId_key: { siteId, key } },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

// Sensible starting point. Every line is editable on the Costs tab, and the
// two uncertain ones are marked so they read as "confirm this" rather than fact.
export const DEFAULT_FIXED_COSTS = [
  { key: "vercel", label: "Vercel", monthlyUsd: 0, note: "Hobby plan. £16/mo if the mepca team is actually Pro.", confirm: true },
  { key: "hosting", label: "SiteGround hosting", monthlyUsd: 0, note: "Shared with MEPCA. £15-25/mo if billed separately.", confirm: true },
  { key: "domain", label: "Domain", monthlyUsd: 1.25, note: "~£12/year at GoDaddy." },
  { key: "github", label: "GitHub Actions", monthlyUsd: 0, note: "~1,170 of 2,000 free minutes a month." },
  { key: "neon", label: "Neon Postgres", monthlyUsd: 0, note: "Free tier, 0.5GB." },
  { key: "pexels", label: "Pexels images", monthlyUsd: 0, note: "Free, no attribution required." },
  { key: "google", label: "Google APIs", monthlyUsd: 0, note: "Search Console and GA4 are free." },
];

export async function getFixedCosts(siteId) {
  const row = await forSite(siteId).engineSetting.findFirst({ where: { key: FIXED_COSTS_KEY } });
  if (!row) return DEFAULT_FIXED_COSTS;
  try {
    const saved = JSON.parse(row.value);
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_FIXED_COSTS;
  } catch {
    return DEFAULT_FIXED_COSTS;
  }
}

export async function saveFixedCosts(siteId, items) {
  await forSite(siteId).engineSetting.upsert({
    where: { siteId_key: { siteId, key: FIXED_COSTS_KEY } },
    update: { value: JSON.stringify(items) },
    create: { key: FIXED_COSTS_KEY, value: JSON.stringify(items) },
  });
}

export async function buildCostReport(siteId) {
  const db = forSite(siteId);
  const now = Date.now();
  const d30 = new Date(now - 30 * 864e5);
  const d7 = new Date(now - 7 * 864e5);
  const d1 = new Date(now - 864e5);

  const [byAgentRaw, agg7, agg1, published30, failedRuns, firstRun, fixed] = await Promise.all([
    db.agentRun.groupBy({
      by: ["agentKey"],
      where: { startedAt: { gte: d30 } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    db.agentRun.aggregate({ where: { startedAt: { gte: d7 } }, _sum: { costUsd: true }, _count: true }),
    db.agentRun.aggregate({ where: { startedAt: { gte: d1 } }, _sum: { costUsd: true }, _count: true }),
    db.article.count({ where: { publishedAt: { gte: d30 } } }),
    db.agentRun.findMany({ where: { startedAt: { gte: d30 }, ok: false }, select: { agentKey: true } }),
    db.agentRun.findFirst({ orderBy: { startedAt: "asc" }, select: { startedAt: true } }),
    getFixedCosts(siteId),
  ]);

  const agentSpend30 = byAgentRaw.reduce((s, r) => s + (r._sum.costUsd || 0), 0);
  const runs30 = byAgentRaw.reduce((s, r) => s + r._count, 0);

  // Articles made outside the agent runtime carry their own cost. Counting only
  // AgentRun understated total spend and, worse, divided it by an article count
  // that included every batch article, so cost per article read near zero while
  // the real figure was over twenty times that.
  const scripted = await db.article.aggregate({
    where: { publishedAt: { gte: d30 }, costUsd: { not: null } },
    _sum: { costUsd: true },
    _count: true,
  });
  const scriptedSpend30 = scripted._sum.costUsd || 0;
  const scriptedCount = scripted._count;
  const spend30 = agentSpend30 + scriptedSpend30;

  const byAgent = byAgentRaw
    .map((r) => ({
      key: r.agentKey,
      cost: r._sum.costUsd || 0,
      runs: r._count,
      tokens: (r._sum.inputTokens || 0) + (r._sum.outputTokens || 0),
      share: spend30 ? Math.round(((r._sum.costUsd || 0) / spend30) * 100) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // Project from the observed daily rate, but only over days we have actually
  // been running: a system live for two days must not be divided by thirty.
  const daysLive = firstRun
    ? Math.min(30, Math.max(1, (now - new Date(firstRun.startedAt).getTime()) / 864e5))
    : 1;
  const projectedMonthly = (spend30 / daysLive) * 30;

  const fixedMonthly = fixed.reduce((s, f) => s + (Number(f.monthlyUsd) || 0), 0);

  // Daily spend for the trend chart. Every day in the window is present, so a
  // quiet day reads as a genuine zero rather than vanishing from the axis.
  const since = new Date(now - 13 * 864e5);
  const [recentRuns, recentScripted] = await Promise.all([
    db.agentRun.findMany({ where: { startedAt: { gte: since } }, select: { startedAt: true, costUsd: true } }),
    // Same blind spot as the totals: a day the batch publisher ran hard would
    // otherwise show as a flat line.
    db.article.findMany({
      where: { publishedAt: { gte: since }, costUsd: { not: null } },
      select: { publishedAt: true, costUsd: true },
    }),
  ]);
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const spentByDay = {};
  for (const r of recentRuns) {
    spentByDay[dayKey(r.startedAt)] = (spentByDay[dayKey(r.startedAt)] || 0) + (r.costUsd || 0);
  }
  for (const a of recentScripted) {
    spentByDay[dayKey(a.publishedAt)] = (spentByDay[dayKey(a.publishedAt)] || 0) + (a.costUsd || 0);
  }
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 864e5);
    daily.push({ date: dayKey(d), cost: spentByDay[dayKey(d)] || 0 });
  }

  const [targetGbp, rate] = await Promise.all([getTargetGbp(siteId), getRate(siteId)]);
  // Articles produced in the window: everything that got a first draft,
  // including pieces QA later parked. JB's definition of the denominator.
  const produced30 = await db.article.count({
    where: { createdAt: { gte: d30 }, body: { not: null } },
  });
  const totalMonthlyUsd = projectedMonthly + fixedMonthly;

  return {
    daily,
    targetGbp,
    rate,
    totalMonthlyGbp: totalMonthlyUsd * rate,
    targetUsedPct: targetGbp ? Math.round(((totalMonthlyUsd * rate) / targetGbp) * 100) : 0,
    spend30,
    spend7: agg7._sum.costUsd || 0,
    spend24h: agg1._sum.costUsd || 0,
    runs30,
    runs7: agg7._count,
    runs24h: agg1._count,
    published30,
    produced30,
    perArticle: produced30 ? spend30 / produced30 : null,
    // The two pipelines cost very different amounts, and averaging them hides
    // which one to work on. Scripted articles are measured directly; the agent
    // figure is what is left over, spread across the articles it produced.
    agentSpend30,
    scriptedSpend30,
    scriptedCount,
    perArticleScripted: scriptedCount ? scriptedSpend30 / scriptedCount : null,
    perArticleAgent:
      produced30 - scriptedCount > 0 ? agentSpend30 / (produced30 - scriptedCount) : null,
    daysLive: Number(daysLive.toFixed(1)),
    projectedMonthly,
    fixedMonthly,
    totalMonthly: projectedMonthly + fixedMonthly,
    byAgent,
    failed30: failedRuns.length,
    failedAgents: [...new Set(failedRuns.map((f) => f.agentKey))],
    fixed,
  };
}

/**
 * Spend over a window, for the Engine Room header. Same two sources as
 * buildCostReport so the header and the Costs tab cannot quote different
 * numbers.
 *
 * Cost per article is deliberately computed ONLY over articles whose cost is
 * actually recorded. Dividing agent-run spend by every published article read
 * $0.01 while the true figure was around $0.20, because 45 of 46 articles came
 * from the batch publisher and its spend was not in AgentRun at all. An average
 * over a population you cannot see is not a cheap average, it is a wrong one,
 * so `perArticle` is null until there is something real to divide.
 */
export async function spendWindow(siteId, days = 7) {
  const db = forSite(siteId);
  const since = new Date(Date.now() - days * 864e5);

  const [agent, measured, unmeasured] = await Promise.all([
    db.agentRun.aggregate({ where: { startedAt: { gte: since } }, _sum: { costUsd: true }, _count: true }),
    db.article.aggregate({
      where: { publishedAt: { gte: since }, costUsd: { not: null } },
      _sum: { costUsd: true },
      _count: true,
    }),
    db.article.count({ where: { publishedAt: { gte: since }, costUsd: null } }),
  ]);

  const agentSpend = agent._sum.costUsd || 0;
  const articleSpend = measured._sum.costUsd || 0;
  const measuredCount = measured._count;

  return {
    agentSpend,
    articleSpend,
    total: agentSpend + articleSpend,
    runs: agent._count,
    measuredCount,
    unmeasuredCount: unmeasured,
    publishedCount: measuredCount + unmeasured,
    perArticle: measuredCount ? articleSpend / measuredCount : null,
  };
}

export async function getStoredReport(siteId) {
  const db = forSite(siteId);
  const row = await db.engineSetting.findFirst({ where: { key: FINANCE_REPORT_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}
