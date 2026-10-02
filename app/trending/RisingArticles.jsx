import SiteMark from "@/app/components/SiteMark";

// Rising Articles: our pages whose Google impressions jumped this week.
//
// One small bar chart per article: impressions per day for 28 days, the last 7
// in the accent colour and the 21 before in muted ink, so the jump is visible
// at a glance. A single series per chart, so no legend; the header says what
// the bars are and the window, and each bar has a hover tooltip with its date
// and value. Each chart is on its own scale (the header says so), because the
// point is the shape of each article's rise, not comparing heights across rows.

const W = 224;
const H = 52;
const GAP = 2;
// The position line sits under the bars on the same x scale, so the two read
// as one small multiple: impressions above, where we ranked below.
const LH = 34;

function fmtDay(iso, opts = { day: "numeric", month: "short" }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "Europe/London" });
}

export function Bars({ daily, dates, title }) {
  const max = Math.max(1, ...daily);
  const n = daily.length;
  const bw = (W - GAP * (n - 1)) / n;
  return (
    <svg width={W} height={H + 1} viewBox={`0 0 ${W} ${H + 1}`} role="img" aria-label={`${title}: impressions per day, last ${n} days`} style={{ display: "block", maxWidth: "100%" }}>
      {daily.map((v, i) => {
        const h = v ? Math.max(2, (v / max) * H) : 0;
        const recent = i >= n - 7;
        return (
          <g key={i}>
            {/* Full-height hit area so a zero day still has a tooltip. */}
            <rect x={i * (bw + GAP)} y={0} width={bw} height={H} fill="transparent">
              <title>{`${fmtDay(dates[i], { weekday: "short", day: "numeric", month: "short" })}: ${v.toLocaleString("en-GB")} impressions`}</title>
            </rect>
            {h > 0 && (
              <rect
                x={i * (bw + GAP)}
                y={H - h}
                width={bw}
                height={h}
                rx={Math.min(2, bw / 2)}
                fill={recent ? "var(--neon-cyan)" : "var(--muted)"}
                opacity={recent ? 1 : 0.35}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--line)" />
    </svg>
  );
}

/** Consecutive runs of days that have a position, as arrays of indices. */
function runsOf(values) {
  const out = [];
  let run = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (run.length) out.push(run);
      run = [];
    } else run.push(i);
  });
  if (run.length) out.push(run);
  return out;
}

/**
 * Average position per day, drawn UPSIDE DOWN on purpose.
 *
 * Position 1 is the best rank, so plotted normally an article climbing the
 * results draws a line going down, which is the opposite of what anybody
 * reading this expects. The y axis is inverted: better rank is higher up, and
 * a line rising left to right means the article is climbing. The header says
 * so, because an unlabelled inverted axis is a lie waiting to happen.
 *
 * Days with no impressions have no position and break the line rather than
 * being drawn as zero, which would read as rank 0 and look like a triumph.
 */
export function PositionLine({ posDaily = [], dates, title }) {
  const values = posDaily.filter((v) => v != null);
  if (values.length < 2) return null;

  const best = Math.min(...values);
  const worst = Math.max(...values);
  // A perfectly flat series would divide by zero, so give it a band to sit in.
  const span = worst - best || 2;
  const pad = span * 0.15;
  const top = best - pad;
  const bottom = worst + pad;

  const n = posDaily.length;
  const bw = (W - GAP * (n - 1)) / n;
  const x = (i) => i * (bw + GAP) + bw / 2;
  const y = (v) => ((v - top) / (bottom - top)) * LH;
  const pts = (idx) => idx.map((i) => `${x(i).toFixed(1)},${y(posDaily[i]).toFixed(1)}`).join(" ");

  const lastIdx = posDaily.reduce((acc, v, i) => (v == null ? acc : i), -1);

  return (
    <svg
      width={W}
      height={LH + 1}
      viewBox={`0 0 ${W} ${LH + 1}`}
      role="img"
      aria-label={`${title}: average Google position per day, last ${n} days. Higher on the chart is a better position.`}
      style={{ display: "block", maxWidth: "100%" }}
    >
      {runsOf(posDaily).map((run, k) => {
        const early = run.filter((i) => i < n - 7);
        const recent = run.filter((i) => i >= n - 7);
        // One shared point so the two styles join instead of leaving a gap.
        if (early.length && recent.length) early.push(recent[0]);
        return (
          <g key={k}>
            {early.length > 1 && (
              <polyline points={pts(early)} fill="none" stroke="var(--neon-violet)" strokeWidth={1.5} opacity={0.4} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {recent.length > 1 && (
              <polyline points={pts(recent)} fill="none" stroke="var(--neon-violet)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </g>
        );
      })}
      {lastIdx >= 0 && <circle cx={x(lastIdx)} cy={y(posDaily[lastIdx])} r={2.4} fill="var(--neon-violet)" />}
      {posDaily.map((v, i) => (
        <rect key={i} x={i * (bw + GAP)} y={0} width={bw} height={LH} fill="transparent">
          <title>
            {`${fmtDay(dates[i], { weekday: "short", day: "numeric", month: "short" })}: ${
              v == null ? "no impressions" : `position ${v.toFixed(1)}`
            }`}
          </title>
        </rect>
      ))}
      <line x1={0} x2={W} y1={LH + 0.5} y2={LH + 0.5} stroke="var(--line)" />
    </svg>
  );
}

export default function RisingArticles({ data, sites }) {
  const { dates = [], rows = [], errors = [] } = data || {};
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const last = dates[dates.length - 1];
  const recentFrom = dates[dates.length - 7];
  const prevFrom = dates[dates.length - 14];
  const prevTo = dates[dates.length - 8];

  return (
    <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Rising Articles</h3>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
        Our articles gaining the most Google impressions, across every title. Ranked by the rise from{" "}
        <strong style={{ color: "var(--text)" }}>
          {prevFrom && `${fmtDay(prevFrom)}–${fmtDay(prevTo)}`}
        </strong>{" "}
        to{" "}
        <strong style={{ color: "var(--text)" }}>{recentFrom && `${fmtDay(recentFrom)}–${fmtDay(last)}`}</strong>.
      </p>
      <p className="micro" style={{ margin: "0 0 14px" }}>
        bars: impressions per day, last 28 days to {last ? fmtDay(last) : "yesterday"} · line: average position, drawn so <strong style={{ color: "var(--neon-violet)" }}>higher is a better rank</strong> and a rising line means climbing · last 7 days highlighted on both · each chart on its own scale · from Search Console, refreshed hourly
      </p>

      {rows.length ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r) => {
            const site = siteById.get(r.siteId);
            return (
              <div key={r.url} className="rising-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    {site && <SiteMark site={site} size={18} showStatus={false} />}
                    <span className="micro">{site?.name}</span>
                  </div>
                  <a href={r.url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                    {r.title} ↗
                  </a>
                </div>
                <div className="rising-charts">
                  <Bars daily={r.daily} dates={dates} title={r.title} />
                  <PositionLine posDaily={r.posDaily} dates={dates} title={r.title} />
                </div>
                <div className="rising-figures">
                  <div>
                    <div className="stat-value" style={{ fontSize: 20 }}>{r.recent.toLocaleString("en-GB")}</div>
                    <div className="micro">impressions, last 7 days</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--neon-green)" }}>
                      ▲ {r.change.toLocaleString("en-GB")}
                      {r.pct != null ? ` (+${r.pct}%)` : ""}
                    </div>
                    <div className="micro">vs {r.previous.toLocaleString("en-GB")} the week before</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{r.position ?? "—"}</div>
                    {/* A fall in the number is a climb up the results, so the
                        arrow follows the meaning rather than the arithmetic. */}
                    <div className="micro">
                      avg position
                      {r.positionPrev != null && r.position != null && (
                        <>
                          {" · "}
                          <span
                            style={{
                              color:
                                r.position < r.positionPrev
                                  ? "var(--neon-green)"
                                  : r.position > r.positionPrev
                                    ? "var(--muted)"
                                    : "var(--muted)",
                            }}
                          >
                            {r.position < r.positionPrev ? "▲" : r.position > r.positionPrev ? "▼" : "–"}{" "}
                            {Math.abs(Math.round((r.positionPrev - r.position) * 10) / 10)}
                          </span>{" "}
                          vs {r.positionPrev}
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 20 }}>{r.clicks.toLocaleString("en-GB")}</div>
                    <div className="micro">clicks, last 7 days</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          {errors.length ? `Search Console could not be read: ${errors[0]}` : "No article has risen meaningfully this week."}
        </p>
      )}
    </section>
  );
}
