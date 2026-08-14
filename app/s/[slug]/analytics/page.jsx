import Header from "@/app/components/Header";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import SubTabs, { ANALYTICS_TABS } from "@/app/components/SubTabs";
import TrendChart from "@/app/components/TrendChart";
import { fetchAnalytics } from "@/lib/analytics";
import { googleServiceAccountEmail } from "@/lib/google";

export const dynamic = "force-dynamic";

const int = (n) => Math.round(n || 0).toLocaleString();
const pct = (n) => `${(n || 0).toFixed(1)}%`;
const pos = (n) => (n ? n.toFixed(1) : "—");
const mmss = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const shortPath = (url) => {
  try {
    const p = new URL(url).pathname;
    return p === "/" ? "/ (home)" : p.replace(/\/$/, "");
  } catch {
    return url;
  }
};

// Change vs the previous window of the same length. Search position is the one
// metric where down is good, hence `lowerIsBetter`.
function Delta({ now, before, lowerIsBetter = false, suffix = "%" }) {
  if (!before) return <span className="micro" style={{ color: "var(--muted)" }}>no prior data</span>;
  const change = ((now - before) / before) * 100;
  if (!isFinite(change) || Math.abs(change) < 0.5) {
    return <span className="micro" style={{ color: "var(--muted)" }}>flat</span>;
  }
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span
      className="micro num"
      style={{ color: good ? "var(--neon-green)" : "var(--neon-red)", letterSpacing: "0.06em" }}
    >
      {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}
      {suffix} vs prev 28d
    </span>
  );
}

function Tile({ label, value, children }) {
  return (
    <div className="panel" style={{ padding: 16, minWidth: 0 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value num" style={{ fontSize: 28, margin: "4px 0 6px" }}>{value}</div>
      {children}
    </div>
  );
}

const tileGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

function Table({ head, rows, empty }) {
  if (!rows.length) {
    return <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{empty}</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className="micro"
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "0 0 8px",
                  borderBottom: "1px solid var(--line)",
                  fontWeight: 400,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td
                  key={i}
                  className={i === 0 ? undefined : "num"}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                    color: i === 0 ? "var(--text)" : "var(--muted)",
                    maxWidth: i === 0 ? 320 : undefined,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingLeft: i === 0 ? 0 : 12,
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };

  const { config, gsc, ga4, errors } = await fetchAnalytics(creds.google_analytics);
  const serviceAccount = googleServiceAccountEmail();

  const gscQuiet = gsc && gsc.impressions === 0 && gsc.clicks === 0;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ANALYTICS_TABS} active="/analytics" />
        <section
          className="panel panel-glow"
          style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Analytics</h1>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              {config.google
                ? `Live from Google — Search Console ${config.gscSite || "(not set)"} and GA4 property ${config.ga4Property || "(not set)"}. Rolling 28 days.`
                : "Waiting for a Google service-account key."}
            </p>
          </div>
          {ga4 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <span className={`agent-dot${ga4.liveUsers > 0 ? " online" : ""}`} />
                <span className="stat-value num" style={{ fontSize: 30 }}>{ga4.liveUsers}</span>
              </div>
              <div className="stat-label">on the site right now</div>
            </div>
          )}
        </section>

        {!config.google && (
          <div className="panel" style={{ marginBottom: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Not connected yet</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              Set <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (base64 key file), <code>GSC_SITE_URL</code> and{" "}
              <code>GA4_PROPERTY_ID</code>, then grant the service account Viewer access to both properties.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div
            className="panel"
            style={{ marginBottom: 22, borderColor: "rgba(251,191,36,0.4)" }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--neon-amber)" }}>
              Some data could not be read
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13 }}>
              {errors.map((e, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{e}</li>
              ))}
            </ul>
            {serviceAccount && (
              <p className="micro" style={{ marginBottom: 0, marginTop: 10 }}>
                service account: {serviceAccount}
              </p>
            )}
          </div>
        )}

        {/* ── Search visibility ─────────────────────────────────────────── */}
        {gsc && (
          <section style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Search visibility</h2>
              <span className="micro">
                {gsc.range.startDate} → {gsc.range.endDate} · google search console
              </span>
            </div>

            <div className="stagger" style={tileGrid}>
              <Tile label="Clicks" value={int(gsc.clicks)}>
                <Delta now={gsc.clicks} before={gsc.prev.clicks} />
              </Tile>
              <Tile label="Impressions" value={int(gsc.impressions)}>
                <Delta now={gsc.impressions} before={gsc.prev.impressions} />
              </Tile>
              <Tile label="Click-through rate" value={pct(gsc.ctr)}>
                <Delta now={gsc.ctr} before={gsc.prev.ctr} />
              </Tile>
              <Tile label="Average position" value={pos(gsc.position)}>
                <Delta now={gsc.position} before={gsc.prev.position} lowerIsBetter />
              </Tile>
            </div>

            {gscQuiet ? (
              <div className="panel" style={{ marginBottom: 18 }}>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                  Search Console is connected but has no data for this window yet. It reports on a
                  two to three day delay, and a newly verified site takes a few days to accumulate
                  impressions while Google crawls and indexes the pages. Nothing to fix here — check
                  back in a few days.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 18,
                  marginBottom: 18,
                }}
              >
                <div className="panel" style={{ padding: 18 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Impressions per day</h3>
                  <TrendChart
                    points={gsc.trend.map((d) => ({ date: d.date, value: d.impressions }))}
                    color="var(--neon-violet)"
                    label="impressions"
                  />
                </div>
                <div className="panel" style={{ padding: 18 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Clicks per day</h3>
                  <TrendChart
                    points={gsc.trend.map((d) => ({ date: d.date, value: d.clicks }))}
                    color="var(--neon-cyan)"
                    label="clicks"
                  />
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: 18,
              }}
            >
              <div className="panel" style={{ padding: 18 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>What people searched</h3>
                <Table
                  head={["Query", "Clicks", "Impr.", "Pos."]}
                  rows={gsc.topQueries.map((q) => [q.query, int(q.clicks), int(q.impressions), pos(q.position)])}
                  empty="No queries have surfaced the site yet."
                />
              </div>
              <div className="panel" style={{ padding: 18 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Pages earning search traffic</h3>
                <Table
                  head={["Page", "Clicks", "Impr.", "Pos."]}
                  rows={gsc.topPages.map((p) => [shortPath(p.page), int(p.clicks), int(p.impressions), pos(p.position)])}
                  empty="No pages have appeared in results yet."
                />
              </div>
            </div>
          </section>
        )}

        {/* ── Audience ──────────────────────────────────────────────────── */}
        {ga4 && (
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Audience</h2>
              <span className="micro">last 28 days · google analytics 4</span>
            </div>

            <div className="stagger" style={tileGrid}>
              <Tile label="Users" value={int(ga4.users)}>
                <Delta now={ga4.users} before={ga4.prev.users} />
              </Tile>
              <Tile label="Sessions" value={int(ga4.sessions)}>
                <Delta now={ga4.sessions} before={ga4.prev.sessions} />
              </Tile>
              <Tile label="Page views" value={int(ga4.pageViews)}>
                <Delta now={ga4.pageViews} before={ga4.prev.pageViews} />
              </Tile>
              <Tile label="Avg session" value={mmss(ga4.avgDuration)}>
                <Delta now={ga4.avgDuration} before={ga4.prev.avgDuration} />
              </Tile>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
                gap: 18,
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: 18 }}>
                <div className="panel" style={{ padding: 18 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Users per day</h3>
                  {ga4.trend.length ? (
                    <TrendChart
                      points={ga4.trend.map((d) => ({ date: d.date, value: d.users }))}
                      color="var(--neon-green)"
                      label="users"
                    />
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                      No sessions recorded yet.
                    </p>
                  )}
                </div>

                <div className="panel" style={{ padding: 18 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Most read pages</h3>
                  <Table
                    head={["Page", "Views", "Users"]}
                    rows={ga4.topPages.map((p) => [p.title || p.path, int(p.views), int(p.users)])}
                    empty="No page views recorded yet."
                  />
                </div>
              </div>

              <div className="panel" style={{ padding: 18 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Where visitors come from</h3>
                <p className="micro" style={{ margin: "0 0 14px" }}>sessions by channel</p>
                {ga4.channels.length ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {ga4.channels.map((c) => {
                      const top = ga4.channels[0].sessions || 1;
                      return (
                        <div key={c.channel}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              marginBottom: 5,
                            }}
                          >
                            <span>{c.channel}</span>
                            <span className="num" style={{ color: "var(--muted)" }}>{int(c.sessions)}</span>
                          </div>
                          <div
                            className="hbar"
                            style={{
                              width: `${Math.max(2, (c.sessions / top) * 100)}%`,
                              height: 8,
                              background: "var(--neon-cyan)",
                              boxShadow: "0 0 10px var(--neon-cyan)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                    No sessions to break down yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
