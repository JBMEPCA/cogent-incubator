// Read-only: what the news-cluster lane would have surfaced over the last 7 days.
import { PrismaClient } from "@prisma/client";
import { clusterItems, splitHeadline } from "../lib/news-clusters.js";
import { classify } from "../lib/trending.js";
const p = new PrismaClient();
let total = 0, matchedTotal = 0;
for (const site of await p.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, orderBy: { createdAt: "asc" } })) {
  const items = await p.feedItem.findMany({ where: { siteId: site.id, publishedAt: { gte: new Date(Date.now() - 8 * 864e5) } }, select: { title: true, link: true, publishedAt: true, status: true, brand: { select: { name: true } } } });
  const seen = new Map();
  for (let d = 0; d < 7; d++) {
    const end = Date.now() - d * 864e5, start = end - 36 * 36e5;
    for (const c of clusterItems(items.filter((i) => +i.publishedAt <= end && +i.publishedAt > start), { minOutlets: 3 })) if (!seen.has(c.head) && !c.items.some((i) => i.status === "drafted")) seen.set(c.head, c);
  }
  const stories = [...seen.values()];
  const v = await classify(stories.map((s) => ({ term: s.head, traffic: `${s.outlets.length} outlets`, news: s.items.slice(0, 5).map((i) => ({ title: splitHeadline(i.title).head, source: i.outlet })) })), [site], "GB", { feed: "news" });
  const matched = stories.map((s, i) => ({ s, v: v.find((r) => r.i === i) || {} })).filter((x) => x.v.slug === site.slug && Number(x.v.relevance) >= 55);
  total += stories.length; matchedTotal += matched.length;
  console.log(`\n=== ${site.slug}: ${stories.length} wire stories, ${matched.length} matched (fit 55+) in 7 days`);
  for (const { s, v } of matched) console.log(`  fit ${v.relevance} [${s.outlets.length}] ${s.firstAt.toISOString().slice(5, 10)} ${(v.angle || s.head).slice(0, 80)}  | kw: ${(v.keywords || [])[0] || "-"}`);
}
console.log(`\nTOTAL ${total} stories, ${matchedTotal} matched`);
await p.$disconnect();
