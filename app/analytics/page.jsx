import Link from "next/link";
import FleetNav from "../components/FleetNav";
import TrendChart from "../components/TrendChart";
import { SharePie, Sparkline, RankedList, colourMap } from "../components/FleetCharts";
import { fleetAnalytics, summarise } from "@/lib/fleet-analytics";
import { fleetPulse } from "@/lib/pulse";
import PulsePanel from "./PulsePanel";
import Scroller from "@/app/components/Scroller";

export const dynamic = "force-dynamic";

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
];

// Change against the previous window of the same length, as a compact chip.
// Position is the one metric where down is good.
function Delta({ now, before, lowerIsBetter = false }) {
  if (!before) return <span className="an-chip">no prior data</span>;
  const change = ((now - before) / before) * 100;
  if (!isFinite(change) || Math.abs(change) < 0.5) return <span className="an-chip">flat</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={`an-chip num ${good ? "is-good" : "is-bad"}`} title="vs the previous 28 days">
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

function Empty({ children }) {
  return <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{children}</p>;
}

const cell = {
  padding: "10px 0 10px 14px",
  borderBottom: "1px solid var(--line)",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const headCell = { ...cell, padding: "0 0 9px 14px", fontWeight: 400, color: "var(--muted)" };

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
    data = await fleetAnalytics();
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

  const { rows: allRows, titleOrder, windowDays } = data;

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
  const { totals, trend, channels, topPages, topQueries, connected } = focus ? summarise(rows) : data;
  // The fleet payload caps its lists at twelve; the full ranking is recomputed
  // here so the Content view can show more than the overview does.
  const ranked = focus ? { topPages, topQueries } : summarise(allRows);

  const href = (next) => {
    const q = new URLSearchParams();
    const v = next.view ?? view;
    const t = next.title === undefined ? focus?.slug : next.title;
    if (v !== "overview") q.set("view", v);
    if (t) q.set("title", t);
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
      title={focus ? "Most read" : "Most read across the fleet"}
      note={focus ? `page views over ${windowDays} days` : "every title's pages ranked together"}
      action={withAction && ranked.topPages.length > limit ? <Link className="an-link" href={href({ view: "content" })}>See all →</Link> : null}
    >
      {ranked.topPages.length ? (
        <RankedList items={pageItems(ranked.topPages.slice(0, limit))} />
      ) : (
        <Empty>No page views recorded yet.</Empty>
      )}
    </Card>
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

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>{focus ? focus.name : "Group analytics"}</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 0", maxWidth: 560 }}>
            {focus ? (
              <>
                Rolling {windowDays} days.{" "}
                <Link href={`/s/${focus.slug}/analytics`} className="an-link">
                  Open {focus.name}&apos;s own analytics →
                </Link>
              </>
            ) : (
              <>
                Every title, rolling {windowDays} days. Audience figures cover the {connected.ga4} of{" "}
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
        <nav className="an-tabs" aria-label="Analytics view">
          {VIEWS.map((v) => (
            <Link key={v.key} href={href({ view: v.key })} className={`an-tab${v.key === view ? " is-active" : ""}`}>
              {v.label}
            </Link>
          ))}
        </nav>
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

      {unconnected.length > 0 && (view === "overview" || focus) && (
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
              <div className="panel" style={{ padding: "16px 18px" }}>
                <Scroller>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
                    <thead>
                      <tr>
                        <th className="micro" style={{ ...headCell, textAlign: "left", paddingLeft: 0 }}>Title</th>
                        <th className="micro" style={headCell}>Published</th>
                        <th className="micro" style={headCell}>Pipeline</th>
                        <th className="micro" style={headCell}>Awaiting</th>
                        <th className="micro" style={headCell}>Spend, mo</th>
                        <th className="micro" style={headCell}>Users</th>
                        <th className="micro" style={headCell}>Sessions</th>
                        <th className="micro" style={headCell}>Clicks</th>
                        <th className="micro" style={headCell}>Impr.</th>
                        <th className="micro" style={headCell}>Pos.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const dark = !r.ga4 && !r.gsc;
                        return (
                          <tr key={r.id} className="an-row">
                            <td style={{ ...cell, textAlign: "left", paddingLeft: 0, maxWidth: 260 }}>
                              <Link
                                href={href({ title: r.slug })}
                                style={{ color: "var(--text)", textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}
                              >
                                <span className="an-dot" style={{ background: colours[r.slug] }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                              </Link>
                              {dark && <span className="micro" style={{ paddingLeft: 17 }}>google not connected</span>}
                            </td>
                            <td className="num" style={cell}>{int(r.publishedWindow)}</td>
                            <td className="num" style={{ ...cell, color: "var(--muted)" }}>{int(r.pipeline)}</td>
                            <td className="num" style={{ ...cell, color: r.awaiting ? "var(--neon-amber)" : "var(--muted)" }}>
                              {int(r.awaiting)}
                            </td>
                            <td className="num" style={{ ...cell, color: "var(--muted)" }}>{money(r.spendMonth)}</td>
                            <td className="num" style={cell}>{r.ga4 ? int(r.ga4.users) : "—"}</td>
                            <td className="num" style={{ ...cell, color: "var(--muted)" }}>{r.ga4 ? int(r.ga4.sessions) : "—"}</td>
                            <td className="num" style={cell}>{r.gsc ? int(r.gsc.clicks) : "—"}</td>
                            <td className="num" style={{ ...cell, color: "var(--muted)" }}>{r.gsc ? int(r.gsc.impressions) : "—"}</td>
                            <td className="num" style={{ ...cell, color: "var(--muted)" }}>{r.gsc ? pos(r.gsc.position) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td style={{ ...cell, textAlign: "left", paddingLeft: 0, borderBottom: "none" }}>Fleet</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.publishedWindow)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.pipeline)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none", color: totals.awaiting ? "var(--neon-amber)" : undefined }}>
                          {int(totals.awaiting)}
                        </td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{money(totals.spendMonth)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.users)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.sessions)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.clicks)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{int(totals.impressions)}</td>
                        <td className="num" style={{ ...cell, borderBottom: "none" }}>{pos(totals.position)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </Scroller>
                <p className="micro" style={{ margin: "12px 0 0" }}>
                  published and pipeline over {windowDays} days · spend is this calendar month, in USD —{" "}
                  <Link href="/costs" className="nav-link" style={{ padding: 0, fontSize: 11 }}>
                    the sterling breakdown is on group costs
                  </Link>
                </p>
              </div>
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
              <Card title="Readers, by title" note={`sessions over ${windowDays} days`}>
                <SharePie slices={byTitle((r) => r.ga4?.sessions)} centre={int(totals.sessions)} centreLabel="sessions"
                  ariaLabel="Share of fleet sessions by title" empty="No sessions recorded across the fleet yet." />
              </Card>
              <Card title="Output, by title" note={`articles published over ${windowDays} days`}>
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
              <Card title="Readers, by title" note={`sessions over ${windowDays} days`}>
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
              <Card title="Search clicks, by title" note={`google clicks over ${windowDays} days`}>
                <SharePie slices={byTitle((r) => r.gsc?.clicks)} centre={int(totals.clicks)} centreLabel="clicks"
                  ariaLabel="Share of search clicks by title" empty="No search clicks recorded yet." />
              </Card>
              <Card title="Impressions, by title" note={`times a title appeared in google over ${windowDays} days`}>
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
            <Kpi label="Published" value={int(totals.publishedWindow)} colour="var(--brand-2)" foot={`over ${windowDays} days`} />
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
              <Card title="Output, by title" note={`articles published over ${windowDays} days`}>
                <SharePie slices={byTitle((r) => r.publishedWindow)} centre={int(totals.publishedWindow)} centreLabel="published"
                  ariaLabel="Share of articles published by title" empty="Nothing published in this window." />
              </Card>
              <Card title="Page views, by title" note={`over ${windowDays} days`}>
                <SharePie slices={byTitle((r) => r.ga4?.pageViews)} centre={int(totals.pageViews)} centreLabel="page views"
                  ariaLabel="Share of page views by title" empty="No page views recorded yet." />
              </Card>
            </section>
          )}
        </>
      )}
    </main>
  );
}
