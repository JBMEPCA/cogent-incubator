import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const uk = (d) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const sites = await p.site.findMany({ select: { id: true, slug: true }, orderBy: { createdAt: "asc" } });
const name = (id) => sites.find((s) => s.id === id)?.slug || "?";
const recent = await p.linkedInPost.findMany({
  where: { OR: [{ postedAt: { gte: new Date(Date.now() - 4 * 864e5) } }, { status: { in: ["draft", "approved"] }, postedAt: null }] },
  select: { siteId: true, status: true, postedAt: true, scheduledFor: true, attempts: true, publishError: true, text: true },
  orderBy: [{ postedAt: "desc" }, { scheduledFor: "asc" }],
});
const posted = recent.filter((r) => r.postedAt);
console.log("POSTED in last 4 days:", posted.length);
const byDay = {};
for (const r of posted) { const k = uk(r.postedAt).slice(0, 6); byDay[k] = (byDay[k] || 0) + 1; }
console.log(" ", JSON.stringify(byDay));
console.log("  latest:", posted.slice(0, 5).map((r) => `${name(r.siteId)} ${uk(r.postedAt)}`).join(" | "));
const waiting = recent.filter((r) => !r.postedAt);
console.log("\nWAITING:", waiting.length);
for (const r of waiting.slice(0, 14)) console.log(`  ${name(r.siteId).padEnd(26)} slot ${uk(r.scheduledFor)} attempts ${r.attempts} ${r.publishError ? "ERR " + r.publishError.slice(0, 80) : ""}`);
await p.$disconnect();
