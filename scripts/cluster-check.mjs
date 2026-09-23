// What the Researcher will now see, built from each live title's real Search
// Console rows. Reads only; commissions nothing.
import "./_env.mjs";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
import { clusterNearMisses, dropSpentSpikes } from "../lib/keyword-clusters.js";

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
const ds = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const sites = await prisma.site.findMany({ where: { status: "live" }, orderBy: { createdAt: "asc" } });

for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const property = creds.google_analytics?.gscSiteUrl;
  if (!property) continue;
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const pull = async (from, to) =>
    ((await googlePost(token, url, { startDate: ds(from), endDate: ds(to), dimensions: ["query"], rowLimit: 250 })).rows || [])
      .map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: r.position }));

  const [all, recent] = await Promise.all([pull(93, 3), pull(17, 3)]);
  const live = dropSpentSpikes(all, recent);
  const clusters = clusterNearMisses(
    live.filter((r) => r.position >= 4 && r.position <= 40 && r.impressions >= 8),
    { site }
  ).slice(0, 4);

  console.log(`\n### ${site.slug}  (${all.length} queries, ${all.length - live.length} dropped as spent news)`);
  if (!clusters.length) { console.log("   (nothing in the lane yet)"); continue; }
  for (const c of clusters) {
    console.log(`   ${c.queries.length > 1 ? `CLUSTER "${c.key}" x${c.queries.length}` : "single"}: ${c.impressions} impr, ${c.clicks} clicks, pos ${c.position.toFixed(1)}, upside ~${c.upside} clicks/quarter`);
    for (const q of c.queries.slice(0, 7)) console.log(`        "${q.query}" (${q.impressions} @ ${q.position.toFixed(1)})`);
  }
}
await prisma.$disconnect();
