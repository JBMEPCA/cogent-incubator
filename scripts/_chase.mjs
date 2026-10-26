import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const q of ["Airside", "Blezard", "Savani", "Titleist", "Foxhills"]) {
  const a = await p.article.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { title: true, status: true, publishedAt: true, site: { select: { slug: true } } } });
  const f = await p.feedItem.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { status: true, link: true } });
  console.log(`${q.padEnd(10)} articles ${a.length} ${a.map(x=>`[${x.site.slug}/${x.status}]`).join(" ")}   feeditems ${f.length} ${f.map(x=>x.status+(x.link.startsWith("gmail:")?"(email)":"")).join(",")}`);
}
await p.$disconnect();
