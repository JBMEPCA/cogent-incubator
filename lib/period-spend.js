// Spend over any period, for the home page time filter.
//
// Group costs (lib/fleet-costs.js) works in calendar months, which is right
// for bills. The home page's Today / 7D / 1M / All time needs the same money
// over a rolling window: measured AI spend from the same two sources Group
// costs counts (agent runs and script-written articles), plus the month's
// fixed bills spread evenly by day. Spreading is an approximation, and the
// widget says so; a bill paid on the 1st does not really cost a 30th a day.

import { fleetRead } from "./prisma";
import { periodStart } from "./periods";

const MONTH_DAYS = 365.25 / 12;

/** `costs` is fleetCosts() for the rate, fixed bills and titles. */
export async function periodSpend(period, costs) {
  const start = periodStart(period);
  const db = fleetRead();
  const [runs, scripted, firstRun] = await Promise.all([
    db.agentRun.groupBy({
      by: ["siteId", "agentKey"],
      where: { costUsd: { gt: 0 }, ...(start ? { startedAt: { gte: start } } : {}) },
      _sum: { costUsd: true },
    }),
    db.article.groupBy({
      by: ["siteId"],
      where: { costUsd: { gt: 0 }, ...(start ? { publishedAt: { gte: start } } : {}) },
      _sum: { costUsd: true },
    }),
    start ? null : db.agentRun.findFirst({ where: { costUsd: { gt: 0 } }, orderBy: { startedAt: "asc" }, select: { startedAt: true } }),
  ]);

  // How many days of fixed bills this period carries.
  const days = start ? Math.max(1, period.days) : Math.max(1, (Date.now() - (firstRun?.startedAt?.getTime() || Date.now())) / 864e5);
  const share = days / MONTH_DAYS;

  const byAgent = {};
  const bySite = {};
  for (const r of runs) {
    const v = r._sum.costUsd || 0;
    byAgent[r.agentKey] = (byAgent[r.agentKey] || 0) + v;
    bySite[r.siteId] = (bySite[r.siteId] || 0) + v;
  }
  for (const a of scripted) {
    const v = a._sum.costUsd || 0;
    byAgent.scripted = (byAgent.scripted || 0) + v;
    bySite[a.siteId] = (bySite[a.siteId] || 0) + v;
  }

  const aiUsd = Object.values(byAgent).reduce((n, v) => n + v, 0);
  const fixedUsd = (costs.totals.fixedUsd || 0) * share;
  const titles = costs.titles.map((t) => ({
    id: t.id,
    name: t.name,
    accentHex: t.accentHex,
    usd: (bySite[t.id] || 0) + (t.fixedUsd || 0) * share,
  }));

  return {
    rate: costs.rate,
    days,
    share,
    aiUsd,
    fixedUsd,
    totalUsd: aiUsd + fixedUsd,
    byAgent: Object.entries(byAgent)
      .map(([agent, usd]) => ({ agent, usd }))
      .sort((a, b) => b.usd - a.usd),
    titles,
  };
}
