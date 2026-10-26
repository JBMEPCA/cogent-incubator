import { PrismaClient } from "@prisma/client";
import { specificity } from "../lib/trending.js";
import { risingForSite } from "../lib/rising-articles.js";
import { siteCredentials } from "../lib/site.js";
import { getGoogleAccessToken } from "../lib/google.js";
const p = new PrismaClient();
// 1) Auto-commission replay: matched GB+all trends, fit>=70, 2K+, old vs new top-3 per title per day
const c = await p.trendingTopic.findMany({ where: { source: "google_trends", siteId: { not: null }, relevance: { gte: 70 }, trafficNum: { gte: 2000 } }, include: { site: true } });
const day = (t) => t.firstSeenAt.toISOString().slice(0, 10);
const pick = (rows, newRules) => {
  const groups = new Map();
  for (const r of rows) { if (newRules && (r.market !== "GB" || specificity(r.term) < 2 || r.site.slug === "airport-business-magazine")) continue; const k = r.site.slug + day(r); (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  const out = [];
  for (const g of groups.values()) {
    g.sort(newRules ? (a, b) => Math.min(specificity(b.term), 3) - Math.min(specificity(a.term), 3) || b.relevance - a.relevance || b.trafficNum - a.trafficNum : (a, b) => b.trafficNum - a.trafficNum);
    out.push(...g.slice(0, 3));
  }
  return out;
};
for (const [label, rules] of [["OLD", false], ["NEW", true]]) {
  const r = pick(c, rules); const by = {};
  for (const x of r) by[x.site.slug] = (by[x.site.slug] || 0) + 1;
  console.log(`${label}: ${r.length} picks over ${new Set(c.map(day)).size} days; 1-word ${r.filter(x => specificity(x.term) === 1).length}, 3+ words ${r.filter(x => specificity(x.term) >= 3).length}, non-GB ${r.filter(x => x.market !== "GB").length}`, JSON.stringify(by));
}
console.log("sample NEW picks:", pick(c, true).slice(-12).map(x => `${x.site.slug.slice(0, 8)}: ${x.term}`).join(" | "));
// 2) Rising Articles: old fixed rule vs scaled, per title count in top 30
const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
const isoDay = (o) => new Date(Date.now() - o * 864e5).toISOString().slice(0, 10);
const dates = Array.from({ length: 28 }, (_, i) => isoDay(28 - i));
const per = [];
for (const s of await p.site.findMany({ where: { status: { in: ["live", "cold_start"] } } })) {
  const { creds } = await siteCredentials(s.id); const prop = creds.google_analytics?.gscSiteUrl; if (!prop) continue;
  per.push(await risingForSite(token, s, prop, dates));
}
const oldRows = per.flat().filter(r => r.recent >= 25 && r.change > 0).sort((a, b) => b.change - a.change).slice(0, 30);
const newRows = per.flatMap(rows => { const week = rows.reduce((t, r) => t + r.recent, 0); const floor = Math.min(25, Math.max(5, Math.round(week * 0.01))); return rows.filter(r => r.recent >= floor && r.change > 0).map(r => ({ ...r, share: week ? Math.round(r.change / week * 1000) / 10 : 0, floor })); }).sort((a, b) => b.share - a.share || b.change - a.change).slice(0, 30);
const tally = (rows) => JSON.stringify(rows.reduce((m, r) => (m[r.siteSlug] = (m[r.siteSlug] || 0) + 1, m), {}));
console.log("\nRising OLD top30 by title:", tally(oldRows)); console.log("Rising NEW top30 by title:", tally(newRows));
console.log("NEW top 10:"); for (const r of newRows.slice(0, 10)) console.log(`  ${r.share}% of week  +${r.change} (${r.previous}->${r.recent})  floor ${r.floor}  ${r.siteSlug.slice(0, 12)}  ${r.title.slice(0, 55)}`);
await p.$disconnect();
