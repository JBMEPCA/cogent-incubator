import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const gs = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
const tts = await p.trendingTopic.findMany({ where: { status: "commissioned", articleId: { not: null } }, include: { site: true } });
const bySite = new Map(); for (const t of tts) (bySite.get(t.siteId) || bySite.set(t.siteId, []).get(t.siteId)).push(t);
const out = [];
for (const [, list] of bySite) {
  const s = list[0].site;
  const g = decryptJson((await p.siteCredential.findFirst({ where: { siteId: s.id, kind: "google_analytics" } })).payloadEnc);
  const q = await googlePost(gs, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(g.gscSiteUrl)}/searchAnalytics/query`, { startDate: "2026-10-01", endDate: "2026-10-19", dimensions: ["page"], rowLimit: 25000, dataState: "all" });
  const gsc = new Map((q.rows || []).map(r => [r.keys[0].replace(/\/$/, ""), r]));
  for (const t of list) {
    const a = await p.article.findUnique({ where: { id: t.articleId }, select: { wpPostId: true, title: true, publishedAt: true } });
    let link = null;
    if (a?.wpPostId) link = (await fetch(`https://${s.domain}/wp-json/wp/v2/posts/${a.wpPostId}?_fields=link`).then(r => r.ok ? r.json() : null))?.link?.replace(/\/$/, "");
    const r = (link && gsc.get(link)) || { clicks: 0, impressions: 0, position: 0 };
    const lag = a?.publishedAt && t.firstSeenAt ? Math.round((a.publishedAt - t.firstSeenAt) / 36e5) : null;
    out.push({ site: s.slug, term: t.term, traffic: t.trafficNum, mkt: t.market, words: t.term.split(/\s+/).length, lagH: lag, c: r.clicks, i: r.impressions, pos: r.position });
  }
}
for (const r of out.sort((a, b) => b.c - a.c)) console.log(String(r.c).padStart(3), String(r.i).padStart(6), ("p" + (r.pos ? r.pos.toFixed(0) : "-")).padStart(4), ("lag " + r.lagH + "h").padEnd(9), r.mkt, r.site.slice(0, 12).padEnd(13), String(r.traffic).padStart(6), r.term.slice(0, 55));
const grp = (f) => { const rr = out.filter(f); return `${rr.length} pieces, ${(rr.reduce((t, r) => t + r.c, 0) / Math.max(1, rr.length)).toFixed(1)} clicks each, ${Math.round(100 * rr.filter(r => r.c > 0).length / Math.max(1, rr.length))}% got any`; };
console.log("\nterm 1-2 words:", grp(r => r.words <= 2)); console.log("term 3+ words:", grp(r => r.words >= 3));
console.log("published <=12h after trend:", grp(r => r.lagH != null && r.lagH <= 12)); console.log("published >12h after:", grp(r => r.lagH != null && r.lagH > 12));
console.log("GB trend:", grp(r => r.mkt === "GB")); console.log("non-GB trend:", grp(r => r.mkt !== "GB"));
await p.$disconnect();
