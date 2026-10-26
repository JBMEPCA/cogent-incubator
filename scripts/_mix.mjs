import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date("2026-09-30T23:00:00Z"), B = new Date();
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
const arts = await p.article.findMany({
  where: { status: "published", publishedAt: { gte: A, lt: B } },
  select: { id: true, siteId: true, title: true, type: true, sourceItemId: true, publishedAt: true, costUsd: true },
});
const feedIds = arts.map((a) => a.sourceItemId).filter(Boolean);
const feeds = feedIds.length ? await p.feedItem.findMany({ where: { id: { in: feedIds } }, select: { id: true, link: true } }) : [];
const feedById = new Map(feeds.map((f) => [f.id, f]));
const trending = await p.trendingTopic.findMany({ where: { articleId: { in: arts.map((a) => a.id) } }, select: { articleId: true } }).catch(() => []);
const trendingIds = new Set(trending.map((t) => t.articleId));
const INTERVIEW = /franchise-eyebrow|In the Chair|SME Leaders|Behind the Mask|Meet the (Manager|Operator|Farmer)|Gym Champions|Fleet Professional|Leaders:|Seven questions/i;

const kind = (a) => {
  const link = a.sourceItemId ? feedById.get(a.sourceItemId)?.link || "" : "";
  if (link.startsWith("gmail:")) return "press release (email)";
  if (INTERVIEW.test(a.title)) return "interview";
  if (trendingIds.has(a.id)) return "trending news";
  if (a.sourceItemId) return "wire news";
  if (a.type === "seo_original") return "evergreen SEO";
  if (a.type === "case_study") return "case study";
  return `other (${a.type})`;
};

const byKind = {}, bySiteKind = {};
for (const a of arts) {
  const k = kind(a);
  byKind[k] = (byKind[k] || 0) + 1;
  const slug = sites.find((s) => s.id === a.siteId)?.slug;
  bySiteKind[slug] = bySiteKind[slug] || {};
  bySiteKind[slug][k] = (bySiteKind[slug][k] || 0) + 1;
}
const kinds = Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]);
console.log("published this week:", arts.length);
console.log(kinds.map((k) => `${k}: ${byKind[k]}`).join("\n"));
console.log("\nper title:");
console.log("title".padEnd(28) + kinds.map((k) => k.slice(0, 12).padStart(14)).join(""));
for (const s of sites) {
  const row = bySiteKind[s.slug] || {};
  const total = Object.values(row).reduce((n, x) => n + x, 0);
  console.log(s.slug.padEnd(28) + kinds.map((k) => String(row[k] || 0).padStart(14)).join("") + `   = ${total}`);
}
console.log("\ninterviews published:");
for (const a of arts.filter((x) => kind(x) === "interview")) console.log(`  ${sites.find((s) => s.id === a.siteId)?.slug.padEnd(26)} ${a.title.replace(/<[^>]+>/g, "").slice(0, 70)}`);
console.log("\npress releases published:");
for (const a of arts.filter((x) => kind(x) === "press release (email)")) console.log(`  ${sites.find((s) => s.id === a.siteId)?.slug.padEnd(26)} ${a.title.slice(0, 70)}`);
await p.$disconnect();
