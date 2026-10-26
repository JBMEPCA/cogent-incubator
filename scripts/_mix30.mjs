import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 30*864e5);
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
const byId = new Map(sites.map(s=>[s.id,s.slug]));
const arts = await p.article.findMany({ where: { status: "published", publishedAt: { gte: A } }, select: { id:true, siteId:true, title:true, type:true, sourceItemId:true } });
const feeds = await p.feedItem.findMany({ where: { id: { in: arts.map(a=>a.sourceItemId).filter(Boolean) } }, select: { id:true, link:true } });
const fById = new Map(feeds.map(f=>[f.id,f]));
const trending = await p.trendingTopic.findMany({ where: { articleId: { in: arts.map(a=>a.id) } }, select: { articleId: true } }).catch(()=>[]);
const tIds = new Set(trending.map(t=>t.articleId));
const INTERVIEW = /franchise-eyebrow|In the Chair|SME Leaders|Behind the Mask|Meet the (Manager|Operator|Farmer)|Gym Champions|Fleet Professional|Leaders:|Seven questions/i;
const kind = (a) => {
  const f = a.sourceItemId ? fById.get(a.sourceItemId) : null;
  if (f && f.link.startsWith("gmail:")) return "emailed";
  if (INTERVIEW.test(a.title)) return "interview";
  if (f) return "found";
  if (tIds.has(a.id)) return "trending";
  if (a.type === "seo_original") return "evergreen";
  return "found";
};
const K = ["emailed","trending","evergreen","interview","found"];
const tot = {}, per = {};
for (const a of arts) { const k = kind(a); tot[k]=(tot[k]||0)+1; const s=byId.get(a.siteId); (per[s]=per[s]||{})[k]=((per[s]||{})[k]||0)+1; }
const runs = await p.agentRun.findMany({ where: { startedAt: { gte: A } }, select: { costUsd: true } });
const gbp = runs.reduce((n,r)=>n+(r.costUsd||0),0)*0.79;
console.log(`30 days to today: ${arts.length} articles, £${gbp.toFixed(2)}, ${(gbp/arts.length).toFixed(2)} each, ${(arts.length/30).toFixed(1)}/day\n`);
console.log("title".padEnd(26) + K.map(k=>k.padStart(11)).join("") + "      total");
for (const s of sites) { const r = per[s.slug]||{}; const t = Object.values(r).reduce((n,x)=>n+x,0);
  console.log(s.slug.padEnd(26) + K.map(k=>String(r[k]||0).padStart(11)).join("") + `      ${t}`); }
console.log("TOTAL".padEnd(26) + K.map(k=>String(tot[k]||0).padStart(11)).join("") + `      ${arts.length}`);
await p.$disconnect();
