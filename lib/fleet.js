import { fleetRead } from "./prisma";
import { listSites } from "./site";

// Cross-title figures for the overview.
//
// Each of these is one grouped query for the whole fleet rather than one query
// per title. At thirty titles the difference between six queries and a hundred
// and eighty is the difference between a page that loads and one that doesn't.

const PIPELINE_STATES = ["idea", "drafting", "review", "approved"];

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function toMap(rows, key, pick) {
  const out = {};
  for (const row of rows) out[row[key]] = pick(row);
  return out;
}

/**
 * Every title with the four numbers the overview card shows, plus what needs
 * attention. Sorted so the titles that need you come first — the grid's job is
 * to tell you where to look, and alphabetical order tells you nothing.
 */
export async function fleetSnapshot() {
  const sites = await listSites();
  if (!sites.length) {
    return { sites: [], totals: { publishedWeek: 0, spendMonth: 0, blocked: 0, awaiting: 0 } };
  }

  const db = fleetRead();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const monthStart = startOfMonth();

  const [published, pipeline, spend, blocked, outreach, linkedIn, seo, lastPublished] =
    await Promise.all([
      db.article.groupBy({
        by: ["siteId"],
        where: { publishedAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      db.article.groupBy({
        by: ["siteId"],
        where: { status: { in: PIPELINE_STATES } },
        _count: { _all: true },
      }),
      db.agentRun.groupBy({
        by: ["siteId"],
        where: { startedAt: { gte: monthStart } },
        _sum: { costUsd: true },
      }),
      db.agent.groupBy({
        by: ["siteId"],
        where: { state: "blocked" },
        _count: { _all: true },
      }),
      db.outreachEmail.groupBy({
        by: ["siteId"],
        where: { status: "pending" },
        _count: { _all: true },
      }),
      db.linkedInPost.groupBy({
        by: ["siteId"],
        where: { status: "draft" },
        _count: { _all: true },
      }),
      db.seoSuggestion.groupBy({
        by: ["siteId"],
        where: { status: "pending" },
        _count: { _all: true },
      }),
      db.article.groupBy({
        by: ["siteId"],
        where: { status: "published" },
        _max: { publishedAt: true },
      }),
    ]);

  const pub = toMap(published, "siteId", (r) => r._count._all);
  const pipe = toMap(pipeline, "siteId", (r) => r._count._all);
  const cost = toMap(spend, "siteId", (r) => r._sum.costUsd || 0);
  const blk = toMap(blocked, "siteId", (r) => r._count._all);
  const out = toMap(outreach, "siteId", (r) => r._count._all);
  const li = toMap(linkedIn, "siteId", (r) => r._count._all);
  const sg = toMap(seo, "siteId", (r) => r._count._all);
  const last = toMap(lastPublished, "siteId", (r) => r._max.publishedAt);

  const rows = sites.map((site) => {
    const awaiting = (out[site.id] || 0) + (li[site.id] || 0) + (sg[site.id] || 0);
    const blockedCount = blk[site.id] || 0;
    const pipelineCount = pipe[site.id] || 0;
    const publishedWeek = pub[site.id] || 0;

    // What the card leads with. A blocked agent outranks an empty pipeline
    // because it is stuck rather than merely quiet, and both outrank a queue
    // of approvals, which is normal working state rather than a fault.
    let attention = null;
    if (site.status === "setup") attention = { level: 2, text: "Finish setup" };
    else if (blockedCount) attention = { level: 3, text: `${blockedCount} agent${blockedCount > 1 ? "s" : ""} blocked` };
    else if (site.engineEnabled && pipelineCount === 0) attention = { level: 2, text: "Pipeline empty" };
    else if (awaiting) attention = { level: 1, text: `${awaiting} awaiting you` };

    return {
      ...site,
      stats: {
        publishedWeek,
        pipeline: pipelineCount,
        spendMonth: cost[site.id] || 0,
        awaiting,
        blocked: blockedCount,
        lastPublishedAt: last[site.id] || null,
      },
      attention,
    };
  });

  rows.sort((a, b) => {
    const al = a.attention?.level || 0;
    const bl = b.attention?.level || 0;
    if (al !== bl) return bl - al;
    return a.name.localeCompare(b.name);
  });

  return {
    sites: rows,
    totals: {
      publishedWeek: rows.reduce((n, r) => n + r.stats.publishedWeek, 0),
      spendMonth: rows.reduce((n, r) => n + r.stats.spendMonth, 0),
      blocked: rows.reduce((n, r) => n + r.stats.blocked, 0),
      awaiting: rows.reduce((n, r) => n + r.stats.awaiting, 0),
    },
  };
}
