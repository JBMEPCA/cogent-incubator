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
// metric where down is good, hence `lowerIsBetter`. The window itself comes
// from the data layer as `basis`, since a site too young to have a previous 28
// days is compared over seven instead.
function Delta({ now, before, lowerIsBetter = false, suffix = "%", basis = "prev 28d", bare = false }) {
  if (!before) {
    return (
      <span className="micro" style={{ color: "var(--muted)" }}>{bare ? "new" : "no prior data"}</span>
    );
  }
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
      {suffix}
      {bare ? "" : ` vs ${basis}`}
    </span>
  );
}

// Position with its movement alongside. `posDelta` is already signed so that
// positive means the row climbed the results page, which is a falling number.
function PosCell({ position, posDelta }) {
  if (posDelta == null || Math.abs(posDelta) < 0.5) return <>{pos(position)}</>;
  return (
    <>
      {pos(position)}{" "}
      <span
        className="micro num"
        style={{ color: posDelta > 0 ? "var(--neon-green)" : "var(--neon-red)" }}
      >
        {posDelta > 0 ? "▲" : "▼"}
        {Math.abs(posDelta).toFixed(1)}
      </span>
    </>
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

  // The headline figure is always the 28-day total; only the comparison behind
  // it narrows to seven days while the title is new.
  const cmp = (metric) => ({
    now: gsc.compare.now[metric],
    before: gsc.compare.before[metric],
    basis: gsc.compare.basis,
  });
  const acmp = (metric) => ({
    now: ga4.compare.now[metric],
    before: ga4.compare.before[metric],
    basis: ga4.compare.basis,
  });

  // Email clicks arrive with no referrer, so an untagged newsletter lands in
  // Direct. Worth saying out loud rather than leaving as a number to interpret.
  const untaggedNewsletter = ga4 && ga4.email.sessions === 0 && ga4.direct.sessions > 0;

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
                <Delta {...cmp("clicks")} />
              </Tile>
              <Tile label="Impressions" value={int(gsc.impressions)}>
                <Delta {...cmp("impressions")} />
              </Tile>
              <Tile label="Click-through rate" value={pct(gsc.ctr)}>
                <Delta {...cmp("ctr")} />
              </Tile>
              <Tile label="Average position" value={pos(gsc.position)}>
                <Delta {...cmp("position")} lowerIsBetter />
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
                <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>What people searched</h3>
                <p className="micro" style={{ margin: "0 0 14px" }}>
                  everything that earned a click, then the biggest by impressions · position
                  movement vs {gsc.compare.basis}
                </p>
                <Table
                  head={["Query", "Clicks", "Impr.", "Pos."]}
                  rows={gsc.topQueries.map((q) => [
                    q.query,
                    int(q.clicks),
                    int(q.impressions),
                    <PosCell key="p" position={q.position} posDelta={q.posDelta} />,
                  ])}
                  empty="No queries have surfaced the site yet."
                />
              </div>
              <div className="panel" style={{ padding: 18 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Pages earning search traffic</h3>
                <p className="micro" style={{ margin: "0 0 14px" }}>
                  position movement vs {gsc.compare.basis}
                </p>
                <Table
                  head={["Page", "Clicks", "Impr.", "Pos."]}
                  rows={gsc.topPages.map((p) => [
                    shortPath(p.page),
                    int(p.clicks),
                    int(p.impressions),
                    <PosCell key="p" position={p.position} posDelta={p.posDelta} />,
                  ])}
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
                <Delta {...acmp("users")} />
              </Tile>
              <Tile label="Sessions" value={int(ga4.sessions)}>
                <Delta {...acmp("sessions")} />
              </Tile>
              <Tile label="Page views" value={int(ga4.pageViews)}>
                <Delta {...acmp("pageViews")} />
              </Tile>
              <Tile label="Avg session" value={mmss(ga4.avgDuration)}>
                <Delta {...acmp("avgDuration")} />
              </Tile>
            </div>

            <div className="stagger" style={tileGrid}>
              <Tile label="From Google search" value={int(ga4.organic.sessions)}>
                <div className="micro" style={{ marginBottom: 2 }}>
                  {pct(ga4.organic.share)} of sessions
                </div>
                <Delta now={ga4.organic.now} before={ga4.organic.before} basis={ga4.compare.basis} />
              </Tile>
              <Tile label="Direct" value={int(ga4.direct.sessions)}>
                <div className="micro" style={{ marginBottom: 2 }}>
                  {pct(ga4.direct.share)} of sessions
                </div>
                <Delta now={ga4.direct.now} before={ga4.direct.before} basis={ga4.compare.basis} />
              </Tile>
              <Tile label="Email" value={int(ga4.email.sessions)}>
                <div className="micro" style={{ marginBottom: 2 }}>
                  {pct(ga4.email.share)} of sessions
                </div>
                <Delta now={ga4.email.now} before={ga4.email.before} basis={ga4.compare.basis} />
              </Tile>
              <Tile label="Referral" value={int(ga4.referral.sessions)}>
                <div className="micro" style={{ marginBottom: 2 }}>
                  {pct(ga4.referral.share)} of sessions
                </div>
                <Delta now={ga4.referral.now} before={ga4.referral.before} basis={ga4.compare.basis} />
              </Tile>
            </div>

            {untaggedNewsletter && (
              <div className="panel" style={{ marginBottom: 18, borderColor: "rgba(251,191,36,0.4)" }}>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                  <strong style={{ color: "var(--neon-amber)" }}>Direct is hiding your newsletter.</strong>{" "}
                  {int(ga4.direct.sessions)} sessions came in with no source attached and Email shows
                  none, which is what untagged links look like: a click from an email client arrives
                  with no referrer, so GA4 files it under Direct alongside typed-in addresses and
                  bookmarks. Add <code>?utm_source=newsletter&amp;utm_medium=email</code> to the links
                  in the newsletter template and those sessions move into Email, where they can be
                  counted separately from real direct traffic.
                </p>
              </div>
            )}

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
                <p className="micro" style={{ margin: "0 0 14px" }}>
                  sessions by channel · share of total · change vs {ga4.compare.basis}
                </p>
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
                              gap: 10,
                              fontSize: 13,
                              marginBottom: 5,
                            }}
                          >
                            <span>{c.channel}</span>
                            <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                              <Delta now={c.now} before={c.before} bare />
                              <span className="num" style={{ color: "var(--muted)" }}>
                                {int(c.sessions)} · {pct(c.share)}
                              </span>
                            </span>
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
