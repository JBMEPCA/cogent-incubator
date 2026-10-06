// Read-only: press@ releases handled per title since go-live, by outcome, plus a sample of senders.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const since = new Date("2026-09-21T12:55:00Z");
const runs = await p.$queryRawUnsafe(`
  select s.slug, r.summary, r."startedAt"
  from "AgentRun" r join "Site" s on s.id = r."siteId"
  where r.trigger = 'press' and r."startedAt" > $1 order by r."startedAt"`, since);
const sites = await p.site.findMany({ select: { slug: true } });
const t = {};
for (const s of sites) t[s.slug] = { total: 0, out: {}, last7: 0, pub: [] };
const wk = Date.now() - 7 * 864e5;
for (const r of runs) {
  const x = (t[r.slug] ||= { total: 0, out: {}, last7: 0, pub: [] });
  const k = (r.summary.match(/^Press desk: (\w+)/) || [])[1] || "?";
  x.total++; x.out[k] = (x.out[k] || 0) + 1;
  if (new Date(r.startedAt).getTime() > wk) x.last7++;
  if (k === "published") x.pub.push(r.summary.slice(19, 90));
}
for (const [slug, x] of Object.entries(t).sort((a, b) => b[1].total - a[1].total))
  console.log(`${slug.padEnd(28)} total ${String(x.total).padStart(3)}  last7d ${String(x.last7).padStart(3)}  ${JSON.stringify(x.out)}\n   ${x.pub.slice(0, 4).join("\n   ")}`);
console.log(`\n${runs.length} runs since go-live`);
await p.$disconnect();
