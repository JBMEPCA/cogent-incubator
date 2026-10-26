import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const since = new Date(Date.now() - 28 * 864e5);
for (const s of await p.site.findMany({ orderBy: { createdAt: "asc" } })) {
  const a = await p.article.groupBy({ by: ["type"], where: { siteId: s.id, publishedAt: { gte: since } }, _count: true });
  const rt = await p.researchTopic.groupBy({ by: ["status"], where: { siteId: s.id, createdAt: { gte: since } }, _count: true });
  const kw = await p.keywordTarget.count({ where: { siteId: s.id } }).catch(() => "?");
  console.log(s.slug.padEnd(26), "perDay", s.articlesPerDayTarget, "| pub28", JSON.stringify(Object.fromEntries(a.map(x => [x.type, x._count]))), "| topics28", JSON.stringify(Object.fromEntries(rt.map(x => [x.status, x._count]))), "| keywordTargets", kw);
}
await p.$disconnect();
