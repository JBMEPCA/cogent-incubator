import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
for (const slug of ["airport-business-magazine", "smart-sme", "golf-resort-magazine", "barbering-business"]) {
  const s = await p.site.findUnique({ where: { slug } });
  const g = decryptJson((await p.siteCredential.findFirst({ where: { siteId: s.id, kind: "google_analytics" } })).payloadEnc);
  const run = (body) => googlePost(t, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, { dateRanges: [{ startDate: "2026-10-01", endDate: "2026-10-25" }], ...body });
  const ch = await run({ dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "screenPageViews" }] });
  const geo = await run({ dimensions: [{ name: "country" }], metrics: [{ name: "screenPageViews" }], dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Direct" } } }, limit: 6, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] });
  const br = await run({ dimensions: [{ name: "browser" }, { name: "operatingSystem" }], metrics: [{ name: "screenPageViews" }], dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Direct" } } }, limit: 6, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] });
  const f = (r) => (r.rows || []).map((x) => `${x.dimensionValues.map((d) => d.value).join("/")} ${x.metricValues.map((m) => m.value).join("/")}`).join(", ");
  console.log(`\n=== ${slug}\n  channels (sessions/views): ${f(ch)}\n  direct by country (views): ${f(geo)}\n  direct by browser/OS (views): ${f(br)}`);
}
await p.$disconnect();
