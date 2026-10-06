import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" });
const s = await prisma.site.findFirst({ where: { slug: "barbering-business" } });
const rows = await prisma.$queryRawUnsafe(
  `select date_trunc('day', "createdAt") d, count(*)::int n, sum(case when "importedAt" is null and suppressed = false then 1 else 0 end)::int ready
   from "NewsletterProspect" where "siteId" = $1 group by 1 order by 1 desc limit 8`, s.id);
for (const r of rows) console.log(uk(r.d).slice(0, 10), "loaded", r.n, "still ready", r.ready);
await prisma.$disconnect();
