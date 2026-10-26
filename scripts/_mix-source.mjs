import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.$queryRaw`SELECT to_char(date_trunc('week', rt."createdAt"),'MM-DD') wk, rt.source, a.type::text t, count(*)::int n FROM "ResearchTopic" rt LEFT JOIN "Article" a ON a.id = rt."articleId" WHERE rt.status='commissioned' AND rt."createdAt" > now() - interval '60 days' GROUP BY 1,2,3 ORDER BY 1,2`;
for (const x of r) console.log(x.wk, String(x.source).padEnd(10), String(x.t).padEnd(13), x.n);
const o = await p.$queryRaw`SELECT count(*)::int n FROM "Article" a WHERE a."createdAt" > now() - interval '28 days' AND a.type='pr_rewrite' AND NOT EXISTS (SELECT 1 FROM "ResearchTopic" rt WHERE rt."articleId"=a.id)`;
const t = await p.$queryRaw`SELECT count(*)::int n FROM "TrendingTopic" WHERE "commissionedAt" > now() - interval '28 days'`;
console.log("pr_rewrite not from research (28d):", o[0].n, " trending commissioned 28d:", t[0].n);
await p.$disconnect();
