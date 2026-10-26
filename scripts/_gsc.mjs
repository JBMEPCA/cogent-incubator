import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const day = (n) => new Date(new Date(Date.now()-n*864e5).toISOString().slice(0,10));
const A = day(31), B = day(3), C = day(59), D = day(32);
const iso = (d) => d.toISOString().slice(0,10);
console.log(`Search Console\n  this period  ${iso(A)} to ${iso(B)}\n  prior period ${iso(C)} to ${iso(D)}\n`);
console.log("title".padEnd(27) + "clicks  prior  change    impressions   prior   change");
let c1=0,c0=0,i1=0,i0=0;
for (const s of sites) {
  const rows = await p.metricSnapshot.findMany({ where: { siteId: s.id, day: { gte: C } }, select: { day:true, clicks:true, impressions:true } });
  const sum = (lo,hi) => rows.filter(r=>r.day>=lo&&r.day<=hi).reduce((a,r)=>({c:a.c+(r.clicks||0), i:a.i+(r.impressions||0)}),{c:0,i:0});
  const cur = sum(A,B), pri = sum(C,D);
  c1+=cur.c; c0+=pri.c; i1+=cur.i; i0+=pri.i;
  const pc = pri.c ? ((cur.c-pri.c)/pri.c*100) : null, pi = pri.i ? ((cur.i-pri.i)/pri.i*100) : null;
  console.log(s.slug.padEnd(27) + String(cur.c).padStart(6) + String(pri.c).padStart(7) + (pc===null?"n/a":(pc>=0?"+":"")+pc.toFixed(0)+"%").padStart(8) + String(cur.i).padStart(14) + String(pri.i).padStart(8) + (pi===null?"n/a":(pi>=0?"+":"")+pi.toFixed(0)+"%").padStart(9));
}
const pc=(c1-c0)/Math.max(c0,1)*100, pi=(i1-i0)/Math.max(i0,1)*100;
console.log("FLEET".padEnd(27) + String(c1).padStart(6) + String(c0).padStart(7) + ((pc>=0?"+":"")+pc.toFixed(0)+"%").padStart(8) + String(i1).padStart(14) + String(i0).padStart(8) + ((pi>=0?"+":"")+pi.toFixed(0)+"%").padStart(9));
await p.$disconnect();
