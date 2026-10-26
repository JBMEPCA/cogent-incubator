// Restore each title's weekly drip allowance from the values saved when JB
// paused imports, then clear the saved copy.
import { PrismaClient } from "@prisma/client";
import { setWeeklyTarget, getWeeklyTarget, countImportable } from "../lib/prospects.js";
const p = new PrismaClient();
const saved = await p.globalSetting.findUnique({ where: { key: "drip_paused_targets" } });
if (!saved?.value) { console.log("no saved targets to restore"); process.exit(1); }
const targets = JSON.parse(saved.value);
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const t = targets[s.slug];
  if (t == null) { console.log(`${s.slug.padEnd(27)} no saved target, left at 0`); continue; }
  await setWeeklyTarget(s.id, t);
  const now = await getWeeklyTarget(s.id);
  const left = await countImportable(s.id);
  console.log(`${s.slug.padEnd(27)} target ${String(now).padStart(5)} a week   ${String(left).padStart(6)} left in the pool`);
}
await p.$disconnect();
