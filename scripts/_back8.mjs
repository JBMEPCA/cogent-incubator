import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const A = new Date(Date.now() - 8 * 864e5);
const runs = await p.agentRun.findMany({ where: { agentKey: "backlink", startedAt: { gte: A } }, select: { summary: true, ok: true } });
console.log("backlink runs 8d:", runs.length);
const tally = {};
for (const r of runs) { const k = (r.summary || "").replace(/\d+/g, "N").slice(0, 60); tally[k] = (tally[k] || 0) + 1; }
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v}x ${k}`).join("\n"));
try {
  const replies = await p.outreachEmail.count({ where: { repliedAt: { gte: A } } });
  const sent = await p.outreachEmail.count({ where: { sentAt: { gte: A } } });
  console.log(`outreach sent 8d ${sent}, replies detected ${replies}`);
} catch (e) { console.log("outreach model:", e.message.slice(0, 80)); }
await p.$disconnect();
