import { prisma } from "@/lib/prisma";
import { listSites } from "@/lib/site";
import { LIVE_LABEL, liveState, runDays } from "@/lib/ads";
import { POSITIONS, checkCreative, positionInfo } from "@/lib/ad-positions";

// Everything the placement panel on the Campaigns list shows for one
// campaign: each placement's artwork, link, state and numbers. Behind the
// sign-in like every page (the proxy guards /api/campaigns), and read-only:
// the panel changes things through the same server actions as the campaign
// page, so the two can never disagree about what a button does.

export const dynamic = "force-dynamic";

const DAYS = 30;

export async function GET(_req, { params }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      advertiser: { select: { company: true } },
      deliverables: {
        where: { position: { not: null } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: {
          assets: {
            where: { url: null, width: { not: null } },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, width: true, height: true, mimeType: true, webMime: true, webSize: true, active: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!c) return Response.json({ error: "not found" }, { status: 404 });

  const sites = new Map((await listSites()).map((s) => [s.id, s]));
  const ids = c.deliverables.map((d) => d.id);
  const since = new Date(Date.now() - (DAYS - 1) * 864e5);
  since.setUTCHours(0, 0, 0, 0);
  const [totals, daily, last] = await Promise.all([
    prisma.adStat.groupBy({ by: ["deliverableId"], where: { deliverableId: { in: ids } }, _sum: { served: true, views: true, clicks: true } }),
    prisma.adStat.groupBy({
      by: ["deliverableId", "day"],
      where: { deliverableId: { in: ids }, day: { gte: since } },
      _sum: { views: true, clicks: true },
    }),
    prisma.adStat.aggregate({ where: { deliverableId: { in: ids } }, _max: { updatedAt: true } }),
  ]);
  const sum = new Map(totals.map((t) => [t.deliverableId, t._sum]));

  const now = new Date();
  const placements = c.deliverables.map((d) => {
    const info = positionInfo(d.position);
    const site = d.siteId ? sites.get(d.siteId) : null;
    const state = liveState(d, now);
    const s = sum.get(d.id) || {};
    // One entry per day for the last 30, zeros included, so the bars line up.
    const byDay = new Map(daily.filter((r) => r.deliverableId === d.id).map((r) => [r.day.toISOString().slice(0, 10), r._sum]));
    const days = Array.from({ length: DAYS }, (_, i) => {
      const k = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
      const r = byDay.get(k) || {};
      return { day: k, views: r.views || 0, clicks: r.clicks || 0 };
    });
    return {
      id: d.id,
      title: d.title,
      position: d.position,
      label: info.label,
      size: info.size,
      served: Boolean(info.served),
      email: Boolean(info.email),
      site: site ? { name: site.name, domain: site.domain } : null,
      run: runDays(d),
      state,
      stateLabel: LIVE_LABEL[state].label,
      stateChip: LIVE_LABEL[state].chip,
      targetUrl: d.targetUrl || "",
      stats: { served: s.served || 0, views: s.views || 0, clicks: s.clicks || 0 },
      days,
      creatives: d.assets.map((a) => {
        const check = checkCreative(d.position, { width: a.width, height: a.height, mimeType: a.webMime || a.mimeType, webBytes: a.webSize });
        return { id: a.id, name: a.name, width: a.width, height: a.height, webSize: a.webSize, active: a.active, ok: check.ok, problems: check.problems };
      }),
    };
  });

  // One entry per position on a title, as on the campaign page: twelve
  // newsletter banners are one thing with one link and one artwork. The
  // months stay separate rows (each send has its own Mailchimp campaign), so
  // the entry carries every id, and each creative the ids of its copies.
  const groups = new Map();
  for (const p of placements) {
    const k = `${p.site?.domain || ""}|${p.position}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const grouped = [...groups.values()].map((members) => {
    const lead = members.find((m) => m.state !== "ended") || members.at(-1);
    const state = members.some((m) => m.state === "live") ? "live" : members.some((m) => m.state === "paused") ? "paused" : lead.state;
    const runs = members.map((m) => m.run).filter(Boolean);
    return {
      ...lead,
      ids: members.map((m) => m.id),
      months: members.map((m) => ({ id: m.id, run: m.run, state: m.state })),
      run: runs.length ? { start: runs[0].start, end: runs.at(-1).end } : null,
      state,
      stateLabel: LIVE_LABEL[state].label,
      stateChip: LIVE_LABEL[state].chip,
      stats: members.reduce(
        (a, m) => ({ served: a.served + m.stats.served, views: a.views + m.stats.views, clicks: a.clicks + m.stats.clicks }),
        { served: 0, views: 0, clicks: 0 }
      ),
      days: lead.days.map((d, i) => ({
        day: d.day,
        views: members.reduce((n, m) => n + m.days[i].views, 0),
        clicks: members.reduce((n, m) => n + m.days[i].clicks, 0),
      })),
      creatives: lead.creatives.map((cr) => ({
        ...cr,
        copies: members.flatMap((m) => m.creatives.filter((o) => o.name === cr.name && o.width === cr.width && o.height === cr.height).map((o) => o.id)),
      })),
    };
  });

  const order = new Map(POSITIONS.map((p, i) => [p.key, i]));
  grouped.sort((a, b) => (a.site?.name || "~").localeCompare(b.site?.name || "~") || order.get(a.position) - order.get(b.position));

  return Response.json(
    {
      id: c.id,
      name: c.name,
      advertiser: c.advertiser.company,
      lastCounted: last._max.updatedAt,
      placements: grouped,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
