import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const f = await p.$queryRawUnsafe(`select f.id, f.link, f.title, f."createdAt", s.slug from "FeedItem" f join "Site" s on s.id=f."siteId" where (f.title ilike '%dairy%' or f.title ilike '%greenhouse%') and f."createdAt" > now() - interval '2 days'`);
console.log("FEED", JSON.stringify(f, null, 1));
const a = await p.$queryRawUnsafe(`select a.id, a.status, a."wpPostId", a.title, a."createdAt", a."publishedAt", s.slug from "Article" a join "Site" s on s.id=a."siteId" where (a.title ilike '%dairy%' or a.title ilike '%emission%' or a.title ilike '%carbon%') and a."createdAt" > now() - interval '2 days'`);
console.log("ART", JSON.stringify(a, null, 1));
const r = await p.$queryRawUnsafe(`select "startedAt", status, summary from "AgentRun" r join "Site" s on s.id=r."siteId" where trigger='press' and s.slug like '%farming%' and "startedAt" > now() - interval '3 hours' order by "startedAt"`);
console.log("RUNS", JSON.stringify(r, null, 1));
await p.$disconnect();
