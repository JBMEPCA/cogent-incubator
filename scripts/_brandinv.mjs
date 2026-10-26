import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
let tot = 0;
for (const s of sites) {
  const all = await p.prBrand.count({ where: { siteId: s.id } });
  const web = await p.prBrand.count({ where: { siteId: s.id, website: { not: null } } });
  const hub = await p.prBrand.count({ where: { siteId: s.id, newsHubUrl: { not: null } } });
  const sub = await p.prBrand.count({ where: { siteId: s.id, subscribed: true } });
  const feed = await p.prBrand.count({ where: { siteId: s.id, feedStatus: "ok" } });
  const adv = await p.advertiserProspect.count({ where: { siteId: s.id } });
  tot += all;
  console.log(`${s.slug.padEnd(28)} brands ${String(all).padStart(4)} (site ${web}, newsroom ${hub}, feed ok ${feed}, subscribed ${sub}) | advertiser prospects ${adv}`);
}
console.log("TOTAL brands", tot);
const sample = await p.prBrand.findMany({ where: { newsHubUrl: { not: null } }, select: { name: true, website: true, newsHubUrl: true, newsletterUrl: true, category: true }, take: 4 });
console.log("\nsample:", JSON.stringify(sample, null, 1).slice(0, 700));
await p.$disconnect();
