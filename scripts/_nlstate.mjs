import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const pins = await prisma.engineSetting.findMany({
    where: { siteId: s.id, key: { contains: "pin" } },
  });
  const pubCount = await prisma.article.count({ where: { siteId: s.id, status: "published" } });
  const last7 = await prisma.article.count({ where: { siteId: s.id, status: "published", publishedAt: { gt: new Date(Date.now() - 7 * 864e5) } } });
  console.log(`${s.slug.padEnd(28)} on=${s.newsletterEnabled} pub=${pubCount} last7=${last7} pins=${JSON.stringify(pins.map((p) => [p.key, String(p.value).slice(0, 120)]))}`);
}
await prisma.$disconnect();
