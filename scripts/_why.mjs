import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 7 * 864e5);
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
for (const slug of process.argv.slice(2)) {
  const s = await p.site.findUnique({ where: { slug } });
  console.log(`\n### ${slug}  (office ${s.officeHoursStart}-${s.officeHoursEnd}, target ${s.articlesPerDayTarget}/day, engine ${s.engineEnabled})`);
  const made = await p.article.groupBy({ by: ["status"], where: { siteId: s.id, createdAt: { gte: A } }, _count: true });
  console.log("  articles created in 7 days:", made.map((x) => `${x.status} ${x._count}`).join(", ") || "none");
  const topics = await p.researchTopic.groupBy({ by: ["status"], where: { siteId: s.id, createdAt: { gte: A } }, _count: true });
  console.log("  topics proposed in 7 days:", topics.map((x) => `${x.status} ${x._count}`).join(", ") || "none");
  const runs = await p.agentRun.groupBy({ by: ["agentKey"], where: { siteId: s.id, startedAt: { gte: A } }, _count: true });
  console.log("  agent runs:", runs.map((x) => `${x.agentKey} ${x._count}`).join(", "));
  const sum = await p.agentRun.findMany({ where: { siteId: s.id, startedAt: { gte: A } }, select: { agentKey: true, summary: true, ok: true } });
  const tally = {};
  for (const r of sum) {
    const k = (r.summary || "").replace(/"[^"]*"/g, "X").replace(/\d+/g, "N").slice(0, 58);
    tally[`${r.agentKey}: ${k}`] = (tally[`${r.agentKey}: ${k}`] || 0) + 1;
  }
  Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, n]) => console.log(`    ${String(n).padStart(3)}x ${k}`));
  const log = await p.engineSetting.findUnique({ where: { siteId_key: { siteId: s.id, key: "publish-due:log" } } });
  if (log) {
    const rounds = JSON.parse(log.value).filter((e) => new Date(e.at) >= A);
    const misses = rounds.flatMap((e) => (e.results || []).filter((r) => !r.url).map((r) => `${uk(e.at)} ${(r.deferred || r.skipped || r.error || "").slice(0, 90)}`));
    console.log(`  publish rounds ${rounds.length}, non-publishes ${misses.length}`);
    for (const m of misses.slice(0, 8)) console.log("    " + m);
  }
}
await p.$disconnect();
