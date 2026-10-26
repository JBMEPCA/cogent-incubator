import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z");
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const arts = await p.article.findMany({
  where: { status: "published", publishedAt: { gte: A } },
  select: { id: true, siteId: true, title: true, type: true, sourceItemId: true },
});
const ids = arts.map(a => a.sourceItemId).filter(Boolean);
const feeds = await p.feedItem.findMany({ where: { id: { in: ids } }, select: { id: true, link: true, brandId: true, title: true } });
const fById = new Map(feeds.map(f => [f.id, f]));
const scheme = {};
for (const f of feeds) { const s = (f.link||"").split(":")[0].replace(/^https?$/,"http(s)") || "(empty)"; scheme[s] = (scheme[s]||0)+1; }
console.log("link schemes across October articles:", scheme);
const brandIds = [...new Set(feeds.map(f => f.brandId).filter(Boolean))];
const brands = brandIds.length ? await p.prBrand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true } }) : [];
const bById = new Map(brands.map(b => [b.id, b.name]));
for (const slug of ["smart-sme","airport-business-magazine"]) {
  const site = sites.find(s => s.slug === slug);
  console.log(`\n=== ${slug} ===`);
  for (const a of arts.filter(x => x.siteId === site.id)) {
    const f = a.sourceItemId ? fById.get(a.sourceItemId) : null;
    console.log(`  [${(a.type||"").slice(0,12).padEnd(12)}] ${(a.title||"").replace(/<[^>]+>/g,"").slice(0,48).padEnd(50)} brand=${(f?.brandId ? bById.get(f.brandId) : "-")||"-"}`.padEnd(120) + ` link=${(f?.link||"-").slice(0,58)}`);
  }
}
await p.$disconnect();
