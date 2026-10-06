import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 7 * 864e5);
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const held = await p.article.findMany({
  where: { createdAt: { gte: A }, qaPassed: false, status: { in: ["drafting", "review"] } },
  select: { siteId: true, title: true, qaReport: true, status: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
console.log("held articles fleet-wide (7 days):", held.length);
const reasons = {};
for (const a of held) {
  let issues = [];
  try { const r = JSON.parse(a.qaReport || "{}"); issues = r.issues || r.problems || (Array.isArray(r) ? r : []); } catch { issues = [String(a.qaReport || "").slice(0, 80)]; }
  for (const i of issues) {
    const text = typeof i === "string" ? i : i.issue || i.message || JSON.stringify(i);
    const key = text.replace(/"[^"]*"/g, "X").replace(/\d+/g, "N").slice(0, 70);
    reasons[key] = (reasons[key] || 0) + 1;
  }
}
Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, n]) => console.log(`${String(n).padStart(3)}x ${k}`));
console.log("\nby title:", Object.entries(held.reduce((m, a) => { const s = sites.find((x) => x.id === a.siteId)?.slug; m[s] = (m[s] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(", "));
const one = held.find((a) => sites.find((x) => x.id === a.siteId)?.slug === "dental-business-news");
if (one) console.log("\nexample (dental):", one.title, "\n", String(one.qaReport || "").slice(0, 700));
await p.$disconnect();
