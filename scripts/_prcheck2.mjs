import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z");
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
const byId = new Map(sites.map(s => [s.id, s.slug]));
const arts = await p.article.findMany({
  where: { status: "published", publishedAt: { gte: A } },
  select: { id: true, siteId: true, title: true, type: true, sourceItemId: true },
});
const ids = arts.map(a => a.sourceItemId).filter(Boolean);
const feeds = await p.feedItem.findMany({ where: { id: { in: ids } }, select: { id: true, link: true, brandId: true } });
const fById = new Map(feeds.map(f => [f.id, f]));
const brands = await p.prBrand.findMany({ where: { id: { in: [...new Set(feeds.map(f=>f.brandId))] } }, select: { id: true, name: true, website: true, category: true, siteId: true } });
const bById = new Map(brands.map(b => [b.id, b]));

console.log("=== where the 30 emailed PRs went ===");
const gm = {};
for (const a of arts) { const f = a.sourceItemId ? fById.get(a.sourceItemId) : null; if (f && f.link.startsWith("gmail:")) gm[byId.get(a.siteId)] = (gm[byId.get(a.siteId)]||0)+1; }
console.log(gm);

console.log("\n=== PrBrand categories in play ===");
const cat = {}; for (const b of brands) cat[b.category||"(none)"] = (cat[b.category||"(none)"]||0)+1;
console.log(cat);

// Is the story on the brand's OWN domain (a corporate newsroom = a press release)
// or on somebody else's site (a trade title or aggregator we picked it up from)?
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return ""; } };
const reg = (h) => { const b = h.split("."); return b.length>2 && b.at(-2).length<=3 && b.at(-1).length<=3 ? b.slice(-3).join(".") : b.slice(-2).join("."); };
let own = 0, other = 0; const otherBrands = {};
for (const a of arts) {
  const f = a.sourceItemId ? fById.get(a.sourceItemId) : null;
  if (!f || f.link.startsWith("gmail:")) continue;
  const b = bById.get(f.brandId);
  const bh = b?.website ? reg(host(b.website)) : "";
  const lh = reg(host(f.link));
  if (bh && lh && bh === lh) own++; else { other++; otherBrands[b?.name||"?"] = (otherBrands[b?.name||"?"]||0)+1; }
}
console.log(`\nfeed stories on the brand's own domain: ${own}`);
console.log(`feed stories on somebody else's site:  ${other}`);
console.log("top of those:", Object.entries(otherBrands).sort((a,b)=>b[1]-a[1]).slice(0,22));
await p.$disconnect();
