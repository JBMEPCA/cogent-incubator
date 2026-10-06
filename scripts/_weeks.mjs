import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const sites = await p.site.findMany({ select: { id: true, slug: true, articlesPerDayTarget: true }, orderBy: { createdAt: "asc" } });
// Weeks run Monday to Sunday, UK. Week 0 is the current part-week.
const now = new Date();
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const starts = [];
for (let i = 7; i >= 0; i--) {
  const s = new Date(monday); s.setUTCDate(s.getUTCDate() - 7 * i);
  starts.push(s);
}
const label = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
console.log("week beginning".padEnd(28) + starts.map(label).map((x) => x.padStart(6)).join(""));
const totals = starts.map(() => 0);
for (const s of sites) {
  const counts = [];
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i];
    const b = i + 1 < starts.length ? starts[i + 1] : new Date(Date.now() + 864e5);
    const n = await p.article.count({ where: { siteId: s.id, status: "published", publishedAt: { gte: a, lt: b } } });
    counts.push(n); totals[i] += n;
  }
  console.log(s.slug.padEnd(28) + counts.map((n) => String(n).padStart(6)).join("") + `   target ${s.articlesPerDayTarget || 3}/day`);
}
console.log("FLEET".padEnd(28) + totals.map((n) => String(n).padStart(6)).join(""));
await p.$disconnect();
