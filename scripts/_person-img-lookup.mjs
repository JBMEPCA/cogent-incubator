import "./_env.mjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "golf-resort-magazine" } });
const rows = await prisma.article.findMany({ where: { siteId: site.id, OR: [
  { title: { contains: "Toptracer" } }, { title: { contains: "Dan Grieve" } }, { title: { contains: "Stephen Brown" } } ] },
  select: { id: true, title: true, status: true, wpPostId: true, sourceUrl: true, imageUrl: true, imageSource: true, imageCredit: true, type: true, sourceItem: { select: { link: true } } } });
console.log(JSON.stringify(rows, null, 1));
await prisma.$disconnect();
