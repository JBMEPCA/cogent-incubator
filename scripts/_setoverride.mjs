import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
// End of today, UK. The two titles JB cleared on 5 October.
const until = new Date("2026-10-05T22:59:00.000Z").toISOString();
for (const slug of ["dental-business-news", "smart-farming-news"]) {
  const s = await p.site.findUnique({ where: { slug } });
  await p.engineSetting.upsert({
    where: { siteId_key: { siteId: s.id, key: "health_override" } },
    update: { value: until },
    create: { siteId: s.id, key: "health_override", value: until },
  });
  const back = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "health_override" } } });
  console.log(slug, "cleared to send until", new Date(back.value).toLocaleString("en-GB", { timeZone: "Europe/London" }));
}
await p.$disconnect();
