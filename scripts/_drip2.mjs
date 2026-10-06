import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-";
const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const byDay = await prisma.$queryRawUnsafe(
    `select date_trunc('day', "importedAt") d, count(*)::int n from "NewsletterProspect" where "siteId" = $1 and "importedAt" is not null group by 1 order by 1 desc limit 3`, s.id);
  console.log(s.slug.padEnd(28), byDay.map((r) => `${uk(r.d).slice(0, 10)}=${r.n}`).join("  "));
}
await prisma.$disconnect();
