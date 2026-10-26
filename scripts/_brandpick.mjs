import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id: true, slug: true, name: true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const withHub = await p.prBrand.count({ where: { siteId: s.id, newsHubUrl: { not: null } } });
  const hubNoFeed = await p.prBrand.count({ where: { siteId: s.id, newsHubUrl: { not: null }, NOT: { feedStatus: "ok" } } });
  const newsletter = await p.prBrand.count({ where: { siteId: s.id, newsletterUrl: { not: null } } });
  const cats = await p.prBrand.groupBy({ by: ["category"], where: { siteId: s.id }, _count: true, orderBy: { _count: { category: "desc" } }, take: 4 });
  console.log(`${s.slug.padEnd(28)} newsroom ${String(withHub).padStart(4)} | newsroom but no feed ${String(hubNoFeed).padStart(4)} | signup page ${String(newsletter).padStart(3)} | top cats ${cats.map((c) => `${c.category || "-"} ${c._count}`).join(", ").slice(0, 70)}`);
}
await p.$disconnect();
