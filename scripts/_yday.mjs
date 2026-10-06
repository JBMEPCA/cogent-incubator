import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-23T23:00:00Z"), B = new Date("2026-09-24T23:00:00Z");
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
let tot = 0, manual = 0, usd = 0;
const rows = [];
for (const s of sites) {
  const pubs = await p.article.findMany({
    where: { siteId: s.id, status: "published", publishedAt: { gte: A, lt: B } },
    select: { title: true, publishedAt: true, scheduledFor: true },
    orderBy: { publishedAt: "asc" },
  });
  const noSlot = pubs.filter((x) => !x.scheduledFor).length;
  const runs = await p.agentRun.findMany({ where: { siteId: s.id, startedAt: { gte: A, lt: B } }, select: { costUsd: true, ok: true, agentKey: true, error: true } });
  const cost = runs.reduce((n, r) => n + (r.costUsd || 0), 0);
  tot += pubs.length; manual += noSlot; usd += cost;
  rows.push({ slug: s.slug, pub: pubs.length, noSlot, gbp: cost * 0.79, fails: runs.filter((r) => !r.ok).length });
  console.log(`${s.slug.padEnd(28)} pub=${pubs.length} (noslot ${noSlot}) £${(cost * 0.79).toFixed(2)} runs=${runs.length} fails=${runs.filter((r) => !r.ok).length}`);
  for (const x of pubs) console.log(`    ${uk(x.publishedAt)} ${x.title.slice(0, 74)}`);
}
console.log(`\nFLEET published ${tot} (manual ${manual}) | £${(usd * 0.79).toFixed(2)} | per article £${tot ? ((usd * 0.79) / tot).toFixed(2) : "-"}`);

console.log("\n=== newsletter runs ===");
const nl = await p.agentRun.findMany({ where: { agentKey: "newsletter", startedAt: { gte: A, lt: B } }, select: { siteId: true, ok: true, summary: true, error: true, costUsd: true, startedAt: true } });
for (const r of nl) console.log(`${uk(r.startedAt)} ${sites.find((s) => s.id === r.siteId)?.slug.padEnd(28)} ok=${r.ok} £${((r.costUsd || 0) * 0.79).toFixed(2)} ${(r.error || r.summary || "").slice(0, 150).replace(/\s+/g, " ")}`);

console.log("\n=== social / linkedin runs ===");
const li = await p.agentRun.findMany({ where: { agentKey: "linkedin", startedAt: { gte: A, lt: B } }, select: { siteId: true, ok: true, summary: true, error: true } });
for (const r of li) console.log(`${sites.find((s) => s.id === r.siteId)?.slug.padEnd(28)} ok=${r.ok} ${(r.error || r.summary || "").slice(0, 110).replace(/\s+/g, " ")}`);

console.log("\n=== kills ===");
const kills = await p.agentMessage.findMany({ where: { createdAt: { gte: A, lt: B }, OR: [{ subject: { startsWith: "Retired" } }, { subject: { startsWith: "Gave up" } }] }, select: { subject: true, siteId: true } });
for (const m of kills) console.log(`  ${sites.find((s) => s.id === m.siteId)?.slug} ${m.subject.slice(0, 110)}`);
if (!kills.length) console.log("  none");

console.log("\n=== pins now (consumed?) ===");
for (const s of sites) {
  const pin = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "newsletter_lead_pin" } } });
  if (pin) console.log(`  ${s.slug} STILL PINNED ${pin.value.slice(0, 60)}`);
}
await p.$disconnect();
