import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 8 * 864e5);
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const name = (id) => sites.find((s) => s.id === id)?.slug || "?";
const runs = await p.agentRun.findMany({
  where: { startedAt: { gte: A }, summary: { startsWith: "Press desk" } },
  select: { siteId: true, startedAt: true, summary: true },
  orderBy: { startedAt: "desc" },
});
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
let pub = 0, skip = 0;
for (const r of runs) {
  const s = r.summary.replace(/\s+/g, " ");
  if (/published/i.test(s)) pub++; else skip++;
  console.log(`${uk(r.startedAt)} ${name(r.siteId).padEnd(26)} ${s.slice(0, 150)}`);
}
console.log(`\npress desk 8 days: ${runs.length} items, published ${pub}, skipped ${skip}`);
const items = await p.feedItem.count({ where: { id: { contains: "gmail" } } });
console.log("feed items keyed gmail:", items);
await p.$disconnect();
