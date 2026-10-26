import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
// UK midnight today = 23:00 UTC yesterday (BST)
const A = new Date("2026-10-11T23:00:00Z");
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const byId = new Map(sites.map(s=>[s.id,s.slug]));
const arts = await p.article.findMany({ where: { status: "published", publishedAt: { gte: A } }, select: { id:true, siteId:true, title:true, type:true, sourceItemId:true, publishedAt:true } });
const feeds = await p.feedItem.findMany({ where: { id: { in: arts.map(a=>a.sourceItemId).filter(Boolean) } }, select: { id:true, link:true } });
const fById = new Map(feeds.map(f=>[f.id,f]));
const per = {};
for (const a of arts) { const s = byId.get(a.siteId); per[s] = (per[s]||0)+1; }
console.log(`published today so far: ${arts.length}\n`);
for (const s of sites) console.log(`  ${s.slug.padEnd(27)} ${String(per[s.slug]||0).padStart(2)}`);
console.log("\nwhat went up:");
for (const a of arts.sort((x,y)=>x.publishedAt-y.publishedAt)) {
  const f = a.sourceItemId ? fById.get(a.sourceItemId) : null;
  const src = f ? (f.link.startsWith("gmail:") ? "emailed PR" : "found online") : (a.type === "seo_original" ? "evergreen" : "trending");
  console.log(`  ${new Date(a.publishedAt.getTime()+36e5).toISOString().slice(11,16)}  ${byId.get(a.siteId).padEnd(26)} ${src.padEnd(13)} ${a.title.replace(/<[^>]+>/g,"").slice(0,54)}`);
}
const runs = await p.agentRun.findMany({ where: { startedAt: { gte: A } }, select: { costUsd:true, ok:true } });
console.log(`\nruns ${runs.length}, failed ${runs.filter(r=>!r.ok).length}, cost £${(runs.reduce((n,r)=>n+(r.costUsd||0),0)*0.79).toFixed(2)}`);
await p.$disconnect();
