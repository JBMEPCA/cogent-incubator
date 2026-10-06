import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-23T23:00:00Z"), B = new Date("2026-09-24T23:00:00Z");
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const sites = await p.site.findMany({ select: { id: true, slug: true, domain: true } });
const arts = await p.article.findMany({
  where: { status: "published", publishedAt: { gte: A, lt: B } },
  select: { siteId: true, title: true, publishedAt: true, scheduledFor: true, url: true, wpPostId: true, sourceItemId: true, costUsd: true },
  orderBy: { publishedAt: "asc" },
});
for (const a of arts) {
  const s = sites.find((x) => x.id === a.siteId);
  console.log(`${uk(a.publishedAt)} ${s.slug.padEnd(26)} slot=${a.scheduledFor ? "yes" : "NO"} src=${a.sourceItemId ? "feed" : "-"} ${a.url || "(no url) wp#" + a.wpPostId}`);
  console.log(`      ${a.title}`);
}
await p.$disconnect();
