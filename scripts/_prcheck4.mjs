import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z");
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
const items = await p.feedItem.findMany({ where: { discoveredAt: { gte: A }, link: { startsWith: "gmail:" } }, select: { siteId: true, status: true, title: true } });
const per = {};
for (const i of items) { const s = sites.find(x=>x.id===i.siteId)?.slug||"?"; (per[s]=per[s]||{})[i.status]=((per[s]||{})[i.status]||0)+1; }
console.log("emails INTO press@ in October, by title and what happened:");
for (const s of sites) console.log(`  ${s.slug.padEnd(28)} ${JSON.stringify(per[s.slug]||{})}`);
console.log("\nSmart SME / Airport subjects received:");
for (const i of items.filter(i=>["smart-sme","airport-business-magazine"].includes(sites.find(x=>x.id===i.siteId)?.slug))) console.log(`  [${i.status}] ${i.title.slice(0,80)}`);
await p.$disconnect();
