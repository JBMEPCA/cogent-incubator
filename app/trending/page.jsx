import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import SiteMark from "@/app/components/SiteMark";
import { prisma, fleetRead } from "@/lib/prisma";
import { WINDOW_HOURS, parseNews } from "@/lib/trending";
import TrendCard from "./TrendCard";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";
// Refresh now runs as a server action on this page and shares its budget.
export const maxDuration = 300;

// A trend still in Google's feed has lastSeenAt bumped on every refresh, which
// runs twice an hour; anything seen inside the last 75 minutes is still live.
const LIVE_MINUTES = 75;

function ago(d) {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

function ukTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL = {
  idea: ["Parked", "chip-monetise"],
  drafting: ["Drafting", "chip-content"],
  review: ["Written", "chip-brand"],
  approved: ["Written", "chip-brand"],
  published: ["Live", "chip-audience"],
};

export default async function TrendingPage({ searchParams }) {
  const params = (await searchParams) || {};
  const showAll = params.all === "1";
  const only = typeof params.site === "string" ? params.site : null;
  const since = new Date(Date.now() - WINDOW_HOURS * 36e5);

  const sites = await prisma.site.findMany({
    where: { status: { in: ["live", "cold_start"] } },
    orderBy: { name: "asc" },
  });

  const [topics, commissioned, latest, hidden] = await Promise.all([
    prisma.trendingTopic.findMany({
      where: { lastSeenAt: { gte: since }, status: { in: showAll ? ["new", "irrelevant"] : ["new"] } },
      include: { site: { select: { slug: true, name: true, status: true, markAccent: true, accentHex: true, markUrl: true } } },
      orderBy: [{ lastSeenAt: "desc" }],
      take: 200,
    }),
    prisma.trendingTopic.findMany({
      where: { status: "commissioned" },
      include: { site: true },
      orderBy: { commissionedAt: "desc" },
      take: 20,
    }),
    prisma.trendingTopic.findFirst({ orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } }),
    prisma.trendingTopic.count({ where: { lastSeenAt: { gte: since }, status: "irrelevant" } }),
  ]);

  // Articles are tenanted; this is the fleet view, so read them across titles.
  const articleIds = commissioned.map((t) => t.articleId).filter(Boolean);
  const articles = articleIds.length
    ? await fleetRead().article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, status: true, scheduledFor: true, publishedAt: true, qaPassed: true, imageUrl: true },
      })
    : [];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const liveCutoff = Date.now() - LIVE_MINUTES * 60000;
  // Matched first, then still live, then biggest. Volume leads within that
  // because it is the reason to act: fit has already been floored at match
  // time, so every matched card is a genuine fit. A trend that has dropped out
  // of Google's feed is still worth seeing for a day, but not first.
  const cards = topics
    .map((t) => ({
      id: t.id,
      source: t.source,
      market: t.market,
      term: t.term,
      traffic: t.traffic,
      trafficNum: t.trafficNum || 0,
      spike: t.spike,
      position: t.position,
      relevance: t.relevance || 0,
      angle: t.angle,
      keywords: t.keywords,
      why: t.why,
      news: parseNews(t),
      siteSlug: t.site?.slug || null,
      site: t.site || null,
      live: new Date(t.lastSeenAt).getTime() >= liveCutoff,
      seen: `first seen ${ago(t.firstSeenAt)}`,
    }))
    .sort(
      (a, b) =>
        Number(Boolean(b.siteSlug)) - Number(Boolean(a.siteSlug)) ||
        Number(b.live) - Number(a.live) ||
        b.trafficNum - a.trafficNum ||
        b.relevance - a.relevance
    );

  const siteOptions = sites.map((s) => ({ slug: s.slug, name: s.name }));
  // One list across every title, filtered by a pill row rather than split into
  // a section per title: per-title sections put one card in each and left most
  // of the page empty.
  const matched = cards.filter((c) => c.siteSlug);
  const counts = new Map();
  for (const c of matched) counts.set(c.siteSlug, (counts.get(c.siteSlug) || 0) + 1);
  const filterSites = sites.filter((s) => counts.has(s.slug));
  const shown = only ? matched.filter((c) => c.siteSlug === only) : matched;
  const unmatched = cards.filter((c) => !c.siteSlug);
  const hrefFor = (slug) => {
    const q = new URLSearchParams();
    if (slug) q.set("site", slug);
    if (showAll) q.set("all", "1");
    const qs = q.toString();
    return qs ? `/trending?${qs}` : "/trending";
  };

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Trending Topics</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>What people are searching for right now</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 720 }}>
                Google&rsquo;s live trending searches, matched to the title whose readers would care, plus
                queries suddenly spiking on our own titles. Commission one and it goes to the front of that
                title&rsquo;s queue: drafted now from the publishers&rsquo; reporting, and published on the next
                tick once it has passed checks and has a picture, without waiting for a slot.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <RefreshButton />
              <span className="micro">
                last checked {latest ? `${ago(latest.lastSeenAt)} (${ukTime(latest.lastSeenAt)})` : "never"} · refreshes every 30 min
              </span>
              <Link href={showAll ? "/trending" : "/trending?all=1"} className="micro">
                {showAll ? "Show only matched topics" : `Show everything trending (${hidden} not matched to a title)`}
              </Link>
            </div>
          </div>
        </section>

        {!matched.length && (
          <section className="panel" style={{ marginBottom: 24 }}>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Nothing in the last {WINDOW_HOURS} hours fits a title yet. Most of what trends is sport and
              celebrity; the matches come in bursts when business news breaks.
            </p>
          </section>
        )}

        {matched.length > 0 && (
          <nav className="trend-filters" aria-label="Filter by title">
            <Link href={hrefFor(null)} className={`fleet-nav-btn${!only ? " is-active" : ""}`}>
              All titles · {matched.length}
            </Link>
            {filterSites.map((s) => (
              <Link key={s.slug} href={hrefFor(s.slug)} className={`fleet-nav-btn${only === s.slug ? " is-active" : ""}`}>
                <SiteMark site={s} size={18} showStatus={false} />
                {s.name} · {counts.get(s.slug)}
              </Link>
            ))}
          </nav>
        )}

        {shown.length > 0 && (
          <div className="trend-list">
            {shown.map((t) => (
              <TrendCard key={t.id} topic={t} sites={siteOptions} />
            ))}
          </div>
        )}

        {showAll && unmatched.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Trending, but no title&rsquo;s readers would care</h2>
            <div className="trend-list">
              {unmatched.map((t) => (
                <TrendCard key={t.id} topic={t} sites={siteOptions} />
              ))}
            </div>
          </section>
        )}

        <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Commissioned from trends</h3>
          <p className="micro" style={{ margin: "0 0 14px" }}>the last twenty, and where each one has got to</p>
          {commissioned.length ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {commissioned.map((t) => {
                const a = articleById.get(t.articleId);
                const [label, chip] = STATUS_LABEL[a?.status] || ["Gone", "chip-general"];
                const waitingOn =
                  a && (a.status === "review" || a.status === "approved")
                    ? !a.qaPassed
                      ? "held by QA"
                      : !a.imageUrl
                        ? "needs a picture"
                        : a.scheduledFor
                          ? `publishing ${ukTime(a.scheduledFor)}`
                          : "next tick"
                    : a?.status === "published"
                      ? `live ${ukTime(a.publishedAt)}`
                      : null;
                return (
                  <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
                    {t.site && <SiteMark site={t.site} size={22} showStatus={false} />}
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{a?.title || t.angle || t.term}</div>
                      <div className="micro">“{t.term}” · commissioned {ukTime(t.commissionedAt)}</div>
                    </div>
                    <span className={`chip ${chip}`}>{label}</span>
                    {waitingOn && <span className="micro">{waitingOn}</span>}
                    {t.site && a && (
                      <Link href={`/s/${t.site.slug}/content/article/${a.id}`} className="micro">open</Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Nothing commissioned from a trend yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
