import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const SINCE = new Date(Date.now() - 60 * 864e5);
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
let activeTotal = 0, brandsTotal = 0;
for (const s of sites) {
  const brands = await p.prBrand.count({ where: { siteId: s.id } });
  const grouped = await p.feedItem.groupBy({
    by: ["brandId"],
    where: { siteId: s.id, discoveredAt: { gte: SINCE } },
    _count: true,
  });
  const active = grouped.length;
  const items = grouped.reduce((n, g) => n + g._count, 0);
  const top = grouped.sort((a, b) => b._count - a._count).slice(0, 3);
  const names = await p.prBrand.findMany({ where: { id: { in: top.map((t) => t.brandId) } }, select: { id: true, name: true } });
  brandsTotal += brands; activeTotal += active;
  console.log(`${s.slug.padEnd(28)} ${String(active).padStart(4)} of ${String(brands).padStart(4)} brands produced ${String(items).padStart(5)} items in 60 days | busiest: ${top.map((t) => `${names.find((n) => n.id === t.brandId)?.name} ${t._count}`).join(", ").slice(0, 60)}`);
}
console.log(`\nFLEET ${activeTotal} of ${brandsTotal} brands active in 60 days`);
await p.$disconnect();
