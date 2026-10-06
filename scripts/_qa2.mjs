import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 7 * 864e5);
const sites = await p.site.findMany({ select: { id: true, slug: true } });
const msgs = await p.agentMessage.findMany({
  where: { createdAt: { gte: A }, subject: { startsWith: "QA held" } },
  select: { siteId: true, subject: true, body: true, createdAt: true },
});
console.log("QA holds in 7 days:", msgs.length);
const tally = {}, byTitle = {};
for (const m of msgs) {
  const slug = sites.find((s) => s.id === m.siteId)?.slug;
  byTitle[slug] = (byTitle[slug] || 0) + 1;
  for (const raw of String(m.body || "").split(";")) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.replace(/\d+/g, "N").replace(/"[^"]*"/g, "X").slice(0, 64);
    tally[key] = (tally[key] || 0) + 1;
  }
}
console.log("by title:", Object.entries(byTitle).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("\nreasons:");
Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => console.log(`${String(n).padStart(3)}x ${k}`));
await p.$disconnect();
