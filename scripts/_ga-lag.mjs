import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { fetchPageViewsByRange } from "../lib/analytics.js";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
const days = [["2026-10-09","Fri"],["2026-10-10","Sat"],["2026-10-11","Sun"],["2026-10-12","Mon today"]];
const ranges = days.map(([d]) => ({ name: d, startDate: d, endDate: d }));
const tot = Object.fromEntries(days.map(([d])=>[d,0]));
for (const s of sites) {
  const { creds } = await siteCredentials(s.id);
  try { const r = await fetchPageViewsByRange(creds.google_analytics, ranges); if (r) for (const [d] of days) tot[d] += r[d]||0; } catch (e) { console.log(s.slug, e.message.slice(0,70)); }
}
console.log("GA4 page views, whole fleet:");
for (const [d,lbl] of days) console.log(`  ${d} ${lbl.padEnd(10)} ${String(tot[d]).padStart(5)}`);
await p.$disconnect();
