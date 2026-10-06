import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const since = new Date(Date.now() - 30 * 864e5);
const runs = await p.agentRun.findMany({ where: { startedAt: { gte: since }, articleId: { not: null } }, select: { agentKey: true, costUsd: true, articleId: true } });
const arts = await p.article.findMany({ where: { id: { in: [...new Set(runs.map((r) => r.articleId))] } }, select: { id: true, type: true, status: true } });
const byId = new Map(arts.map((a) => [a.id, a]));
const agg = {};
for (const r of runs) {
  const a = byId.get(r.articleId); if (!a) continue;
  const k = a.type; agg[k] ??= { arts: new Set(), pub: new Set(), cost: 0, byAgent: {} };
  agg[k].arts.add(a.id); if (a.status === "published") agg[k].pub.add(a.id);
  agg[k].cost += r.costUsd || 0; agg[k].byAgent[r.agentKey] = (agg[k].byAgent[r.agentKey] || 0) + (r.costUsd || 0);
}
for (const [k, v] of Object.entries(agg)) console.log(k, "articles", v.arts.size, "published", v.pub.size, "total $" + v.cost.toFixed(2), "per published $" + (v.cost / Math.max(1, v.pub.size)).toFixed(3), JSON.stringify(Object.fromEntries(Object.entries(v.byAgent).map(([a, c]) => [a, +c.toFixed(2)]))));
const noArt = await p.agentRun.aggregate({ where: { startedAt: { gte: since }, articleId: null, agentKey: "editor" }, _sum: { costUsd: true }, _count: true });
console.log("editor runs without article:", noArt._count, "$" + (noArt._sum.costUsd || 0).toFixed(2));
await p.$disconnect();
