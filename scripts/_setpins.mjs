import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const PINS = {
  "smart-sme": "1498,1401,1460,1367,1329,1492,1432,1372,1370,1269",
  "fleet-magazine": "901,1030,1064,1096,1112,925,926,965,1034,1129",
  "golf-resort-magazine": "671,899,893,843,845,812,653,765,729,713",
  "barbering-business": "614,848,730,640,818,537,768,751,642,665",
  "airport-business-magazine": "767,739,893,707,821,651,793,891,763,879",
};
for (const [slug, value] of Object.entries(PINS)) {
  const s = await prisma.site.findUnique({ where: { slug } });
  await prisma.engineSetting.upsert({
    where: { siteId_key: { siteId: s.id, key: "newsletter_lead_pin" } },
    update: { value },
    create: { siteId: s.id, key: "newsletter_lead_pin", value },
  });
  const back = await prisma.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "newsletter_lead_pin" } } });
  console.log(slug.padEnd(28), back.value);
}
await prisma.$disconnect();
