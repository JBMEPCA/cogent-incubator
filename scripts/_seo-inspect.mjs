import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const gs = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
for (const slug of process.argv.slice(2)) {
  const s = await p.site.findUnique({ where: { slug } });
  const g = decryptJson((await p.siteCredential.findFirst({ where: { siteId: s.id, kind: "google_analytics" } })).payloadEnc);
  const xml = await fetch(`https://${s.domain}/post-sitemap.xml`).then(r => r.text());
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => u !== `https://${s.domain}/`);
  // sample: 10 spread across the sitemap (oldest to newest)
  const pick = Array.from({ length: 10 }, (_, i) => urls[Math.floor(i * (urls.length - 1) / 9)]);
  const tally = {};
  console.log(`=== ${slug} property=${g.gscSiteUrl} sitemapPosts=${urls.length}`);
  for (const u of pick) {
    try {
      const r = await googlePost(gs, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: u, siteUrl: g.gscSiteUrl });
      const x = r.inspectionResult.indexStatusResult;
      tally[x.coverageState] = (tally[x.coverageState] || 0) + 1;
      console.log(`  ${x.coverageState} | crawled ${String(x.lastCrawlTime||"").slice(0,10)} | canon ${x.googleCanonical && x.googleCanonical!==u ? x.googleCanonical : "same"} | ${u.replace(/^https:\/\/[^/]+/, "").slice(0,70)}`);
    } catch (e) { console.log("  err", String(e.message).slice(0, 120)); }
  }
  console.log("  tally", JSON.stringify(tally));
}
await p.$disconnect();
