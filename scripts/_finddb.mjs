import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const WANT = {
  "smart-sme": ["Joyner"],
  "golf-resort-magazine": ["Mountain Lake"],
  "airport-business-magazine": ["Mark Johnston"],
  "gym-business-news": ["Gym Champions", "Champions"],
  "dental-business-news": ["Beaty"],
  "barbering-business": ["Rob Wood"],
  "nursery-daily": ["Konyardi"],
};
const uk = (d) => d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London" }) : "-";
for (const [slug, terms] of Object.entries(WANT)) {
  const site = await p.site.findUnique({ where: { slug } });
  console.log(`\n## ${slug}`);
  for (const q of terms) {
    const arts = await p.article.findMany({
      where: { siteId: site.id, title: { contains: q, mode: "insensitive" }, status: "published" },
      select: { wpPostId: true, title: true, publishedAt: true, imageUrl: true },
      orderBy: { publishedAt: "desc" }, take: 4,
    });
    for (const a of arts) console.log(`  ${String(a.wpPostId).padStart(5)} ${uk(a.publishedAt)} img=${a.imageUrl ? "y" : "n"}  ${a.title.slice(0, 68)}`);
    if (arts.length) break;
  }
}
await p.$disconnect();
