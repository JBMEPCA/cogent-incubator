import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-";
const start = new Date(); start.setUTCHours(0, 0, 0, 0);
const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const g = await prisma.article.groupBy({ by: ["status"], where: { siteId: s.id }, _count: true });
  const map = Object.fromEntries(g.map((x) => [x.status, x._count]));
  const todayPub = await prisma.article.count({ where: { siteId: s.id, status: "published", publishedAt: { gte: start } } });
  const due = await prisma.article.findMany({
    where: { siteId: s.id, status: { in: ["approved", "review"] } },
    select: { scheduledFor: true, status: true, imageUrl: true },
    orderBy: { scheduledFor: "asc" }, take: 6,
  });
  console.log(`${s.slug.padEnd(28)} todayPublished=${todayPub} approved=${map.approved || 0} review=${map.review || 0} drafting=${map.drafting || 0} idea=${map.idea || 0} | next: ${due.map((d) => `${d.status}@${uk(d.scheduledFor)}${d.imageUrl ? "+img" : "-noimg"}`).join(", ") || "nothing"}`);
}
await prisma.$disconnect();
