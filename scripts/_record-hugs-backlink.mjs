// Same write as recordBacklink() in lib/actions.js, minus the session check.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const site = (await prisma.site.findMany({ select: { id: true, slug: true } })).find((s) => /smart/i.test(s.slug));
const linkUrl = "https://www.hugsandco.com/blogs/news/hugs-co-selected-for-exhibition-at-swedens-bon-orbit-design-gallery";
const row = await prisma.referringDomain.upsert({
  where: { siteId_domain: { siteId: site.id, domain: "hugsandco.com" } },
  create: { siteId: site.id, domain: "hugsandco.com", linkUrl, source: "manual", landingPage: "/london-footwear-brand-hugs-co-selected-for-swedens-tyre-upcycling-gallery-bon-orbit/" },
  update: { linkUrl },
});
console.log(`recorded ${row.domain} source=${row.source} firstSeen=${row.firstSeenAt.toISOString()}`);
await prisma.$disconnect();
