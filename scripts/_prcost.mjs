import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z");
const arts = await p.article.findMany({ where: { status: "published", publishedAt: { gte: A } }, select: { costUsd: true } });
const usd = arts.reduce((n,a)=>n+(a.costUsd||0),0);
console.log(`articles ${arts.length}  usd ${usd.toFixed(2)}  gbp ${(usd*0.745).toFixed(2)}  per article gbp ${(usd*0.745/arts.length).toFixed(2)}`);
await p.$disconnect();
