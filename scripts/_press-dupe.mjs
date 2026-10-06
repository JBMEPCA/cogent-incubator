import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`select a.id, a.title, a.status, a."wpPostId", a."publishedAt", a.type, a."sourceItemId" from "Article" a join "Site" s on s.id=a."siteId" where s.slug='fleet-magazine' and a."createdAt" > now() - interval '1 day' and (a.title ilike '%five vehicles%' or a.title ilike '%fleet%fewer%' or a.body ilike '%Business Data Prospects%')`);
for (const r of rows) console.log(r.status, r.wpPostId, r.type, r.publishedAt?.toISOString(), r.title);
await p.$disconnect();
