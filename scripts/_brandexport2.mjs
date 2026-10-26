import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const OUT = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/brands.json";
const DOM = { "smart-sme": "smartsme.co.uk", "fleet-magazine": "thefleetmagazine.co.uk", "golf-resort-magazine": "golfresortmagazine.com", "barbering-business": "barberingbusiness.com", "airport-business-magazine": "airportbusinessmagazine.com", "gym-business-news": "gymbusinessnews.com", "nursery-daily": "nurserydaily.com", "senior-lifestyle-business": "seniorlifestylebusiness.com", "dental-business-news": "dentalbusinessnews.com", "smart-farming-news": "smartfarmingnews.com" };
const PER_TITLE = 140;
const SINCE = new Date(Date.now() - 60 * 864e5);
const RIVAL = /press|magazine|journal|news site|trade title|publisher/i;
const sites = await p.site.findMany({ select: { id: true, slug: true, name: true }, orderBy: { createdAt: "asc" } });
const out = [];
let dropped = 0, rivals = 0;
for (const s of sites) {
  const rows = await p.prBrand.findMany({
    where: { siteId: s.id },
    select: { id: true, name: true, website: true, newsHubUrl: true, newsletterUrl: true, category: true, feedStatus: true },
  });
  const counts = await p.feedItem.groupBy({ by: ["brandId"], where: { siteId: s.id, discoveredAt: { gte: SINCE } }, _count: true });
  const seen = new Map(counts.map((c) => [c.brandId, c._count]));

  const usable = rows.filter((b) => {
    // Saved wire searches are not brands and cannot be signed up to.
    if (/^wire:/i.test(b.name)) { dropped++; return false; }
    return b.website || b.newsHubUrl;
  });

  const band = (b) => {
    if (RIVAL.test(b.category || "")) return 4;          // a rival title, not a PR source
    if (b.newsletterUrl) return 0;
    if (b.newsHubUrl && b.feedStatus !== "ok") return 1;
    if (b.newsHubUrl) return 2;
    return 3;
  };
  const curated = (b) => (b.category && b.category !== "mentioned" ? 0 : 1);
  const picked = usable
    .sort((a, b) => band(a) - band(b) || curated(a) - curated(b) || (seen.get(b.id) || 0) - (seen.get(a.id) || 0) || a.name.localeCompare(b.name))
    .slice(0, PER_TITLE)
    .map((b) => {
      if (band(b) === 4) rivals++;
      return { n: b.name, c: b.category && b.category !== "mentioned" ? b.category : "", u: b.newsHubUrl || b.website, w: b.website || "", s: b.newsletterUrl || "", b: band(b), a: seen.get(b.id) || 0 };
    });
  out.push({ slug: s.slug, name: s.name, email: `press@${DOM[s.slug]}`, rows: picked });
  console.log(`${s.slug.padEnd(28)} ${picked.length} rows | bands ${[0, 1, 2, 3, 4].map((n) => picked.filter((x) => x.b === n).length).join("/")}`);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`dropped ${dropped} saved wire searches, ${rivals} rival titles kept but flagged, total rows ${out.reduce((n, t) => n + t.rows.length, 0)}`);
await p.$disconnect();
