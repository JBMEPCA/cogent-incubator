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

const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/**
 * Everything, in one call.
 *
 * Grouped queries across the fleet rather than a loop per title: at twenty-five
 * magazines the difference between four queries and a hundred is the difference
 * between a page and a timeout.
 */
export async function fleetCosts({ days = 30 } = {}) {
  const sites = await listSites();
  const since = new Date(Date.now() - days * 864e5);
  const monthStart = startOfMonth();
  const db = fleetRead();

  const [byAgent, monthBySite, publishedBySite, runsBySite, byArticle] = await Promise.all([
    db.agentRun.groupBy({
      by: ["siteId", "agentKey"],
      where: { startedAt: { gte: since } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    db.agentRun.groupBy({
      by: ["siteId"],
      where: { startedAt: { gte: monthStart } },
      _sum: { costUsd: true },
    }),
    db.article.groupBy({
      by: ["siteId"],
      where: { publishedAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    db.agentRun.groupBy({
      by: ["siteId"],
      where: { startedAt: { gte: since } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    // What one article actually costs to produce.
    //
    // Not total spend divided by articles published: roughly a third of the
    // bill is research, SEO sweeps, LinkedIn drafts, outreach and Director
    // ticks, none of which is article production, and the published count
    // includes pieces put up by hand or by script that the engine never paid
    // for. Both errors point the same way and the answer comes out too low.
    //
    // AgentRun carries the article it was working on, so the honest figure is
    // the sum of the runs attributed to each piece.
    db.agentRun.groupBy({
      by: ["siteId", "articleId"],
      where: { startedAt: { gte: since }, articleId: { not: null }, costUsd: { gt: 0 } },
      _sum: { costUsd: true },
    }),
  ]);

  // Median, not mean: a piece that needed three repair passes costs several
  // times a clean one, and a handful of those drag an average away from what a
  // typical article costs.
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const pick = (rows, id, path) => rows.find((r) => r.siteId === id)?.[path[0]]?.[path[1]] ?? 0;

  const subscriptions = await getFleetSubscriptions();
  const fleetMonthlyUsd = subscriptions.reduce((n, s) => n + (Number(s.monthlyUsd) || 0), 0);
  // Apportioned evenly. Crude on purpose: any usage-weighted split would imply
  // a precision the underlying bills do not have, and would move a title's
  // number when a different title got busier, which reads as a bug.
  const perTitleShareUsd = sites.length ? fleetMonthlyUsd / sites.length : 0;

  const rate = (await getRate(sites[0]?.id).catch(() => null)) || DEFAULT_USD_TO_GBP;

  const titles = [];
  for (const site of sites) {
    const agents = byAgent
      .filter((r) => r.siteId === site.id)
      .map((r) => ({
        agent: r.agentKey,
        runs: r._count._all,
        usd: r._sum.costUsd || 0,
        inputTokens: r._sum.inputTokens || 0,
        outputTokens: r._sum.outputTokens || 0,
      }))
      .sort((a, b) => b.usd - a.usd);

    let fixed = [];
    try {
      fixed = await getFixedCosts(site.id);
    } catch {
      fixed = [];
    }
    const fixedUsd = fixed.reduce((n, f) => n + (Number(f.monthlyUsd) || 0), 0);

    const articleCosts = byArticle.filter((r) => r.siteId === site.id).map((r) => r._sum.costUsd || 0);
    const modelWindowUsd = pick(runsBySite, site.id, ["_sum", "costUsd"]);
    const modelMonthUsd = pick(monthBySite, site.id, ["_sum", "costUsd"]);
    const published = publishedBySite.find((r) => r.siteId === site.id)?._count?._all ?? 0;

    titles.push({
      id: site.id,
      slug: site.slug,
      name: site.name,
      status: site.status,
      engineEnabled: site.engineEnabled,
      accentHex: site.accentHex,
      runs: runsBySite.find((r) => r.siteId === site.id)?._count?._all ?? 0,
      agents,
      modelWindowUsd,
      modelMonthUsd,
      fixed,
      fixedUsd,
      shareOfFleetUsd: perTitleShareUsd,
      // What this title actually costs to run for a month: its own measured
      // model spend, its own fixed lines, and its share of the shared bills.
      totalMonthUsd: modelMonthUsd + fixedUsd + perTitleShareUsd,
      publishedThisMonth: published,
      // Two different questions, kept apart on purpose. "All-in" is what the
      // operation costs per unit of output; "to produce" is what writing one
      // more article actually costs. Presenting either as the other is how a
      // cost page misleads.
      // JB's instruction, 23 Aug 2026: every cost-per-article number on this
      // app is TOTAL spent divided by articles PRODUCED - failures, overheads
      // and all. Not per-published, not a median of write costs: the bigger-
      // picture number. Denominator is every article that got a first draft,
      // including ones QA later killed.
      allInPerArticleUsd: articleCosts.length
        ? (modelMonthUsd + fixedUsd + perTitleShareUsd) / articleCosts.length
        : null,
      producedCount: articleCosts.length,
      medianArticleUsd: median(articleCosts),
      meanArticleUsd: articleCosts.length
        ? articleCosts.reduce((a, b) => a + b, 0) / articleCosts.length
        : null,
    });
  }

  titles.sort((a, b) => b.totalMonthUsd - a.totalMonthUsd);

  const modelMonthUsd = titles.reduce((n, t) => n + t.modelMonthUsd, 0);
  const titleFixedUsd = titles.reduce((n, t) => n + t.fixedUsd, 0);
  const publishedThisMonth = titles.reduce((n, t) => n + t.publishedThisMonth, 0);

  // Every agent across every title, so the biggest line in the whole operation
  // is visible without opening a title.
  const fleetByAgent = {};
  for (const r of byAgent) {
    const a = (fleetByAgent[r.agentKey] ||= { agent: r.agentKey, runs: 0, usd: 0 });
    a.runs += r._count._all;
    a.usd += r._sum.costUsd || 0;
  }

  return {
    days,
    rate,
    titles,
    subscriptions,
    fleetByAgent: Object.values(fleetByAgent).sort((a, b) => b.usd - a.usd),
    totals: {
      modelMonthUsd,
      titleFixedUsd,
      fleetSubscriptionsUsd: fleetMonthlyUsd,
      monthUsd: modelMonthUsd + titleFixedUsd + fleetMonthlyUsd,
      publishedThisMonth,
      allInPerArticleUsd: byArticle.length
        ? (modelMonthUsd + titleFixedUsd + fleetMonthlyUsd) / byArticle.length
        : null,
      medianArticleUsd: median(byArticle.map((r) => r._sum.costUsd || 0)),
      producedCount: byArticle.length,
      // How much of the bill is article production at all. The rest is the
      // work that makes the articles findable and worth linking to, which is
      // not overhead, but is not an article either.
      attributableShare: (() => {
        const attributed = byArticle.reduce((n, r) => n + (r._sum.costUsd || 0), 0);
        const all = runsBySite.reduce((n, r) => n + (r._sum.costUsd || 0), 0);
        return all ? attributed / all : null;
      })(),
    },
  };
}
