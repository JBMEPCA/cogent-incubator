import Link from "next/link";
import FleetNav from "../components/FleetNav";
import TrendChart from "../components/TrendChart";
import { SharePie, Sparkline, colourMap } from "../components/FleetCharts";
import { fleetAnalytics } from "@/lib/fleet-analytics";

export const dynamic = "force-dynamic";

// Every title's numbers on one screen.
//
// The per-title Analytics tab is the place to work out why one magazine is
// doing what it is doing. This is the place to work out which magazine to open
// — so it leads with the comparison table, and everything above it is context
// for reading that table rather than a dashboard in its own right.

const int = (n) => Math.round(n || 0).toLocaleString();
const pct = (n) => `${(n || 0).toFixed(1)}%`;
const pos = (n) => (n ? n.toFixed(1) : "—");
const money = (usd) => (usd >= 100 ? `$${Math.round(usd)}` : `$${(usd || 0).toFixed(2)}`);
const mmss = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const shortPath = (p) => (p === "/" ? "/ (home)" : String(p).replace(/\/$/, ""));

// Change against the previous window of the same length. Position is the one
// metric where down is good.
function Delta({ now, before, lowerIsBetter = false }) {
  if (!before) return <span className="micro" style={{ color: "var(--muted)" }}>no prior data</span>;
  const change = ((now - before) / before) * 100;
  if (!isFinite(change) || Math.abs(change) < 0.5) {
    return <span className="micro" style={{ color: "var(--muted)" }}>flat</span>;
  }
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className="micro num" style={{ color: good ? "var(--neon-green)" : "var(--neon-red)", letterSpacing: "0.06em" }}>
      {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs prev 28d
    </span>
  );
}

function Tile({ label, value, tone, children }) {
  return (
    <div className="panel" style={{ padding: 16, minWidth: 0 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value num" style={{ fontSize: 27, margin: "4px 0 6px", color: tone }}>{value}</div>
      {children}
    </div>
  );
}

const tileGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 165px), 1fr))",
  gap: 14,
};

const cell = {
  padding: "9px 0 9px 14px",
  borderBottom: "1px solid var(--line)",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const headCell = { ...cell, padding: "0 0 8px 14px", fontWeight: 400, color: "var(--muted)" };

export default async function GroupAnalyticsPage() {
  let data;
  try {
    data = await fleetAnalytics();
  } catch (err) {
    return (
      <main className="fleet-wrap">
        <header className="fleet-head">
          <div>
            <span className="micro">Cogent Incubator</span>
            <h1>Group analytics</h1>
          </div>
          <FleetNav />
        </header>
        <section className="panel fleet-empty">
          <span className="micro">Not connected</span>
          <h1>Could not read the numbers</h1>
          <p className="fleet-err">{String(err.message).split("\n")[0]}</p>
        </section>
      </main>
    );
  }

  const { rows, titleOrder, totals, trend, channels, topPages, topQueries, connected, windowDays } = data;

  if (!rows.length) {
    return (
      <main className="fleet-wrap">
        <header className="fleet-head">
          <div>
            <span className="micro">Cogent Incubator</span>
            <h1>Group analytics</h1>
          </div>
          <FleetNav />
        </header>
        <section className="panel fleet-empty">
          <span className="micro">No titles yet</span>
          <h1>Nothing to measure</h1>
          <p>There are no titles in the fleet, so there is nothing to compare.</p>
          <Link href="/new-title" className="btn">Add a title</Link>
        </section>
      </main>
    );
  }

  // Named rather than left as a number to interpret: a title missing from the
  // audience columns is a missing integration, not a magazine nobody reads,
  // and those two need very different responses.
  const unconnected = rows.filter((r) => !r.ga4 && !r.gsc);
  // What Google actually said, deduped — the same fleet-wide fault (an
  // unreadable service-account key, a revoked grant) otherwise repeats once
  // per title and buries the one line that identifies it.
  //
  // Reported rather than diagnosed on the page's behalf. An earlier version
  // asserted "no property set", which was wrong the first time a real failure
  // turned up: the properties were set and the key file could not be read, and
  // the confident wrong explanation would have sent someone to the wrong screen.
  const googleErrors = [...new Set(rows.flatMap((r) => r.errors || []))];

  // Colour by title, from the fixed launch order the data layer supplies, so
  // the same magazine is the same colour in all four donuts and in the strip
  // of per-title trends further down.
  const colours = colourMap(titleOrder);
  const byTitle = (pick, display) =>
    rows.map((r) => ({
      key: r.slug,
      label: r.name,
      value: pick(r) || 0,
      colour: colours[r.slug],
      display: display ? display(pick(r) || 0) : undefined,
    }));

  // Channels are entities too, so their colour comes from a fixed alphabetical
  // order rather than from how they happen to rank this month.
  const channelColours = colourMap(channels.map((c) => c.channel).sort());

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Group analytics</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 0", maxWidth: 560 }}>
            Every title, rolling {windowDays} days. Editorial figures are exact; audience figures
            cover the {connected.ga4} of {connected.total} titles connected to Google Analytics and{" "}
            {connected.gsc} connected to Search Console.
          </p>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
          {totals.liveUsers > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <span className="agent-dot online" />
                <span className="stat-value num" style={{ fontSize: 26 }}>{totals.liveUsers}</span>
              </div>
              <div className="stat-label">reading right now, fleet-wide</div>
            </div>
          )}
        </div>
      </header>

      {/* ── Audience, fleet-wide ───────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Audience</h2>
          <span className="micro">last {windowDays} days · summed across {connected.ga4} titles</span>
        </div>
        <div className="stagger" style={tileGrid}>
          <Tile label="Users" value={int(totals.users)}>
            <Delta now={totals.users} before={totals.prevUsers} />
          </Tile>
          <Tile label="Sessions" value={int(totals.sessions)}>
            <Delta now={totals.sessions} before={totals.prevSessions} />
          </Tile>
          <Tile label="Page views" value={int(totals.pageViews)}>
            <Delta now={totals.pageViews} before={totals.prevPageViews} />
          </Tile>
          <Tile label="Avg session" value={mmss(totals.avgDuration)}>
            <span className="micro">session-weighted across titles</span>
          </Tile>
        </div>
      </section>

      {/* ── Search, fleet-wide ─────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Search visibility</h2>
          <span className="micro">last {windowDays} days · summed across {connected.gsc} titles</span>
        </div>
        <div className="stagger" style={tileGrid}>
          <Tile label="Clicks" value={int(totals.clicks)}>
            <Delta now={totals.clicks} before={totals.prevClicks} />
          </Tile>
          <Tile label="Impressions" value={int(totals.impressions)}>
            <Delta now={totals.impressions} before={totals.prevImpressions} />
          </Tile>
          <Tile label="Click-through rate" value={pct(totals.ctr)}>
            <Delta now={totals.ctr} before={totals.prevCtr} />
          </Tile>
          <Tile label="Average position" value={pos(totals.position)}>
            <Delta now={totals.position} before={totals.prevPosition} lowerIsBetter />
          </Tile>
        </div>
      </section>

      {/* ── The comparison. What this page exists for. ─────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Every title</h2>
          <span className="micro">
            output and spend from our own records · audience from google · biggest audience first
          </span>
        </div>
        <div className="panel" style={{ padding: "16px 18px", overflowX: "auto" }}>
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
                  <tr key={r.id}>
                    <td style={{ ...cell, textAlign: "left", paddingLeft: 0, maxWidth: 260 }}>
                      <Link
                        href={`/s/${r.slug}/analytics`}
                        style={{ color: "var(--text)", textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: r.accentHex || "var(--brand-2)",
                            flex: "none",
                          }}
                        />
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
          <p className="micro" style={{ margin: "12px 0 0" }}>
            published and pipeline over {windowDays} days · spend is this calendar month, in USD —{" "}
            <Link href="/costs" className="nav-link" style={{ padding: 0, fontSize: 11 }}>
              the sterling breakdown is on group costs
            </Link>
          </p>
        </div>
      </section>

      {unconnected.length > 0 && (
        <div className="panel" style={{ borderColor: "rgba(251,191,36,0.4)" }}>
          <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 13 }}>
            <strong style={{ color: "var(--neon-amber)" }}>
              {unconnected.length === 1 ? "One title is" : `${unconnected.length} titles are`} missing from
              the audience and search figures.
            </strong>{" "}
            {unconnected.map((r) => r.name).join(", ")} returned nothing from Google, so every fleet
            total above is counting the {rows.length - unconnected.length} that did.
            {unconnected.length === rows.length && " That is all of them — the fault is fleet-wide, not per title."}
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

      {/* ── Share of the group ─────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Share of the group</h2>
          <span className="micro">
            part-to-whole at a glance · the table above is where close values get read precisely
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 18 }}>
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Readers, by title</h3>
            <p className="micro" style={{ margin: "0 0 14px" }}>sessions over {windowDays} days</p>
            <SharePie
              slices={byTitle((r) => r.ga4?.sessions)}
              centre={int(totals.sessions)}
              centreLabel="sessions"
              ariaLabel="Share of fleet sessions by title"
              empty="No sessions recorded across the fleet yet."
            />
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Output, by title</h3>
            <p className="micro" style={{ margin: "0 0 14px" }}>articles published over {windowDays} days</p>
            <SharePie
              slices={byTitle((r) => r.publishedWindow)}
              centre={int(totals.publishedWindow)}
              centreLabel="published"
              ariaLabel="Share of articles published by title"
              empty="Nothing published in this window."
            />
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Search clicks, by title</h3>
            <p className="micro" style={{ margin: "0 0 14px" }}>google clicks over {windowDays} days</p>
            <SharePie
              slices={byTitle((r) => r.gsc?.clicks)}
              centre={int(totals.clicks)}
              centreLabel="clicks"
              ariaLabel="Share of search clicks by title"
              empty="No search clicks recorded yet."
            />
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Where readers come from</h3>
            <p className="micro" style={{ margin: "0 0 14px" }}>sessions by channel, every title pooled</p>
            <SharePie
              slices={channels.map((c) => ({
                key: c.channel,
                label: c.channel,
                value: c.sessions,
                colour: channelColours[c.channel],
              }))}
              centre={int(totals.sessions)}
              centreLabel="sessions"
              ariaLabel="Share of fleet sessions by acquisition channel"
              empty="No sessions to break down yet."
            />
          </div>

          {/* Spend belongs to the same question — what each title is worth
              running — and it is the one slice here that is a cost rather than
              a return, so it sits last and links out to the full breakdown. */}
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Spend, by title</h3>
            <p className="micro" style={{ margin: "0 0 14px" }}>
              agent spend this calendar month ·{" "}
              <Link href="/costs" className="nav-link" style={{ padding: 0, fontSize: 11 }}>
                full breakdown
              </Link>
            </p>
            <SharePie
              slices={byTitle((r) => r.spendMonth, money)}
              centre={money(totals.spendMonth)}
              centreLabel="this month"
              ariaLabel="Share of fleet agent spend by title"
              empty="No agent spend recorded this month."
            />
          </div>
        </div>
      </section>

      {/* ── Fleet trends ───────────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Day by day, all titles</h2>
          <span className="micro">
            one measure per chart · search console reports three days behind analytics
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18 }}>
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Users per day</h3>
            {trend.audience.length ? (
              <TrendChart
                points={trend.audience.map((d) => ({ date: d.date, value: d.users }))}
                color="var(--neon-green)"
                label="users"
              />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No sessions recorded yet.</p>
            )}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Page views per day</h3>
            {trend.audience.length ? (
              <TrendChart
                points={trend.audience.map((d) => ({ date: d.date, value: d.pageViews }))}
                color="var(--neon-cyan)"
                label="page views"
              />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No page views recorded yet.</p>
            )}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Impressions per day</h3>
            {trend.search.length ? (
              <TrendChart
                points={trend.search.map((d) => ({ date: d.date, value: d.impressions }))}
                color="var(--neon-violet)"
                label="impressions"
              />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No impressions recorded yet.</p>
            )}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Search clicks per day</h3>
            {trend.search.length ? (
              <TrendChart
                points={trend.search.map((d) => ({ date: d.date, value: d.clicks }))}
                color="var(--neon-amber)"
                label="clicks"
              />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No search clicks recorded yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Each title's own shape ─────────────────────────────────────── */}
      <section className="panel" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Each title, day by day</h3>
        <p className="micro" style={{ margin: "0 0 16px" }}>
          users per day · each panel is scaled to its own peak, so these compare shape, not size —
          the figure beside each one carries the size
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="fleet-title-row"
            >
              <Link
                href={`/s/${r.slug}/analytics`}
                style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", textDecoration: "none", fontSize: 13, minWidth: 0 }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 2, background: colours[r.slug], flex: "none" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              </Link>
              {r.ga4 ? (
                <Sparkline
                  points={r.ga4.trend.map((d) => ({ date: d.date, value: d.users }))}
                  colour={colours[r.slug]}
                  label={`${r.name} users per day`}
                />
              ) : (
                <span className="micro" style={{ opacity: 0.6 }}>google not connected</span>
              )}
              <span className="num" style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}>
                {r.ga4 ? `${int(r.ga4.users)} users` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── What gets read ─────────────────────────────────────────────── */}
      <section>
        <div className="panel" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Most read across the fleet</h3>
          <p className="micro" style={{ margin: "0 0 14px" }}>
            every title&apos;s pages ranked together, so the best page in the group is visible
          </p>
          {topPages.length ? (
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
              <thead>
                <tr>
                  <th className="micro" style={{ ...headCell, textAlign: "left", paddingLeft: 0 }}>Page</th>
                  <th className="micro" style={headCell}>Title</th>
                  <th className="micro" style={headCell}>Views</th>
                  <th className="micro" style={headCell}>Users</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p, i) => (
                  <tr key={`${p.siteSlug}-${p.path}-${i}`}>
                    <td style={{ ...cell, textAlign: "left", paddingLeft: 0, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.title || shortPath(p.path)}
                    </td>
                    <td style={{ ...cell, color: "var(--muted)" }}>{p.siteName}</td>
                    <td className="num" style={cell}>{int(p.views)}</td>
                    <td className="num" style={{ ...cell, color: "var(--muted)" }}>{int(p.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No page views recorded yet.</p>
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>What people searched, across every title</h3>
        <p className="micro" style={{ margin: "0 0 14px" }}>
          queries ranked by clicks, fleet-wide · the title each one landed on is beside it
        </p>
        {topQueries.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th className="micro" style={{ ...headCell, textAlign: "left", paddingLeft: 0 }}>Query</th>
                  <th className="micro" style={headCell}>Title</th>
                  <th className="micro" style={headCell}>Clicks</th>
                  <th className="micro" style={headCell}>Impr.</th>
                  <th className="micro" style={headCell}>Pos.</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((q, i) => (
                  <tr key={`${q.siteSlug}-${q.query}-${i}`}>
                    <td style={{ ...cell, textAlign: "left", paddingLeft: 0, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.query}
                    </td>
                    <td style={{ ...cell, color: "var(--muted)" }}>{q.siteName}</td>
                    <td className="num" style={cell}>{int(q.clicks)}</td>
                    <td className="num" style={{ ...cell, color: "var(--muted)" }}>{int(q.impressions)}</td>
                    <td className="num" style={{ ...cell, color: "var(--muted)" }}>{pos(q.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            No queries have surfaced any title yet.
          </p>
        )}
      </section>
    </main>
  );
}
