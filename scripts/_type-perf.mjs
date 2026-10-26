import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken, googlePost } from "../lib/google.js";
const p = new PrismaClient();
const gs = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
const trendIds = new Set((await p.trendingTopic.findMany({ where: { articleId: { not: null } }, select: { articleId: true } })).map(t => t.articleId));
const rtSrc = new Map((await p.researchTopic.findMany({ where: { articleId: { not: null } }, select: { articleId: true, source: true } })).map(r => [r.articleId, r.source]));
const all = [];
for (const s of await p.site.findMany({ orderBy: { createdAt: "asc" } })) {
  const cred = await p.siteCredential.findFirst({ where: { siteId: s.id, kind: "google_analytics" } });
  const g = cred && decryptJson(cred.payloadEnc); if (!g?.gscSiteUrl) continue;
  const links = new Map();
  for (let pg = 1; pg < 20; pg++) {
    const r = await fetch(`https://${s.domain}/wp-json/wp/v2/posts?per_page=100&page=${pg}&_fields=id,link`);
    if (!r.ok) break; const j = await r.json(); if (!j.length) break;
    for (const x of j) links.set(x.id, x.link.replace(/\/$/, ""));
  }
  const q = await googlePost(gs, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(g.gscSiteUrl)}/searchAnalytics/query`,
    { startDate: "2026-07-25", endDate: "2026-10-18", dimensions: ["page"], rowLimit: 25000, dataState: "all" });
  const gsc = new Map((q.rows || []).map(r => [r.keys[0].replace(/\/$/, ""), r]));
  const arts = await p.article.findMany({ where: { siteId: s.id, status: "published", wpPostId: { not: null } }, select: { id: true, title: true, type: true, wpPostId: true, publishedAt: true } });
  for (const a of arts) {
    const url = links.get(a.wpPostId); if (!url) continue;
    const r = gsc.get(url) || { clicks: 0, impressions: 0, position: 0 };
    const group = trendIds.has(a.id) ? "trending" : a.type === "seo_original" ? "original" : a.type === "pr_rewrite" ? "wire rewrite" : "case study";
    all.push({ site: s.slug, group, src: rtSrc.get(a.id) || "-", title: a.title, pub: a.publishedAt, c: r.clicks, i: r.impressions, pos: r.position });
  }
}
const summ = (rows) => {
  const n = rows.length, c = rows.reduce((t, r) => t + r.c, 0), i = rows.reduce((t, r) => t + r.i, 0);
  const pw = rows.reduce((t, r) => t + r.pos * r.i, 0) / Math.max(1, i);
  const sorted = rows.map(r => r.c).sort((a, b) => a - b);
  return { n, clicks: c, "clicks/art": +(c / Math.max(1, n)).toFixed(2), "impr/art": Math.round(i / Math.max(1, n)), "%anyImpr": Math.round(100 * rows.filter(r => r.i > 0).length / Math.max(1, n)), "%anyClick": Math.round(100 * rows.filter(r => r.c > 0).length / Math.max(1, n)), "%10+clicks": Math.round(100 * rows.filter(r => r.c >= 10).length / Math.max(1, n)), medClicks: sorted[Math.floor(n / 2)] ?? 0, avgPos: +pw.toFixed(1), "%pos<=10": Math.round(100 * rows.filter(r => r.i > 0 && r.pos <= 10).length / Math.max(1, n)) };
};
const groups = ["original", "wire rewrite", "trending", "case study"];
const show = (label, rows) => { console.log(`\n## ${label}`); for (const gname of groups) { const rr = rows.filter(r => r.group === gname); if (rr.length) console.log(gname.padEnd(13), JSON.stringify(summ(rr))); } };
show("ALL TIME (to 18 Oct)", all);
show("Published 1 Sep - 4 Oct only (2-7 weeks old, like for like)", all.filter(r => r.pub >= new Date("2026-09-01") && r.pub < new Date("2026-10-05")));
show("Published 5-18 Oct (newest)", all.filter(r => r.pub >= new Date("2026-10-05")));
console.log("\n## Originals by research source (all time)");
for (const src of [...new Set(all.filter(r => r.group === "original").map(r => r.src))]) console.log(src.padEnd(13), JSON.stringify(summ(all.filter(r => r.group === "original" && r.src === src))));
console.log("\n## Clicks/article by title (orig | wire | trending) [n]");
for (const s of [...new Set(all.map(r => r.site))]) {
  const f = (gname) => { const rr = all.filter(r => r.site === s && r.group === gname); return rr.length ? `${(rr.reduce((t, r) => t + r.c, 0) / rr.length).toFixed(2)} [${rr.length}]` : "-"; };
  console.log(s.padEnd(26), f("original").padEnd(14), f("wire rewrite").padEnd(14), f("trending"));
}
console.log("\n## Top 15 articles by clicks");
for (const r of all.sort((a, b) => b.c - a.c).slice(0, 15)) console.log(String(r.c).padStart(4), r.group.padEnd(13), r.site.slice(0, 12).padEnd(13), r.title.slice(0, 70));
console.log("\n## Share of all clicks by group");
const tot = all.reduce((t, r) => t + r.c, 0); for (const gname of groups) console.log(gname.padEnd(13), Math.round(100 * all.filter(r => r.group === gname).reduce((t, r) => t + r.c, 0) / tot) + "%");
await p.$disconnect();
