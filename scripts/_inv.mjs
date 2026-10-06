import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London" }) : "-";
const sites = await p.site.findMany({ select: { id: true, slug: true } });
for (const s of sites) {
  const g = await p.interviewTarget.groupBy({ by: ["status"], where: { siteId: s.id }, _count: true }).catch(() => null);
  if (!g) { console.log("no interviewTarget model"); break; }
  const last = await p.interviewTarget.findFirst({ where: { siteId: s.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, name: true, status: true } });
  console.log(`${s.slug.padEnd(26)} ${g.map((x) => `${x.status}:${x._count}`).join(" ")} | newest ${uk(last?.createdAt)} ${last?.name || ""} ${last?.status || ""}`);
}
await p.$disconnect();
