import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-25T23:00:00Z"), B = new Date("2026-09-27T23:00:00Z");
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" });
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
let tot = 0, usd = 0, fails = 0;
for (const s of sites) {
  const pubs = await p.article.findMany({ where: { siteId: s.id, status: "published", publishedAt: { gte: A, lt: B } }, select: { title: true, publishedAt: true, scheduledFor: true }, orderBy: { publishedAt: "asc" } });
  const runs = await p.agentRun.findMany({ where: { siteId: s.id, startedAt: { gte: A, lt: B } }, select: { costUsd: true, ok: true } });
  const cost = runs.reduce((n, r) => n + (r.costUsd || 0), 0);
  tot += pubs.length; usd += cost; fails += runs.filter((r) => !r.ok).length;
  console.log(`${s.slug.padEnd(28)} ${pubs.length} pub  £${(cost * 0.79).toFixed(2)}  runs ${runs.length} fails ${runs.filter((r) => !r.ok).length}`);
  for (const x of pubs) console.log(`    ${uk(x.publishedAt)} ${x.title.slice(0, 72)}`);
}
console.log(`\nWEEKEND total ${tot} published | £${(usd * 0.79).toFixed(2)} | per article £${tot ? ((usd * 0.79) / tot).toFixed(2) : "-"} | failed runs ${fails}`);
const kills = await p.agentMessage.findMany({ where: { createdAt: { gte: A, lt: B }, OR: [{ subject: { startsWith: "Retired" } }, { subject: { startsWith: "Gave up" } }] }, select: { subject: true, siteId: true } });
console.log("kills:", kills.length ? kills.map((m) => `${sites.find((s) => s.id === m.siteId)?.slug}: ${m.subject.slice(0, 70)}`).join(" | ") : "none");
const posts = await p.linkedInPost.findMany({ where: { postedAt: { gte: new Date("2026-09-25T00:00:00Z") } }, select: { siteId: true, postedAt: true } });
console.log("\nsocial posted since Fri:", posts.length);
const byDay = {};
for (const x of posts) { const k = `${uk(x.postedAt).slice(0, 3)}`; byDay[k] = (byDay[k] || 0) + 1; }
console.log(" ", JSON.stringify(byDay), "| titles:", [...new Set(posts.map((x) => sites.find((s) => s.id === x.siteId)?.slug))].join(", "));
await p.$disconnect();
