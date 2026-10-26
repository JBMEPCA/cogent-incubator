import { PrismaClient } from "@prisma/client";
import { clusterItems } from "../lib/news-clusters.js";
const p = new PrismaClient();
const MIN = Number(process.env.MINOUT || 3);
for (const s of await p.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, orderBy: { createdAt: "asc" } })) {
  const items = await p.feedItem.findMany({ where: { siteId: s.id, publishedAt: { gte: new Date(Date.now() - 8 * 864e5) } }, select: { title: true, link: true, publishedAt: true, status: true, brand: { select: { name: true } } } });
  // one 36h window ending at each of the last 7 days, deduped by head
  const seen = new Map();
  for (let d = 0; d < 7; d++) {
    const end = Date.now() - d * 864e5, start = end - 36 * 36e5;
    for (const c of clusterItems(items.filter((i) => +i.publishedAt <= end && +i.publishedAt > start), { minOutlets: MIN })) if (!seen.has(c.head)) seen.set(c.head, c);
  }
  const all = [...seen.values()];
  console.log(`\n=== ${s.slug}: ${all.length} stories with ${MIN}+ outlets in 7 days`);
  for (const c of all.slice(0, 8)) console.log(`  [${c.outlets.length}] ${c.firstAt.toISOString().slice(5, 10)} ${c.head.slice(0, 85)}  {${c.outlets.slice(0, 3).join("; ")}}`);
}
await p.$disconnect();
