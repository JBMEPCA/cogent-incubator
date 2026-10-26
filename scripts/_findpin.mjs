import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const WANT = [
  ["smart-sme", /octopus/i],
  ["gym-business-news", /pilates/i],
  ["nursery-daily", /kids ?planet/i],
  ["senior-lifestyle-business", /michael dell|dell/i],
  ["dental-business-news", /moyle/i],
];
const since = new Date(Date.now() - 21*864e5);
for (const [slug, re] of WANT) {
  const s = await p.site.findUnique({ where: { slug } });
  const arts = await p.article.findMany({
    where: { siteId: s.id, status: "published", publishedAt: { gte: since } },
    select: { title:true, wpPostId:true, publishedAt:true },
    orderBy: { publishedAt: "desc" },
  });
  const hit = arts.filter(a => re.test((a.title||"").replace(/<[^>]+>/g,"")));
  console.log(`\n=== ${slug} (${arts.length} published in 21 days) ===`);
  if (!hit.length) { console.log("  NO MATCH. most recent 8:"); for (const a of arts.slice(0,8)) console.log(`    ${a.wpPostId}  ${(a.title||"").replace(/<[^>]+>/g,"").slice(0,70)}`); continue; }
  for (const a of hit) console.log(`  wp ${String(a.wpPostId).padEnd(6)} ${a.publishedAt.toISOString().slice(0,10)}  ${(a.title||"").replace(/<[^>]+>/g,"").slice(0,74)}`);
}
await p.$disconnect();
