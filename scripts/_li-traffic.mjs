import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const ga = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const totals = {};
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "google_analytics" } });
  if (!rows.length) continue;
  const g = decryptJson(rows[0].payloadEnc);
  if (!g?.ga4PropertyId) continue;
  const r = await googlePost(ga, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, {
    dateRanges: [{ startDate: "2026-09-20", endDate: "2026-09-29" }],
    dimensions: [{ name: "date" }],
    dimensionFilter: { filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "linkedin", caseSensitive: false } } },
    metrics: [{ name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  }).catch(() => null);
  const line = (r?.rows || []).map((x) => `${x.dimensionValues[0].value.slice(4)}:${x.metricValues[0].value}`);
  for (const x of r?.rows || []) { const d = x.dimensionValues[0].value.slice(4); totals[d] = (totals[d] || 0) + Number(x.metricValues[0].value); }
  console.log(`${s.slug.padEnd(28)} ${line.join(" ") || "none"}`);
}
console.log("\nFLEET linkedin sessions by day:", Object.entries(totals).sort().map(([d, n]) => `${d}:${n}`).join(" "));
await p.$disconnect();
