import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z");
const sites = await p.site.findMany({ select: { id: true, slug: true, name: true }, orderBy: { createdAt: "asc" } });
const byId = new Map(sites.map(s => [s.id, s]));
const arts = await p.article.findMany({ where: { status: "published", publishedAt: { gte: A } }, select: { id: true, siteId: true, title: true, type: true, sourceItemId: true } });
const feeds = await p.feedItem.findMany({ where: { id: { in: arts.map(a=>a.sourceItemId).filter(Boolean) } }, select: { id: true, link: true, brandId: true } });
const fById = new Map(feeds.map(f => [f.id, f]));
const brands = await p.prBrand.findMany({ where: { id: { in: [...new Set(feeds.map(f=>f.brandId))] } }, select: { id: true, name: true, category: true } });
const bById = new Map(brands.map(b => [b.id, b]));
const trending = await p.trendingTopic.findMany({ where: { articleId: { in: arts.map(a=>a.id) } }, select: { articleId: true } }).catch(()=>[]);
const tIds = new Set(trending.map(t=>t.articleId));
const INTERVIEW = /franchise-eyebrow|In the Chair|SME Leaders|Behind the Mask|Meet the (Manager|Operator|Farmer)|Gym Champions|Fleet Professional|Leaders:|Seven questions/i;
const PUB = /press|aggregat|media|journal|magazine|wire/i;

const kind = (a) => {
  const f = a.sourceItemId ? fById.get(a.sourceItemId) : null;
  if (f && f.link.startsWith("gmail:")) return "PR emailed to press@";
  if (INTERVIEW.test(a.title)) return "interview";
  if (f) {
    const c = bById.get(f.brandId)?.category || "";
    return PUB.test(c) ? "picked up from trade press" : "PR from brand newsroom";
  }
  if (tIds.has(a.id)) return "trending news";
  if (a.type === "seo_original") return "evergreen SEO";
  return `other (${a.type})`;
};
const KINDS = ["PR from brand newsroom","PR emailed to press@","picked up from trade press","trending news","evergreen SEO","interview"];
const tot = {}, per = {};
for (const a of arts) { const k = kind(a); tot[k]=(tot[k]||0)+1; const s=byId.get(a.siteId).slug; (per[s]=per[s]||{})[k]=((per[s]||{})[k]||0)+1; }
const all = [...KINDS, ...Object.keys(tot).filter(k=>!KINDS.includes(k))];
console.log("TOTAL", arts.length);
for (const k of all) if (tot[k]) console.log(`  ${k.padEnd(28)} ${String(tot[k]).padStart(3)}  ${Math.round(tot[k]/arts.length*100)}%`);
console.log("\n" + "title".padEnd(26) + all.filter(k=>tot[k]).map(k=>k.slice(0,10).padStart(12)).join("") + "   total");
for (const s of sites) { const r = per[s.slug]||{}; const t = Object.values(r).reduce((n,x)=>n+x,0);
  console.log(s.slug.padEnd(26) + all.filter(k=>tot[k]).map(k=>String(r[k]||0).padStart(12)).join("") + `   ${t}`); }
console.log("\nbrands counted as trade-press pickups:");
const pk = {}; for (const a of arts) { const f=a.sourceItemId?fById.get(a.sourceItemId):null; if(f&&!f.link.startsWith("gmail:")){const b=bById.get(f.brandId); if(PUB.test(b?.category||"")) pk[`${b.name} (${b.category})`]=(pk[`${b.name} (${b.category})`]||0)+1;} }
for (const [k,v] of Object.entries(pk).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}  ${k}`);
await p.$disconnect();
