import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id: true, slug: true, newsletterEnabled: true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const pin = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "briefing_pin" } } });
  const ov = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "health_override" } } });
  console.log(`${s.slug.padEnd(28)} on=${s.newsletterEnabled} pin=${pin?.value || "-"} override=${ov ? new Date(ov.value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-"}`);
}
await p.$disconnect();
