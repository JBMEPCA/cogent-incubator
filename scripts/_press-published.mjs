import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`select s.slug, a."wpPostId", a.status, a.title, a."imageSource", f.link from "Article" a join "FeedItem" f on f.id=a."sourceItemId" join "Site" s on s.id=a."siteId" where f.link like 'gmail:%' and a.status='published' order by a."publishedAt"`);
for (const r of rows) console.log(r.slug, r.wpPostId, r.link, (r.imageSource || "email photo"), "|", r.title);
await p.$disconnect();
