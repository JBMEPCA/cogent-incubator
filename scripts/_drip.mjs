import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-";
for (const slug of ["barbering-business", "fleet-magazine"]) {
  const s = await prisma.site.findFirst({ where: { slug } });
  const last = await prisma.newsletterProspect.findFirst({ where: { siteId: s.id, importedAt: { not: null } }, orderBy: { importedAt: "desc" }, select: { importedAt: true } });
  const byDay = await prisma.$queryRawUnsafe(
    `select date_trunc('day', "importedAt") d, count(*) n from "NewsletterProspect" where "siteId" = $1 and "importedAt" is not null group by 1 order by 1 desc limit 6`, s.id);
  console.log(slug, "last import:", uk(last?.importedAt), byDay.map((r) => `${uk(r.d).slice(0, 10)}=${r.n}`).join(" "));
}
await prisma.$disconnect();
