import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select a.id, a.title, a.status, a."wpPostId", a."qaPassed", a."qaReport", a."imageUrl", a."imageCredit", a.category, a."costUsd", f.link, f.title ft, f."publishedAt", b.name brand, b."prContactEmail"
  from "Article" a join "FeedItem" f on f.id = a."sourceItemId" join "PrBrand" b on b.id = f."brandId"
  where f.link like 'gmail:%' and a."createdAt" > '2026-09-21T12:55:00Z' order by a."createdAt"`);
for (const r of rows) {
  console.log(`\n${r.status} wp=${r.wpPostId} qa=${r.qaPassed} cost=$${r.costUsd?.toFixed(3)} cat=${r.category}\n  title: ${r.title}\n  email: ${r.link} "${r.ft}" sent ${r.publishedAt?.toISOString()}\n  brand: ${r.brand} contact=${r.prContactEmail}\n  image: ${r.imageUrl} credit=${r.imageCredit}`);
  if (!r.qaPassed) console.log("  QA:", String(r.qaReport).slice(0, 900));
}
await p.$disconnect();
