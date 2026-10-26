import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const runs = await p.agentRun.findMany({
  where: { agentKey: "newsletter", startedAt: { gte: new Date(Date.now() - 3 * 3600e3) } },
  select: { siteId: true, startedAt: true, endedAt: true, ok: true, summary: true, error: true },
  orderBy: { startedAt: "asc" },
});
console.log("newsletter runs in the last 3 hours:", runs.length);
for (const r of runs) console.log(`${uk(r.startedAt)} ${sites.find((s) => s.id === r.siteId)?.slug.padEnd(26)} ok=${r.ok} ended=${r.endedAt ? uk(r.endedAt) : "RUNNING"} ${(r.error || r.summary || "").slice(0, 80).replace(/\s+/g, " ")}`);
await p.$disconnect();
