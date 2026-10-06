// What has the live press desk done? Runs by outcome, per title, since go-live.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const since = new Date("2026-09-21T12:55:00Z");
const runs = await p.$queryRawUnsafe(`
  select s.slug, r.summary, r."costUsd", r."startedAt", r.ok, r.error, a."wpPostId", a.status
  from "AgentRun" r join "Site" s on s.id = r."siteId" left join "Article" a on a.id = r."articleId"
  where r.trigger = 'press' and r."startedAt" > $1 order by r."startedAt"`, since);
const uk = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London" });
for (const r of runs) console.log(`${uk(r.startedAt)} ${r.slug} $${r.costUsd.toFixed(3)} ${r.ok ? "" : "ERR " + r.error?.slice(0, 120)} | ${r.summary}`);
const byOutcome = {};
for (const r of runs) { const k = (r.summary.match(/^Press desk: (\w+)/) || [])[1] || "?"; byOutcome[k] = (byOutcome[k] || 0) + 1; }
console.log(`\n${runs.length} releases handled since go-live:`, JSON.stringify(byOutcome), `total $${runs.reduce((a, r) => a + r.costUsd, 0).toFixed(3)}`);
await p.$disconnect();
