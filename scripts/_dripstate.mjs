import { PrismaClient } from "@prisma/client";
import { getWeeklyTarget, countImportable } from "../lib/prospects.js";
import { mc } from "../lib/newsletter.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const saved = await p.globalSetting.findUnique({ where: { key: "drip_paused_targets" } }).catch(()=>null);
const savedT = saved?.value ? JSON.parse(saved.value) : {};
console.log("title".padEnd(27) + "target now   saved target   left to import   total   imported   suppressed");
let totalLeft = 0;
for (const s of sites) {
  const db = p;
  const [target, left, total, imported, suppressed] = await Promise.all([
    getWeeklyTarget(s.id),
    countImportable(s.id),
    db.newsletterProspect.count({ where: { siteId: s.id } }),
    db.newsletterProspect.count({ where: { siteId: s.id, importedAt: { not: null } } }),
    db.newsletterProspect.count({ where: { siteId: s.id, suppressed: true } }),
  ]);
  totalLeft += left;
  console.log(s.slug.padEnd(27) + String(target).padStart(10) + String(savedT[s.slug] ?? "-").padStart(15) + String(left).padStart(17) + String(total).padStart(8) + String(imported).padStart(11) + String(suppressed).padStart(13));
}
console.log("TOTAL".padEnd(27) + "".padStart(25) + String(totalLeft).padStart(17));
// account headroom
try {
  const acc = await mc(`/?fields=total_subscribers,account_name,pricing_plan_type`);
  console.log(`\nMailchimp account: ${acc.account_name}, plan ${acc.pricing_plan_type}, total_subscribers ${acc.total_subscribers}`);
} catch (e) { console.log("\naccount lookup failed:", e.message.slice(0,90)); }
await p.$disconnect();
