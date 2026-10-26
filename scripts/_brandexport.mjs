import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const OUT = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad/brands.json";
const PER_TITLE = 140;
const sites = await p.site.findMany({ select: { id: true, slug: true, name: true }, orderBy: { createdAt: "asc" } });
const out = [];
for (const s of sites) {
  const rows = await p.prBrand.findMany({
    where: { siteId: s.id },
    select: { name: true, website: true, newsHubUrl: true, newsletterUrl: true, category: true, feedStatus: true },
    orderBy: { name: "asc" },
  });
  const band = (b) => {
    if (b.newsletterUrl) return 0;                      // a signup page we already found
    if (b.newsHubUrl && b.feedStatus !== "ok") return 1; // newsroom, no feed: email is the only way in
    if (b.newsHubUrl) return 2;                         // newsroom and a feed already
    return 3;                                           // website only
  };
  const curated = (b) => (b.category && b.category !== "mentioned" ? 0 : 1);
  const picked = rows
    .filter((b) => b.website || b.newsHubUrl)
    .sort((a, b) => band(a) - band(b) || curated(a) - curated(b) || a.name.localeCompare(b.name))
    .slice(0, PER_TITLE)
    .map((b) => ({
      n: b.name,
      c: b.category && b.category !== "mentioned" ? b.category : "",
      u: b.newsHubUrl || b.website,
      w: b.website || "",
      s: b.newsletterUrl || "",
      b: band(b),
    }));
  out.push({ slug: s.slug, name: s.name, rows: picked });
  console.log(`${s.slug.padEnd(28)} ${picked.length} rows (band0 ${picked.filter((x) => x.b === 0).length}, band1 ${picked.filter((x) => x.b === 1).length}, band2 ${picked.filter((x) => x.b === 2).length}, band3 ${picked.filter((x) => x.b === 3).length})`);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log("written", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + "KB", "total rows", out.reduce((n, t) => n + t.rows.length, 0));
await p.$disconnect();
