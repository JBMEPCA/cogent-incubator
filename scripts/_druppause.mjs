import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const KEY = "drip.weeklyTarget";
const SAVE = "drip_paused_targets";
const restore = process.argv.includes("--restore");
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });

if (restore) {
  const row = await p.globalSetting.findUnique({ where: { key: SAVE } });
  if (!row) { console.log("nothing saved to restore"); process.exit(1); }
  const saved = JSON.parse(row.value);
  for (const s of sites) {
    if (saved[s.slug] === undefined) continue;
    await p.engineSetting.upsert({
      where: { siteId_key: { siteId: s.id, key: KEY } },
      update: { value: String(saved[s.slug]) },
      create: { siteId: s.id, key: KEY, value: String(saved[s.slug]) },
    });
    console.log("restored", s.slug, saved[s.slug]);
  }
  await p.globalSetting.deleteMany({ where: { key: SAVE } });
  await p.$disconnect();
  process.exit(0);
}

const before = {};
for (const s of sites) {
  const row = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: KEY } } });
  before[s.slug] = row?.value !== undefined ? Number(row.value) : 1000;
}
await p.globalSetting.upsert({
  where: { key: SAVE },
  update: { value: JSON.stringify(before) },
  create: { key: SAVE, value: JSON.stringify(before) },
});
for (const s of sites) {
  await p.engineSetting.upsert({
    where: { siteId_key: { siteId: s.id, key: KEY } },
    update: { value: "0" },
    create: { siteId: s.id, key: KEY, value: "0" },
  });
}
const after = [];
for (const s of sites) {
  const row = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: KEY } } });
  after.push(`${s.slug}=${row.value}`);
}
console.log("saved:", JSON.stringify(before));
console.log("now:  ", after.join(" "));
await p.$disconnect();
