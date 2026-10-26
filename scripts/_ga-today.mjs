import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { fetchPageViewsByRange } from "../lib/analytics.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const ranges = [
  { name: "today", startDate: "2026-10-12", endDate: "2026-10-12" },
  { name: "lastMon", startDate: "2026-10-05", endDate: "2026-10-05" },
];
let t=0, l=0;
console.log("title".padEnd(27) + "GA4 today   last Monday   change");
for (const s of sites) {
  const { creds } = await siteCredentials(s.id);
  try {
    const r = await fetchPageViewsByRange(creds.google_analytics, ranges);
    if (!r) { console.log(`${s.slug.padEnd(27)} no GA4 property`); continue; }
    t += r.today; l += r.lastMon;
    const ch = r.lastMon ? ((r.today - r.lastMon)/r.lastMon*100) : null;
    console.log(s.slug.padEnd(27) + String(r.today).padStart(9) + String(r.lastMon).padStart(14) + (ch===null?"n/a":(ch>=0?"+":"")+ch.toFixed(0)+"%").padStart(9));
  } catch (e) { console.log(`${s.slug.padEnd(27)} ${e.message.slice(0,60)}`); }
}
console.log("FLEET".padEnd(27) + String(t).padStart(9) + String(l).padStart(14) + ((t-l)/Math.max(l,1)*100 >= 0 ? "+" : "") + ((t-l)/Math.max(l,1)*100).toFixed(0).padStart(8) + "%");
await p.$disconnect();
