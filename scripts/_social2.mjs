import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
for (const s of sites) {
  const last = await p.linkedInPost.findFirst({ where: { siteId: s.id, postedAt: { not: null } }, orderBy: { postedAt: "desc" }, select: { postedAt: true } });
  const queued = await p.linkedInPost.count({ where: { siteId: s.id, status: { in: ["draft", "approved"] }, postedAt: null } });
  const due = await p.linkedInPost.findFirst({ where: { siteId: s.id, status: { in: ["draft", "approved"] }, postedAt: null }, orderBy: { scheduledFor: "asc" }, select: { scheduledFor: true, publishError: true } });
  const lastRun = await p.agentRun.findFirst({ where: { siteId: s.id, agentKey: "linkedin" }, orderBy: { startedAt: "desc" }, select: { startedAt: true, ok: true, summary: true, error: true } });
  console.log(`${s.slug.padEnd(28)} lastPosted ${uk(last?.postedAt)} queued ${queued} nextSlot ${uk(due?.scheduledFor)} | lastRun ${uk(lastRun?.startedAt)} ok=${lastRun?.ok} ${(lastRun?.error || lastRun?.summary || "").slice(0, 70).replace(/\s+/g, " ")}`);
}
await p.$disconnect();
