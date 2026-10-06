import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const s = await p.site.findFirst({ where: { slug: "barbering-business" } });
const runs = await p.agentRun.findMany({ where: { siteId: s.id, agentKey: "linkedin", startedAt: { gte: new Date(Date.now() - 5 * 864e5) } }, select: { startedAt: true, ok: true, summary: true, error: true }, orderBy: { startedAt: "desc" }, take: 8 });
for (const r of runs) console.log(`${uk(r.startedAt)} ok=${r.ok} ${(r.error || r.summary || "").slice(0, 90).replace(/\s+/g, " ")}`);
const set = await p.engineSetting.findMany({ where: { siteId: s.id, key: { contains: "instagram" } }, select: { key: true, value: true } });
for (const x of set) console.log(x.key, "=", String(x.value).slice(0, 60));
await p.$disconnect();
