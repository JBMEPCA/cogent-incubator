import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const gs = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
const sites = await p.site.findMany({ orderBy: { createdAt: "asc" } });
const d = (x) => x.toISOString().slice(0, 10);
const add = (x, n) => new Date(x.getTime() + n * 864e5);
const end = new Date(process.env.END || "2026-10-14");
for (const s of sites) {
  const row = (await p.siteCredential.findMany({ where: { siteId: s.id, kind: "google_analytics" } }))[0];
  const g = row ? decryptJson(row.payloadEnc) : null;
  const arts = await p.article.findMany({ where: { siteId: s.id, status: "published" }, select: { publishedAt: true, type: true, wpPostId: true } });
  const refs = await p.referringDomain.count({ where: { siteId: s.id } }).catch(() => "?");
  const out = { slug: s.slug, domain: s.domain, launched: s.launchedAt && d(s.launchedAt), published: arts.length, refDomains: refs };
  const byType = {}; for (const a of arts) byType[a.type] = (byType[a.type] || 0) + 1; out.byType = byType;
  const l28 = arts.filter(a => a.publishedAt && a.publishedAt > add(end, -28)).length; out.pubLast28 = l28;
  if (g?.gscSiteUrl) {
    const u = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(g.gscSiteUrl)}`;
    try {
      const days = await googlePost(gs, u + "/searchAnalytics/query", { startDate: "2026-06-01", endDate: d(end), dimensions: ["date"], dataState: "all", rowLimit: 500 });
      const rows = days.rows || [];
      const first = rows.find(r => r.impressions > 0)?.keys[0];
      out.firstImpr = first;
      if (first) {
        const f = new Date(first);
        const sum = (a, b) => rows.filter(r => r.keys[0] >= a && r.keys[0] <= b).reduce((t, r) => ({ c: t.c + r.clicks, i: t.i + r.impressions }), { c: 0, i: 0 });
        out.first28 = sum(first, d(add(f, 27)));
        out.last28 = sum(d(add(end, -27)), d(end));
        out.last7 = sum(d(add(end, -6)), d(end));
      }
      const pos = await googlePost(gs, u + "/searchAnalytics/query", { startDate: d(add(end, -27)), endDate: d(end), dataState: "all" });
      out.pos28 = pos.rows?.[0] && { ctr: +(pos.rows[0].ctr * 100).toFixed(2), pos: +pos.rows[0].position.toFixed(1) };
      const pages = await googlePost(gs, u + "/searchAnalytics/query", { startDate: d(add(end, -27)), endDate: d(end), dimensions: ["page"], rowLimit: 1000, dataState: "all" });
      const pr = pages.rows || [];
      out.pagesWithImpr28 = pr.length; out.pagesWithClick28 = pr.filter(r => r.clicks > 0).length;
      out.top3pagesClickShare = pr.length ? +(pr.sort((a, b) => b.clicks - a.clicks).slice(0, 3).reduce((t, r) => t + r.clicks, 0) / Math.max(1, pr.reduce((t, r) => t + r.clicks, 0))).toFixed(2) : 0;
      const q = await googlePost(gs, u + "/searchAnalytics/query", { startDate: d(add(end, -27)), endDate: d(end), dimensions: ["query"], rowLimit: 15, dataState: "all" });
      out.topQueries = (q.rows || []).slice(0, 8).map(r => `${r.keys[0]} [${r.clicks}c/${r.impressions}i/p${r.position.toFixed(0)}]`);
      const sm = await fetch(u + "/sitemaps", { headers: { Authorization: `Bearer ${gs}` } }).then(r => r.json());
      out.sitemaps = (sm.sitemap || []).map(x => `${x.path.replace(/^https?:\/\/[^/]+/, "")} sub:${(x.contents||[]).map(c=>c.submitted).join("/")} err:${x.errors} warn:${x.warnings} last:${(x.lastDownloaded||"").slice(0,10)}`);
    } catch (e) { out.err = String(e.message).slice(0, 200); }
  }
  console.log(JSON.stringify(out));
}
await p.$disconnect();
