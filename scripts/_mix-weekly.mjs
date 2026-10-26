import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRaw`SELECT to_char(date_trunc('week', "publishedAt"),'YYYY-MM-DD') wk, type::text t, count(*)::int n FROM "Article" WHERE "publishedAt" IS NOT NULL GROUP BY 1,2 ORDER BY 1`;
const m = {}; for (const r of rows) (m[r.wk] ||= {})[r.t] = r.n;
for (const [w, v] of Object.entries(m)) console.log(w, JSON.stringify(v));
const c = await p.$queryRaw`SELECT to_char(date_trunc('week', "createdAt"),'YYYY-MM-DD') wk, type::text t, status::text s, count(*)::int n FROM "Article" WHERE "createdAt" > now() - interval '35 days' AND type='seo_original' GROUP BY 1,2,3 ORDER BY 1`;
console.log("seo_original created by week/status:"); for (const r of c) console.log(" ", r.wk, r.s, r.n);
await p.$disconnect();
