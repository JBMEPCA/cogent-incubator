import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const PINS = {
  "smart-sme": "1295",
  "golf-resort-magazine": "814",
  "airport-business-magazine": "793",
  "gym-business-news": "62",
  "dental-business-news": "186",
  "barbering-business": "662",
  "nursery-daily": "229",
};
for (const [slug, value] of Object.entries(PINS)) {
  const s = await p.site.findUnique({ where: { slug } });
  await p.engineSetting.upsert({
    where: { siteId_key: { siteId: s.id, key: "briefing_pin" } },
    update: { value }, create: { siteId: s.id, key: "briefing_pin", value },
  });
  const back = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "briefing_pin" } } });
  console.log(slug.padEnd(28), "briefing_pin =", back.value);
}
await p.$disconnect();
