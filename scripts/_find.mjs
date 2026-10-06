import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const arts = await prisma.article.findMany({
  where: { siteId: site.id, OR: [{ title: { contains: "Bank Rate", mode: "insensitive" } }, { title: { contains: "3.75", mode: "insensitive" } }] },
  select: { id: true, wpPostId: true, title: true, status: true, imageUrl: true, imageSource: true, imageAlt: true, category: true, keyphrase: true, publishedAt: true },
  orderBy: { createdAt: "desc" }, take: 5,
});
for (const a of arts) console.log(JSON.stringify(a, null, 1));
await prisma.$disconnect();
