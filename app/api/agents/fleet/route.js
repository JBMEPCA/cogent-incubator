import { auth } from "@/lib/auth";
import { fleetRead } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { ukDayStart } from "@/lib/schedule";
import { AGENTS } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

// Live state for the engine hub: every agent on every title, in one answer.
//
// The per-title /api/agents route runs ensureAgents() and a handful of queries
// for one site. Calling it ten times from the hub would be ten serverless
// invocations every poll, so this reads the whole fleet with grouped queries
// instead. Reads only — it never creates missing agent rows; a title whose
// agents have not been seeded yet shows up as an empty room.
//
// Money follows Group costs (lib/fleet-costs.js) so the two screens agree:
// spend is AI spend only, every run with a cost plus articles the batch
// publisher costed directly (it has no AgentRun), and cost per article is that
// spend divided by the articles PRODUCED in the same window.
export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const sites = await listSites();
  const db = fleetRead();
  const dayStart = ukDayStart();
  const weekStart = new Date(Date.now() - 7 * 864e5);
  const costed = { costUsd: { gt: 0 } };

  const [agents, runs, scripted, pubToday, pubWeek, recent] = await Promise.all([
    db.agent.findMany({
      select: { siteId: true, key: true, state: true, currentTask: true, detail: true, startedAt: true, lastRunAt: true },
    }),
    // Seven days of costed runs is a few thousand rows across the fleet at most,
    // and one list serves agent totals, title totals and articles produced.
    db.agentRun.findMany({
      where: { startedAt: { gte: weekStart }, ...costed },
      select: { siteId: true, agentKey: true, articleId: true, costUsd: true, startedAt: true },
    }),
    db.article.findMany({
      where: { publishedAt: { gte: weekStart }, ...costed },
      select: { id: true, siteId: true, costUsd: true, publishedAt: true },
    }),
    db.article.groupBy({ by: ["siteId"], where: { publishedAt: { gte: dayStart } }, _count: { _all: true } }),
    db.article.groupBy({ by: ["siteId"], where: { publishedAt: { gte: weekStart } }, _count: { _all: true } }),
    db.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      where: { summary: { not: null } },
      select: { id: true, siteId: true, agentKey: true, summary: true, ok: true, startedAt: true },
    }),
  ]);

  const events = [
    ...runs.map((r) => ({ siteId: r.siteId, agent: r.agentKey, articleId: r.articleId, usd: r.costUsd, at: r.startedAt })),
    ...scripted.map((a) => ({ siteId: a.siteId, agent: "scripted", articleId: a.id, usd: a.costUsd, at: a.publishedAt })),
  ];
  const sum = (xs) => xs.reduce((n, e) => n + e.usd, 0);
  const produced = (xs) => new Set(xs.filter((e) => e.articleId).map((e) => e.articleId)).size;
  const count = (rows, id) => rows.find((r) => r.siteId === id)?._count?._all ?? 0;

  // Today and the last seven days, for any slice of the events.
  const money = (xs) => {
    const today = xs.filter((e) => e.at >= dayStart);
    return { todayUsd: sum(today), weekUsd: sum(xs), producedToday: produced(today), producedWeek: produced(xs) };
  };

  return Response.json({
    sites: sites.map((s) => {
      const mine = events.filter((e) => e.siteId === s.id);
      const m = money(mine);
      return {
        // listSites() already leaves credentials out; SiteMark needs the rest.
        ...s,
        runsToday: runs.filter((r) => r.siteId === s.id && r.startedAt >= dayStart).length,
        costs: {
          ...m,
          publishedToday: count(pubToday, s.id),
          publishedWeek: count(pubWeek, s.id),
          perArticleToday: m.producedToday ? m.todayUsd / m.producedToday : null,
          perArticleWeek: m.producedWeek ? m.weekUsd / m.producedWeek : null,
        },
        agents: agents
          .filter((a) => a.siteId === s.id)
          .map((a) => {
            const am = money(mine.filter((e) => e.agent === a.key));
            return {
              ...a,
              name: AGENTS[a.key]?.name || a.key,
              accent: AGENTS[a.key]?.accent,
              costs: { todayUsd: am.todayUsd, weekUsd: am.weekUsd },
            };
          }),
      };
    }),
    recent,
  });
}
