import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const ga = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
for (const slug of ["smart-sme", "golf-resort-magazine", "fleet-magazine"]) {
  const s = await p.site.findUnique({ where: { slug } });
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "google_analytics" } });
  const g = decryptJson(rows[0].payloadEnc);
  const r = await googlePost(ga, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, {
    dateRanges: [{ startDate: "2026-09-21", endDate: "2026-09-27" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  console.log(slug.padEnd(24), (r.rows || []).map((x) => `${x.dimensionValues[0].value.slice(4)}:${x.metricValues[0].value}`).join(" "));
}
await p.$disconnect();
