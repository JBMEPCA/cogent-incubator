// Same write as recordBacklink() in lib/actions.js, minus the session check.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const site = (await prisma.site.findMany({ select: { id: true, slug: true } })).find((s) => /smart/i.test(s.slug));
const linkUrl = "https://miloosh.com/research/saas-pricing-pressure-index-2026";
const row = await prisma.referringDomain.upsert({
  where: { siteId_domain: { siteId: site.id, domain: "miloosh.com" } },
  create: { siteId: site.id, domain: "miloosh.com", linkUrl, source: "manual", landingPage: "/what-business-software-really-costs-in-2026-188-vendor-price-lists-checked/" },
  update: { linkUrl },
});
console.log(`recorded ${row.domain} source=${row.source} firstSeen=${row.firstSeenAt.toISOString()}`);
await prisma.$disconnect();
