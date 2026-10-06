import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";

const p = new PrismaClient();
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const ga = await getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
const gs = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
let tu = 0, tv = 0, tc = 0, ti = 0;
for (const s of sites) {
  const rows = await p.siteCredential.findMany({ where: { siteId: s.id, kind: "google_analytics" } });
  const g = rows.length ? decryptJson(rows[0].payloadEnc) : null;
  let users = "-", views = "-", email = "-";
  if (g?.ga4PropertyId) {
    try {
      const r = await googlePost(ga, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, {
        dateRanges: [{ startDate: "2026-09-26", endDate: "2026-09-27" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      });
      users = r.rows?.[0]?.metricValues?.[0]?.value ?? "0";
      views = r.rows?.[0]?.metricValues?.[1]?.value ?? "0";
      const e = await googlePost(ga, `https://analyticsdata.googleapis.com/v1beta/properties/${String(g.ga4PropertyId).trim()}:runReport`, {
        dateRanges: [{ startDate: "2026-09-26", endDate: "2026-09-27" }],
        dimensionFilter: { filter: { fieldName: "sessionMedium", stringFilter: { value: "email" } } },
        metrics: [{ name: "sessions" }],
      });
      email = e.rows?.[0]?.metricValues?.[0]?.value ?? "0";
      tu += Number(users); tv += Number(views);
    } catch (err) { users = "err:" + String(err.message).slice(0, 40); }
  }
  let clicks = "-", imps = "-";
  if (g?.gscSiteUrl) {
    try {
      const r = await googlePost(gs, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(g.gscSiteUrl)}/searchAnalytics/query`, {
        startDate: "2026-09-20", endDate: "2026-09-26", dimensions: ["date"], dataState: "all",
      });
      clicks = (r.rows || []).reduce((n, x) => n + x.clicks, 0);
      imps = (r.rows || []).reduce((n, x) => n + x.impressions, 0);
      tc += clicks; ti += imps;
    } catch (err) { clicks = "err"; }
  }
  console.log(`${s.slug.padEnd(28)} users ${String(users).padStart(5)} views ${String(views).padStart(5)} emailSessions ${String(email).padStart(4)} | GSC 7d clicks ${String(clicks).padStart(5)} imps ${imps}`);
}
console.log(`FLEET users ${tu} views ${tv} | GSC 7d clicks ${tc} imps ${ti}`);
await p.$disconnect();
