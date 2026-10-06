import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-";
for (const slug of ["gym-business-news", "dental-business-news", "smart-farming-news", "nursery-daily"]) {
  const s = await prisma.site.findFirst({ where: { slug } });
  const runs = await prisma.agentRun.findMany({ where: { siteId: s.id }, orderBy: { startedAt: "desc" }, take: 6, select: { agentKey: true, ok: true, startedAt: true, summary: true, error: true } });
  console.log(`\n## ${slug}`);
  for (const r of runs) console.log(`  ${uk(r.startedAt)} ${r.agentKey} ok=${r.ok} ${(r.error || r.summary || "").slice(0, 140).replace(/\s+/g, " ")}`);
  const feeds = await prisma.feedItem.count({ where: { siteId: s.id, discoveredAt: { gt: new Date(Date.now() - 2 * 864e5) } } });
  console.log(`  feed items last 48h: ${feeds}`);
}
await prisma.$disconnect();
