import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const now = new Date();
const d = (n) => new Date(Date.now() - n*864e5);
const sites = await p.site.findMany({ select: { id:true, slug:true, status:true, newsletterEnabled:true }, orderBy: { createdAt: "asc" } });
const byId = new Map(sites.map(s=>[s.id,s.slug]));

// articles
const win = [["last 7 days", d(7)], ["last 30 days", d(30)]];
for (const [label, since] of win) {
  const arts = await p.article.findMany({ where: { status:"published", publishedAt:{ gte: since } }, select:{ siteId:true } });
  const per = {}; for (const a of arts) per[byId.get(a.siteId)] = (per[byId.get(a.siteId)]||0)+1;
  console.log(`\n${label}: ${arts.length} published, ${(arts.length/(label.includes("7")?7:30)).toFixed(1)} a day`);
  if (label.includes("7")) for (const s of sites) console.log(`  ${s.slug.padEnd(27)} ${String(per[s.slug]||0).padStart(3)}`);
}
// cost
for (const [label, since] of win) {
  const runs = await p.agentRun.findMany({ where: { startedAt:{ gte: since } }, select:{ costUsd:true, ok:true, agentKey:true } });
  const gbp = runs.reduce((n,r)=>n+(r.costUsd||0),0)*0.79;
  console.log(`\n${label}: ${runs.length} runs, ${runs.filter(r=>!r.ok).length} failed, £${gbp.toFixed(2)}`);
  if (label.includes("7")) {
    const fail = {};
    for (const r of runs.filter(x=>!x.ok)) fail[r.agentKey] = (fail[r.agentKey]||0)+1;
    console.log("  failures by agent:", JSON.stringify(fail));
  }
}
// failure detail last 7d
const f = await p.agentRun.findMany({ where: { startedAt:{ gte: d(7) }, ok:false }, select:{ agentKey:true, error:true } });
const byErr = {};
for (const r of f) { const k = `${r.agentKey} | ${String(r.error||"").slice(0,64)}`; byErr[k]=(byErr[k]||0)+1; }
console.log("\ndistinct failures, last 7 days:");
for (const [k,n] of Object.entries(byErr).sort((a,b)=>b[1]-a[1]).slice(0,12)) console.log(`  ${String(n).padStart(3)}  ${k}`);
// interviews
const iv = await p.interviewTarget.groupBy({ by: ["status"], _count: true }).catch(()=>[]);
console.log("\ninterview pipeline:", iv.map(x=>`${x.status} ${x._count}`).join(", "));
const pub = await p.interviewTarget.count({ where: { status: "published", answeredAt: { gte: d(30) } } }).catch(()=>0);
console.log(`interviews answered and published in 30 days: ${pub}`);
await p.$disconnect();
