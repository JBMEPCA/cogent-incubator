import Link from "next/link";
import FleetNav from "../components/FleetNav";
import TrendChart from "../components/TrendChart";
import { SharePie, Sparkline, RankedList, PositionPill, colourMap } from "../components/FleetCharts";
import SiteMark from "../components/SiteMark";
import { fleetAnalytics, summarise } from "@/lib/fleet-analytics";
import PeriodFilter from "@/app/components/PeriodFilter";
import { after } from "next/server";
import { periodFrom, DEFAULT_PERIOD, PERIODS } from "@/lib/periods";
import { fleetPulse } from "@/lib/pulse";
import PulsePanel from "./PulsePanel";
import Scroller from "@/app/components/Scroller";
import {
  cachedLinkedInStats, engagementRate, freshness, linkedInPeriod, refreshLinkedInStats, statsHook,
} from "@/lib/linkedin-stats";
import { refreshLinkedInStatsNow } from "@/lib/linkedin-stats-actions";

export const dynamic = "force-dynamic";
// The LinkedIn Refresh button waits on Make for five calls a title.
export const maxDuration = 60;

// Every title's numbers on one screen.
//
// The per-title Analytics tab is the place to work out why one magazine is
// doing what it is doing. This is the place to work out which magazine to open.
//
// Split into views rather than one long scroll: the overview carries the key
// numbers and the comparison table, and the detail for audience, search and
// content sits one click away. The title filter narrows every figure on the
// page to one magazine — it is arithmetic over rows already fetched, so it
// costs no extra Google calls.

const int = (n) => Math.round(n || 0).toLocaleString();
const pct = (n) => `${(n || 0).toFixed(1)}%`;
const pos = (n) => (n ? n.toFixed(1) : "—");
const money = (usd) => (usd >= 100 ? `$${Math.round(usd)}` : `$${(usd || 0).toFixed(2)}`);
const mmss = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const shortPath = (p) => (p === "/" ? "/ (home)" : String(p).replace(/\/$/, ""));

// GA4 page titles carry the magazine's name as a suffix ("… | Smart SME"),
// which is noise in a list that already shows the magazine beside every row.
// Only stripped when the suffix actually names the magazine, so a headline
// with a dash in it keeps its second half.
function cleanTitle(title, siteName) {
  if (!title) return title;
  const m = title.match(/^(.*\S)\s+[|–—-]\s+([^|–—-]+)$/);
  if (!m) return title;
  const word = String(siteName || "").toLowerCase().split(/\s+/).find((w) => w.length > 2 && w !== "the");
  return word && m[2].toLowerCase().includes(word) ? m[1] : title;
}

const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "audience", label: "Audience" },
  { key: "search", label: "Search" },
  { key: "content", label: "Content" },
  { key: "linkedin", label: "LinkedIn" },
];

// Change against the previous window of the same length, as a compact chip.
// Position is the one metric where down is good.
function Delta({ now, before, lowerIsBetter = false }) {
  if (!before) return <span className="an-chip">no prior data</span>;
  const change = ((now - before) / before) * 100;
  if (!isFinite(change) || Math.abs(change) < 0.5) return <span className="an-chip">flat</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={`an-chip num ${good ? "is-good" : "is-bad"}`} title="vs the same length of time before">
      {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
    </span>
  );
}

function Kpi({ label, value, colour, delta, foot, spark }) {
  return (
    <div className="panel an-kpi">
      <div className="an-kpi-label">
        <span className="an-dot" style={{ background: colour }} />
        {label}
      </div>
      <div className="an-kpi-value num">{value}</div>
      <div className="an-kpi-meta">
        {delta}
        {foot && <span className="an-kpi-foot">{foot}</span>}
      </div>
      <div className="an-kpi-spark">
        {spark && spark.length > 1 ? (
          <Sparkline points={spark} colour={colour} label={`${label} per day`} />
        ) : null}
      </div>
    </div>
  );
}

function SectionHead({ title, note, action }) {
  return (
    <div className="an-section-head">
      <h2>{title}</h2>
      {note && <span className="micro">{note}</span>}
      {action && <span className="an-section-action">{action}</span>}
    </div>
  );
}

function Card({ title, note, children, action }) {
  return (
    <div className="panel an-card">
      <div className="an-card-head">
        <div>
          <h3>{title}</h3>
          {note && <p className="micro">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Plain table cells for the LinkedIn page table.
const cell = {
  padding: "10px 0 10px 14px",
  borderBottom: "1px solid var(--line)",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const headCell = { ...cell, padding: "0 0 9px 14px", fontWeight: 400, color: "var(--muted)" };

function Empty({ children }) {
  return <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{children}</p>;
}

// A figure with a bar behind it, scaled to the biggest title in the column, so
// the table reads as a chart at a glance and as exact numbers up close.
function BarFigure({ value, max, colour, children }) {
  return (
    <div className="tt-barfig">
      <span className="num">{children}</span>
      <span className="tt-bar">
        <span style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: colour }} />
      </span>
    </div>
  );
}

function TitleTable({ rows, totals, colours, href, windowLabel }) {
  const maxUsers = Math.max(0, ...rows.map((r) => r.ga4?.users || 0));
  const maxClicks = Math.max(0, ...rows.map((r) => r.gsc?.clicks || 0));
  return (
    <div className="panel tt-panel">
      <Scroller>
        <table className="tt">
          <thead>
            <tr>
              <th className="tt-rank">#</th>
              <th className="tt-left">Title</th>
              <th>Users</th>
              <th className="tt-spark-col">Users, {windowLabel}</th>
              <th>Sessions</th>
              <th>Search clicks</th>
              <th>Impr.</th>
              <th>Position</th>
              <th>Published</th>
              <th>Spend, mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dark = !r.ga4 && !r.gsc;
              return (
                <tr key={r.id} className={dark ? "is-dark" : undefined}>
                  <td className="tt-rank num">{String(i + 1).padStart(2, "0")}</td>
                  <td className="tt-left">
                    <Link href={href({ title: r.slug })} className="tt-title">
                      <SiteMark site={r} size={30} showStatus={false} />
                      <span className="tt-name">
                        <span>{r.name}</span>
                        {dark && <span className="tt-note">google not connected</span>}
                      </span>
                    </Link>
                  </td>
                  <td>
                    {r.ga4 ? (
                      <BarFigure value={r.ga4.users} max={maxUsers} colour={colours[r.slug]}>
                        <strong>{int(r.ga4.users)}</strong>
                      </BarFigure>
                    ) : "—"}
                  </td>
                  <td className="tt-spark-col">
                    {r.ga4 ? (
                      <Sparkline points={r.ga4.trend.map((d) => ({ date: d.date, value: d.users }))}
                        colour={colours[r.slug]} label={`${r.name} users per day`} />
                    ) : null}
                  </td>
                  <td className="num tt-muted">{r.ga4 ? int(r.ga4.sessions) : "—"}</td>
                  <td>
                    {r.gsc ? (
                      <BarFigure value={r.gsc.clicks} max={maxClicks} colour="var(--neon-amber)">
                        {int(r.gsc.clicks)}
                      </BarFigure>
                    ) : "—"}
                  </td>
                  <td className="num tt-muted">{r.gsc ? int(r.gsc.impressions) : "—"}</td>
                  <td>{r.gsc?.position ? <PositionPill position={r.gsc.position} /> : "—"}</td>
                  <td className="num">{int(r.publishedWindow)}</td>
                  <td className="num tt-muted">{money(r.spendMonth)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="tt-rank" />
              <td className="tt-left">Fleet</td>
              <td className="num">{int(totals.users)}</td>
              <td className="tt-spark-col" />
              <td className="num">{int(totals.sessions)}</td>
              <td className="num">{int(totals.clicks)}</td>
              <td className="num">{int(totals.impressions)}</td>
              <td className="num">{pos(totals.position)}</td>
              <td className="num">{int(totals.publishedWindow)}</td>
              <td className="num">{money(totals.spendMonth)}</td>
            </tr>
          </tfoot>
        </table>
      </Scroller>
      <p className="micro" style={{ margin: "12px 0 0" }}>
        users, sessions and published over {windowLabel} · position is google&apos;s average · spend is this
        calendar month, in USD —{" "}
        <Link href="/costs" className="nav-link" style={{ padding: 0, fontSize: 11 }}>
          the sterling breakdown is on group costs
        </Link>
      </p>
    </div>
  );
}

function Shell({ children }) {
  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Group analytics</h1>
        </div>
        <FleetNav />
      </header>
      {children}
    </main>
  );
}

export default async function GroupAnalyticsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const period = periodFrom(sp.period);

  // Pulse is context beside the numbers, never the numbers, so it gets its own
  // try: ten WordPress installs being unreachable must not take this page down.
  let pulse = null;
  try {
    pulse = await fleetPulse();
  } catch {
    pulse = null;
  }

  let data;
  try {
    data = await fleetAnalytics({ period: period.key });
    // Once this page is sent, fetch the other periods so their Google results
    // are in the cache (fifteen minutes) before anyone clicks across to them.
    after(() =>
      Promise.allSettled(PERIODS.filter((p) => p.key !== period.key).map((p) => fleetAnalytics({ period: p.key })))
    );
  } catch (err) {
    return (
      <Shell>
        <section className="panel fleet-empty">
          <span className="micro">Not connected</span>
          <h1>Could not read the numbers</h1>
          <p className="fleet-err">{String(err.message).split("\n")[0]}</p>
        </section>
      </Shell>
    );
  }

  const { rows: allRows, titleOrder, windowLabel } = data;

  if (!allRows.length) {
    return (
      <Shell>
        <section className="panel fleet-empty">
          <span className="micro">No titles yet</span>
          <h1>Nothing to measure</h1>
          <p>There are no titles in the fleet, so there is nothing to compare.</p>
          <Link href="/new-title" className="btn">Add a title</Link>
        </section>
      </Shell>
    );
  }

  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view : "overview";
  const focus = allRows.find((r) => r.slug === sp.title) || null;
  const rows = focus ? [focus] : allRows;
  const { totals, trend, channels, topPages, topQueries, topClicked = [], topImpressions = [], connected } = focus ? summarise(rows) : data;
  // The fleet payload caps its lists at twelve; the full ranking is recomputed
  // here so the Content view can show more than the overview does.
  const ranked = focus ? { topPages, topQueries, topClicked, topImpressions } : summarise(allRows);

  const href = (next) => {
    const q = new URLSearchParams();
    const v = next.view ?? view;
    const t = next.title === undefined ? focus?.slug : next.title;
    if (v !== "overview") q.set("view", v);
    if (t) q.set("title", t);
    const pk = next.period ?? period.key;
    if (pk !== DEFAULT_PERIOD) q.set("period", pk);
    const s = q.toString();
    return s ? `/analytics?${s}` : "/analytics";
  };

  // Named rather than left as a number to interpret: a title missing from the
  // audience columns is a missing integration, not a magazine nobody reads.
  const unconnected = rows.filter((r) => !r.ga4 && !r.gsc);
  // What Google actually said, deduped — reported rather than diagnosed on
  // the page's behalf, since a confident wrong explanation sends someone to
  // the wrong screen.
  const googleErrors = [...new Set(rows.flatMap((r) => r.errors || []))];

  // Colour by title from the fixed launch order, so the same magazine is the
  // same colour in every donut, sparkline and ranked list on the page.
  const colours = colourMap(titleOrder);
  const byTitle = (pick, display) =>
    rows.map((r) => ({
      key: r.slug,
      label: r.name,
      value: pick(r) || 0,
      colour: colours[r.slug],
      display: display ? display(pick(r) || 0) : undefined,
    }));
  const channelColours = colourMap(channels.map((c) => c.channel).sort());

  // ── Ranked lists ──────────────────────────────────────────────────────
  const pageItems = (list) => {
    const max = Math.max(1, ...list.map((p) => p.views));
    return list.map((p, i) => ({
      key: `${p.siteSlug}-${p.path}-${i}`,
      primary: cleanTitle(p.title, p.siteName) || shortPath(p.path),
      meta: focus ? shortPath(p.path) : `${p.siteName} · ${shortPath(p.path)}`,
      colour: colours[p.siteSlug],
      value: int(p.views),
      unit: "views",
      sub: `${int(p.users)} users`,
      share: p.views / max,
    }));
  };

  // Converters first, then near misses — the same split lib/analytics.js
  // selects them by. Near misses are bar-scaled on impressions, since they
  // have no clicks to scale on, and drawn faded so the two never read as one
  // measure.
  const queryItems = (list) => {
    const maxClicks = Math.max(1, ...list.map((q) => q.clicks));
    const maxImpr = Math.max(1, ...list.map((q) => q.impressions));
    return list.map((q, i) => {
      const clicked = q.clicks > 0;
      return {
        key: `${q.siteSlug}-${q.query}-${i}`,
        primary: q.query,
        meta: focus ? null : q.siteName,
        colour: colours[q.siteSlug],
        value: clicked ? int(q.clicks) : int(q.impressions),
        unit: clicked ? "clicks" : "impr.",
        sub: clicked ? `${int(q.impressions)} impr.` : "no clicks yet",
        position: q.position,
        share: clicked ? q.clicks / maxClicks : q.impressions / maxImpr,
        faded: !clicked,
        group: clicked ? "Earning clicks" : "Seen, not clicked yet — worth writing for",
      };
    });
  };

  const converters = ranked.topQueries.filter((q) => q.clicks > 0);
  const nearMisses = ranked.topQueries.filter((q) => q.clicks === 0).sort((a, b) => b.impressions - a.impressions);

  const mostRead = (limit, withAction) => (
    <Card
      title={focus ? "Most read articles" : "Most read articles across the fleet"}
      note={focus ? `page views over ${windowLabel} · articles only` : "every title's articles ranked together · home and site pages left out"}
      action={withAction && ranked.topPages.length > limit ? <Link className="an-link" href={href({ view: "content" })}>See all →</Link> : null}
    >
      {ranked.topPages.length ? (
        <RankedList items={pageItems(ranked.topPages.slice(0, limit))} />
      ) : (
        <Empty>No article views recorded yet.</Empty>
      )}
    </Card>
  );

  // Most organic clicks and most impressions, every article on every title,
  // from Google Search Console. A page has only its address here, so its title
  // is read from the slug.
  const titleFromPath = (p) => {
    const words = decodeURIComponent(String(p).replace(/\/+$/, "").split("/").pop() || "").replace(/[-_]+/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
  const gscPageItems = (list, by) => {
    const max = Math.max(1, ...list.map((p) => p[by]));
    return list.map((p, i) => ({
      key: `${by}-${p.siteSlug}-${p.path}-${i}`,
      primary: titleFromPath(p.path),
      meta: focus ? shortPath(p.path) : p.siteName,
      colour: colours[p.siteSlug],
      position: p.position,
      value: int(by === "clicks" ? p.clicks : p.impressions),
      unit: by === "clicks" ? "clicks" : "impr.",
      sub: by === "clicks" ? `${int(p.impressions)} impr.` : `${int(p.clicks)} clicks`,
      share: p[by] / max,
    }));
  };
  const topArticles = (limit) => (
    <section className="an-pair">
      <Card title="Most organic clicks" note={`${focus ? "this title's" : "every title's"} articles · google clicks over ${windowLabel} · Search Console`}>
        {ranked.topClicked?.length ? (
          <RankedList items={gscPageItems(ranked.topClicked.slice(0, limit), "clicks")} />
        ) : (
          <Empty>No article has a Google click in this window yet.</Empty>
        )}
      </Card>
      <Card title="Most impressions" note={`times shown in google over ${windowLabel} · Search Console`}>
        {ranked.topImpressions?.length ? (
          <RankedList items={gscPageItems(ranked.topImpressions.slice(0, limit), "impressions")} />
        ) : (
          <Empty>No article has appeared in Google in this window yet.</Empty>
        )}
      </Card>
    </section>
  );

  const searched = (limit, withAction) => (
    <Card
      title="What people searched"
      note={focus ? "google queries · clicks, then near misses" : "every title's queries · clicks, then near misses"}
      action={withAction && ranked.topQueries.length > limit ? <Link className="an-link" href={href({ view: "search" })}>See all →</Link> : null}
    >
      {ranked.topQueries.length ? (
        <RankedList items={queryItems(ranked.topQueries.slice(0, limit))} grouped />
      ) : (
        <Empty>No queries have surfaced {focus ? "this title" : "any title"} yet.</Empty>
      )}
    </Card>
  );

  const audienceSpark = (k) => trend.audience.map((d) => ({ date: d.date, value: d[k] }));
  const searchSpark = (k) => trend.search.map((d) => ({ date: d.date, value: d[k] }));

  const trendCard = (title, points, colour, label, empty) => (
    <Card title={title}>
      {points.length ? <TrendChart points={points} color={colour} label={label} /> : <Empty>{empty}</Empty>}
    </Card>
  );

  const grid = (min) => ({
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
    gap: 16,
  });

  // ── LinkedIn ──────────────────────────────────────────────────────────
  // Read from a cache, never live: every figure costs Make operations, so the
  // page shows the last snapshot and a stale one is refreshed after the
  // response has gone, ready for the next visit.
  let li = null;
  if (view === "linkedin") {
    const [hook, cache] = await Promise.all([statsHook(), cachedLinkedInStats()]);
    const { stale, label: updated } = freshness(cache);
    if (hook && stale) after(() => refreshLinkedInStats().catch(() => {}));
    const { period: liPeriod, titles } = await linkedInPeriod(cache, period.key);
    const liRows = rows.map((r) => ({ ...r, li: titles[r.slug] || null }));
    const withData = liRows.filter((r) => r.li && !r.li.error);
    const add = (pick) => withData.reduce((n, r) => n + (pick(r) || 0), 0);
    const keys = ["impressions", "clicks", "likes", "comments", "shares", "followersGained"];
    const now = Object.fromEntries(keys.map((k) => [k, add((r) => r.li.now[k])]));
    const hasPrev = withData.some((r) => r.li.prev);
    const prev = hasPrev ? Object.fromEntries(keys.map((k) => [k, add((r) => r.li.prev?.[k])])) : null;
    // Posts are our own count, so they stand even for a page LinkedIn refused.
    const posted = liRows.filter((r) => r.li);
    now.posts = posted.reduce((n, r) => n + r.li.now.posts, 0);
    if (prev) prev.posts = posted.reduce((n, r) => n + (r.li.prev?.posts || 0), 0);
    const pageRows = withData.filter((r) => r.li.now.pageViews != null);
    now.pageViews = pageRows.length ? add((r) => r.li.now.pageViews) : null;
    if (prev) prev.pageViews = pageRows.length ? add((r) => r.li.prev?.pageViews) : null;
    const followerRows = withData.filter((r) => r.li.followers != null);
    // Fleet daily series, summed by date across titles.
    const byDate = new Map();
    for (const r of withData) {
      for (const d of r.li.trend) {
        const t = byDate.get(d.date) || { date: d.date, impressions: 0, followersGained: 0 };
        t.impressions += d.impressions || 0;
        t.followersGained += d.followersGained || 0;
        byDate.set(d.date, t);
      }
    }
    li = {
      hook: Boolean(hook),
      cache,
      updated,
      days: liPeriod.days,
      rows: liRows,
      now,
      prev,
      followers: followerRows.length ? add((r) => r.li.followers) : null,
      trend: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      errors: liRows.flatMap((r) => (r.li?.error ? [`${r.name}: ${r.li.error}`] : [])),
      partial: withData.flatMap((r) => r.li.errors.map((e) => `${r.name}: ${e}`)),
    };
  }
  const liDelta = (k) => (li?.prev ? <Delta now={li.now[k]} before={li.prev[k]} /> : null);
  const liTrend = li ? li.trend : [];
  const liWindow = li?.days ? (li.days === 1 ? "LinkedIn's latest day" : `last ${li.days} days`) : "all time";

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>{focus ? focus.name : "Group analytics"}</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 0", maxWidth: 560 }}>
            {focus ? (
              <>
                Showing {windowLabel}.{" "}
                <Link href={`/s/${focus.slug}/analytics`} className="an-link">
                  Open {focus.name}&apos;s own analytics →
                </Link>
              </>
            ) : (
              <>
                Every title, {windowLabel}. Audience figures cover the {connected.ga4} of{" "}
                {connected.total} titles on Google Analytics, search the {connected.gsc} on Search Console.
              </>
            )}
          </p>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
          {totals.liveUsers > 0 && (
            <div className="an-live">
              <span className="agent-dot online" />
              <span className="num">{totals.liveUsers}</span>
              <span>reading right now</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="an-filters">
        <div className="an-tabs-row">
          <nav className="an-tabs" aria-label="Analytics view">
            {VIEWS.map((v) => (
              <Link key={v.key} href={href({ view: v.key })} className={`an-tab${v.key === view ? " is-active" : ""}`}>
                {v.label}
              </Link>
            ))}
          </nav>
          <PeriodFilter
            current={period.key}
            hrefs={Object.fromEntries(PERIODS.map((p) => [p.key, href({ period: p.key })]))}
            note={
              view === "linkedin"
                ? "LinkedIn runs about a day behind, so Today is its latest day"
                : period.key === "today"
                ? "Search Console runs about three days behind, so search figures show its latest day"
                : period.key === "all"
                  ? "Search Console keeps 16 months, so search figures go back that far"
                  : "Today, 7 days, 30 days or all time"
            }
          />
        </div>
        <div className="an-titles" aria-label="Filter by title">
          <Link href={href({ title: null })} className={`an-pill${!focus ? " is-active" : ""}`}>
            All titles
          </Link>
          {titleOrder.map((slug) => {
            const r = allRows.find((x) => x.slug === slug);
            if (!r) return null;
            return (
              <Link
                key={slug}
                href={href({ title: slug })}
                className={`an-pill${focus?.slug === slug ? " is-active" : ""}`}
                title={!r.ga4 && !r.gsc ? "Google not connected" : undefined}
              >
                <span className="an-dot" style={{ background: colours[slug], opacity: !r.ga4 && !r.gsc ? 0.35 : 1 }} />
                {r.name}
              </Link>
            );
          })}
        </div>
      </div>

      {unconnected.length > 0 && view !== "linkedin" && (view === "overview" || focus) && (
        <div className="panel" style={{ borderColor: "rgba(251,191,36,0.4)", padding: "14px 18px" }}>
          <p style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: 13 }}>
            <strong style={{ color: "var(--neon-amber)" }}>
              {focus
                ? `${focus.name} is not returning anything from Google.`
                : `${unconnected.length === 1 ? "One title is" : `${unconnected.length} titles are`} missing from the audience and search figures.`}
            </strong>{" "}
            {!focus && (
              <>
                {unconnected.map((r) => r.name).join(", ")} returned nothing from Google, so every total
                is counting the {rows.length - unconnected.length} that did.
                {unconnected.length === rows.length && " That is all of them — the fault is fleet-wide, not per title."}
              </>
            )}
          </p>
          {googleErrors.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 12.5 }}>
              {googleErrors.map((e, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{e}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5 }}>
              Google reported no error, which means no key is configured at all — set
              <code> GOOGLE_SERVICE_ACCOUNT_JSON</code>, then add each title&apos;s properties under
              Settings → Integrations.
            </p>
          )}
        </div>
      )}

      {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
      {view === "overview" && (
        <>
          <section className="an-kpis stagger">
            <Kpi label="Users" value={int(totals.users)} colour="var(--neon-green)"
              delta={<Delta now={totals.users} before={totals.prevUsers} />} spark={audienceSpark("users")} />
            <Kpi label="Page views" value={int(totals.pageViews)} colour="var(--neon-cyan)"
              delta={<Delta now={totals.pageViews} before={totals.prevPageViews} />} spark={audienceSpark("pageViews")} />
            <Kpi label="Search clicks" value={int(totals.clicks)} colour="var(--neon-amber)"
              delta={<Delta now={totals.clicks} before={totals.prevClicks} />} spark={searchSpark("clicks")} />
            <Kpi label="Impressions" value={int(totals.impressions)} colour="var(--neon-violet)"
              delta={<Delta now={totals.impressions} before={totals.prevImpressions} />} spark={searchSpark("impressions")} />
            <Kpi label="Published" value={int(totals.publishedWindow)} colour="var(--brand-2)"
              foot={`${int(totals.pipeline)} in pipeline${totals.awaiting ? ` · ${int(totals.awaiting)} awaiting` : ""}`} />
            <Kpi label="Spend, this month" value={money(totals.spendMonth)} colour="var(--neon-red)"
              foot={<Link href="/costs" className="an-link">breakdown →</Link>} />
          </section>

          {!focus && (
            <section>
              <SectionHead title="Every title" note="biggest audience first · click a title to filter" />
              <TitleTable rows={rows} totals={totals} colours={colours} href={href} windowLabel={windowLabel} />
            </section>
          )}

          {/* Fleet-wide and counted from a different start date, so it only
              appears unfiltered — see PulsePanel for why it stands apart. */}
          {!focus && <PulsePanel pulse={pulse} rows={rows} />}

          <section style={grid(340)}>
            {trendCard("Users per day", audienceSpark("users"), "var(--neon-green)", "users", "No sessions recorded yet.")}
            {trendCard("Search clicks per day", searchSpark("clicks"), "var(--neon-amber)", "clicks", "No search clicks recorded yet.")}
          </section>

          {!focus && (
            <section style={grid(300)}>
              <Card title="Readers, by title" note={`sessions over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.ga4?.sessions)} centre={int(totals.sessions)} centreLabel="sessions"
                  ariaLabel="Share of fleet sessions by title" empty="No sessions recorded across the fleet yet." />
              </Card>
              <Card title="Output, by title" note={`articles published over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.publishedWindow)} centre={int(totals.publishedWindow)} centreLabel="published"
                  ariaLabel="Share of articles published by title" empty="Nothing published in this window." />
              </Card>
              <Card title="Spend, by title" note="agent spend this calendar month">
                <SharePie slices={byTitle((r) => r.spendMonth, money)} centre={money(totals.spendMonth)} centreLabel="this month"
                  ariaLabel="Share of fleet agent spend by title" empty="No agent spend recorded this month." />
              </Card>
            </section>
          )}

          <section className="an-pair">
            {mostRead(6, true)}
            {searched(6, true)}
          </section>

          {topArticles(10)}
        </>
      )}

      {/* ── AUDIENCE ───────────────────────────────────────────────────── */}
      {view === "audience" && (
        <>
          <section className="an-kpis stagger">
            <Kpi label="Users" value={int(totals.users)} colour="var(--neon-green)"
              delta={<Delta now={totals.users} before={totals.prevUsers} />} spark={audienceSpark("users")} />
            <Kpi label="Sessions" value={int(totals.sessions)} colour="var(--brand-2)"
              delta={<Delta now={totals.sessions} before={totals.prevSessions} />} />
            <Kpi label="Page views" value={int(totals.pageViews)} colour="var(--neon-cyan)"
              delta={<Delta now={totals.pageViews} before={totals.prevPageViews} />} spark={audienceSpark("pageViews")} />
            <Kpi label="Avg session" value={mmss(totals.avgDuration)} colour="var(--neon-violet)"
              foot={focus ? null : "session-weighted"} />
            <Kpi label="Pages per session" value={totals.sessions ? (totals.pageViews / totals.sessions).toFixed(1) : "—"}
              colour="var(--neon-amber)" />
          </section>

          <section style={grid(340)}>
            {trendCard("Users per day", audienceSpark("users"), "var(--neon-green)", "users", "No sessions recorded yet.")}
            {trendCard("Page views per day", audienceSpark("pageViews"), "var(--neon-cyan)", "page views", "No page views recorded yet.")}
          </section>

          <section style={grid(340)}>
            <Card title="Where readers come from" note={focus ? "sessions by channel" : "sessions by channel, every title pooled"}>
              <SharePie
                slices={channels.map((c) => ({ key: c.channel, label: c.channel, value: c.sessions, colour: channelColours[c.channel] }))}
                centre={int(totals.sessions)} centreLabel="sessions"
                ariaLabel="Share of sessions by acquisition channel" empty="No sessions to break down yet." />
            </Card>
            {!focus && (
              <Card title="Readers, by title" note={`sessions over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.ga4?.sessions)} centre={int(totals.sessions)} centreLabel="sessions"
                  ariaLabel="Share of fleet sessions by title" empty="No sessions recorded across the fleet yet." />
              </Card>
            )}
          </section>

          {!focus && (
            <Card
              title="Each title, day by day"
              note="users per day · each line is scaled to its own peak, so compare shape, not size"
            >
              <div style={{ display: "grid", gap: 12 }}>
                {rows.map((r) => (
                  <div key={r.id} className="fleet-title-row">
                    <Link
                      href={href({ title: r.slug })}
                      style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", textDecoration: "none", fontSize: 13, minWidth: 0 }}
                    >
                      <span className="an-dot" style={{ background: colours[r.slug] }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    </Link>
                    {r.ga4 ? (
                      <Sparkline points={r.ga4.trend.map((d) => ({ date: d.date, value: d.users }))} colour={colours[r.slug]}
                        label={`${r.name} users per day`} />
                    ) : (
                      <span className="micro" style={{ opacity: 0.6 }}>google not connected</span>
                    )}
                    <span className="num" style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}>
                      {r.ga4 ? `${int(r.ga4.users)} users` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── SEARCH ─────────────────────────────────────────────────────── */}
      {view === "search" && (
        <>
          <section className="an-kpis stagger">
            <Kpi label="Clicks" value={int(totals.clicks)} colour="var(--neon-amber)"
              delta={<Delta now={totals.clicks} before={totals.prevClicks} />} spark={searchSpark("clicks")} />
            <Kpi label="Impressions" value={int(totals.impressions)} colour="var(--neon-violet)"
              delta={<Delta now={totals.impressions} before={totals.prevImpressions} />} spark={searchSpark("impressions")} />
            <Kpi label="Click-through rate" value={pct(totals.ctr)} colour="var(--neon-cyan)"
              delta={<Delta now={totals.ctr} before={totals.prevCtr} />} />
            <Kpi label="Average position" value={pos(totals.position)} colour="var(--neon-green)"
              delta={<Delta now={totals.position} before={totals.prevPosition} lowerIsBetter />} foot="lower is better" />
          </section>

          <section style={grid(340)}>
            {trendCard("Impressions per day", searchSpark("impressions"), "var(--neon-violet)", "impressions", "No impressions recorded yet.")}
            {trendCard("Clicks per day", searchSpark("clicks"), "var(--neon-amber)", "clicks", "No search clicks recorded yet.")}
          </section>

          {topArticles(20)}

          <section className="an-pair">
            <Card title="Earning clicks" note="queries that brought a reader in, by clicks">
              {converters.length ? (
                <RankedList items={queryItems(converters.slice(0, 20))} />
              ) : (
                <Empty>No query has earned a click yet.</Empty>
              )}
            </Card>
            <Card title="Near misses" note="seen in google but not clicked yet · by impressions · worth writing for">
              {nearMisses.length ? (
                <RankedList items={queryItems(nearMisses.slice(0, 20))} />
              ) : (
                <Empty>Every query that surfaced has earned a click.</Empty>
              )}
            </Card>
          </section>

          {!focus && (
            <section style={grid(340)}>
              <Card title="Search clicks, by title" note={`google clicks over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.gsc?.clicks)} centre={int(totals.clicks)} centreLabel="clicks"
                  ariaLabel="Share of search clicks by title" empty="No search clicks recorded yet." />
              </Card>
              <Card title="Impressions, by title" note={`times a title appeared in google over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.gsc?.impressions)} centre={int(totals.impressions)} centreLabel="impressions"
                  ariaLabel="Share of search impressions by title" empty="No impressions recorded yet." />
              </Card>
            </section>
          )}
        </>
      )}

      {/* ── CONTENT ────────────────────────────────────────────────────── */}
      {view === "content" && (
        <>
          <section className="an-kpis stagger">
            <Kpi label="Published" value={int(totals.publishedWindow)} colour="var(--brand-2)" foot={`over ${windowLabel}`} />
            <Kpi label="In pipeline" value={int(totals.pipeline)} colour="var(--neon-cyan)" />
            <Kpi label="Awaiting review" value={int(totals.awaiting)} colour="var(--neon-amber)" />
            <Kpi label="Views per article" colour="var(--neon-green)"
              value={totals.publishedWindow ? int(totals.pageViews / totals.publishedWindow) : "—"}
              foot="page views ÷ published" />
          </section>

          <section className="an-pair">
            {mostRead(20, false)}
            {searched(20, false)}
          </section>

          {!focus && (
            <section style={grid(340)}>
              <Card title="Output, by title" note={`articles published over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.publishedWindow)} centre={int(totals.publishedWindow)} centreLabel="published"
                  ariaLabel="Share of articles published by title" empty="Nothing published in this window." />
              </Card>
              <Card title="Page views, by title" note={`over ${windowLabel}`}>
                <SharePie slices={byTitle((r) => r.ga4?.pageViews)} centre={int(totals.pageViews)} centreLabel="page views"
                  ariaLabel="Share of page views by title" empty="No page views recorded yet." />
              </Card>
            </section>
          )}
        </>
      )}

      {/* ── LINKEDIN ───────────────────────────────────────────────────── */}
      {view === "linkedin" && (
        <>
          {li.hook && (
            <form action={refreshLinkedInStatsNow} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="micro">
                {li.cache ? `LinkedIn figures updated ${li.updated}` : "fetching the first snapshot — reload in a minute"}
              </span>
              <button type="submit" className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12.5 }}>
                Refresh
              </button>
            </form>
          )}

          {!li.hook && (
            <div className="panel" style={{ borderColor: "rgba(251,191,36,0.4)", padding: "14px 18px" }}>
              <p style={{ margin: "0 0 6px", fontSize: 13 }}>
                <strong style={{ color: "var(--neon-amber)" }}>LinkedIn statistics are not connected yet.</strong>
              </p>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5, maxWidth: 720 }}>
                The pages are read through Make scenario 8192526. Save its webhook address as GlobalSetting{" "}
                <code>make_linkedin_api_url</code>.
              </p>
            </div>
          )}

          {(li.errors.length > 0 || li.partial.length > 0) && (
            <div className="panel" style={{ borderColor: "rgba(251,191,36,0.4)", padding: "14px 18px" }}>
              <p style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: 13 }}>
                <strong style={{ color: "var(--neon-amber)" }}>LinkedIn did not answer everything.</strong> Totals count
                only what came back.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 12.5 }}>
                {[...li.errors, ...li.partial].slice(0, 8).map((e, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {li.cache && (
            <>
              <section className="an-kpis stagger">
                <Kpi label="Impressions" value={int(li.now.impressions)} colour="var(--neon-violet)" delta={liDelta("impressions")}
                  spark={liTrend.map((d) => ({ date: d.date, value: d.impressions }))} />
                <Kpi label="Likes" value={int(li.now.likes)} colour="var(--neon-red)" delta={liDelta("likes")} />
                <Kpi label="Comments" value={int(li.now.comments)} colour="var(--neon-amber)" delta={liDelta("comments")} />
                <Kpi label="Reposts" value={int(li.now.shares)} colour="var(--neon-green)" delta={liDelta("shares")} />
                <Kpi label="Clicks" value={int(li.now.clicks)} colour="var(--neon-cyan)" delta={liDelta("clicks")} />
                <Kpi label="Engagement rate" value={engagementRate(li.now) == null ? "—" : pct(engagementRate(li.now))}
                  colour="var(--brand-2)" foot="clicks, likes, comments and reposts ÷ impressions" />
                <Kpi label={li.days ? "Followers gained" : "Followers gained, all time"} value={int(li.now.followersGained)}
                  colour="var(--neon-green)" delta={liDelta("followersGained")}
                  spark={li.days ? liTrend.map((d) => ({ date: d.date, value: d.followersGained })) : null} />
                <Kpi label="Total followers" value={li.followers == null ? "—" : int(li.followers)} colour="var(--neon-cyan)"
                  foot="approximate · from LinkedIn's follower breakdown" />
                <Kpi label="Posts" value={int(li.now.posts)} colour="var(--brand-2)" delta={liDelta("posts")}
                  foot={li.now.posts ? `${int(li.now.impressions / li.now.posts)} impressions a post` : "posted by the engine"} />
                <Kpi label="Page views" value={li.now.pageViews == null ? "—" : int(li.now.pageViews)} colour="var(--neon-violet)"
                  delta={liDelta("pageViews")} foot={li.days ? "visits to the company page" : "not given for all time"} />
              </section>

              {!focus && (
                <section>
                  <SectionHead title="Every page" note={`${liWindow} · most followers first`} />
                  <div className="panel" style={{ padding: "16px 18px" }}>
                    <Scroller>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 960 }}>
                        <thead>
                          <tr>
                            <th className="micro" style={{ ...headCell, textAlign: "left", paddingLeft: 0 }}>Title</th>
                            <th className="micro" style={headCell}>Followers</th>
                            <th className="micro" style={headCell}>Gained</th>
                            <th className="micro" style={headCell}>Posts</th>
                            <th className="micro" style={headCell}>Impr.</th>
                            <th className="micro" style={headCell}>Likes</th>
                            <th className="micro" style={headCell}>Comments</th>
                            <th className="micro" style={headCell}>Reposts</th>
                            <th className="micro" style={headCell}>Clicks</th>
                            <th className="micro" style={headCell}>Eng.</th>
                            <th className="micro" style={headCell}>Page views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...li.rows]
                            .sort((a, b) => (b.li?.followers ?? -1) - (a.li?.followers ?? -1))
                            .map((r) => {
                              const n = r.li && !r.li.error ? r.li.now : null;
                              const rate = n ? engagementRate(n) : null;
                              return (
                                <tr key={r.id} className="an-row">
                                  <td style={{ ...cell, textAlign: "left", paddingLeft: 0, maxWidth: 260 }}>
                                    <Link href={href({ title: r.slug })}
                                      style={{ color: "var(--text)", textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
                                      <span className="an-dot" style={{ background: colours[r.slug] }} />
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                                    </Link>
                                    {!n && <span className="micro" style={{ paddingLeft: 17 }}>{r.li ? "no data" : "not fetched yet"}</span>}
                                  </td>
                                  <td className="num" style={cell}>{r.li?.followers == null ? "—" : int(r.li.followers)}</td>
                                  <td className="num" style={{ ...cell, color: n?.followersGained ? "var(--neon-green)" : "var(--muted)" }}>
                                    {n ? int(n.followersGained) : "—"}
                                  </td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>{r.li ? int(r.li.now.posts) : "—"}</td>
                                  <td className="num" style={cell}>{n ? int(n.impressions) : "—"}</td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>{n ? int(n.likes) : "—"}</td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>{n ? int(n.comments) : "—"}</td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>{n ? int(n.shares) : "—"}</td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>{n ? int(n.clicks) : "—"}</td>
                                  <td className="num" style={cell}>{rate == null ? "—" : pct(rate)}</td>
                                  <td className="num" style={{ ...cell, color: "var(--muted)" }}>
                                    {n?.pageViews == null ? "—" : int(n.pageViews)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </Scroller>
                    <p className="micro" style={{ margin: "12px 0 0" }}>
                      posts are the ones the engine put out · engagement is clicks, likes, comments and reposts over
                      impressions · LinkedIn&apos;s figures run about a day behind
                    </p>
                  </div>
                </section>
              )}

              <section style={grid(340)}>
                {trendCard(
                  li.days && li.days > 1 ? "Impressions per day" : "Impressions per day, recent",
                  liTrend.map((d) => ({ date: d.date, value: d.impressions })),
                  "var(--neon-violet)", "impressions", "No impressions recorded yet.",
                )}
                {trendCard(
                  li.days && li.days > 1 ? "Followers gained per day" : "Followers gained per day, recent",
                  liTrend.map((d) => ({ date: d.date, value: d.followersGained })),
                  "var(--neon-green)", "followers", "No followers gained yet.",
                )}
              </section>

              {!focus && (
                <section style={grid(340)}>
                  <Card title="Followers, by title" note="who has built the biggest page">
                    <SharePie slices={byTitle((r) => li.rows.find((x) => x.slug === r.slug)?.li?.followers)}
                      centre={li.followers == null ? "—" : int(li.followers)} centreLabel="followers"
                      ariaLabel="Share of LinkedIn followers by title" empty="No follower counts yet." />
                  </Card>
                  <Card title="Impressions, by title" note={liWindow}>
                    <SharePie slices={byTitle((r) => li.rows.find((x) => x.slug === r.slug)?.li?.now?.impressions)}
                      centre={int(li.now.impressions)} centreLabel="impressions"
                      ariaLabel="Share of LinkedIn impressions by title" empty="No impressions recorded yet." />
                  </Card>
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
