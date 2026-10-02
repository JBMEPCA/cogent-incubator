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

/**
 * One stat tile. Label in sentence case above, figure below, delta under it.
 *
 * The old version shouted four uppercase mono captions across four columns and
 * wrapped "clicks, all time / 0 in the last 7 days" onto three lines, which is
 * what made the row look cluttered. Three tiles, quiet labels, one loud number
 * each. The rise belongs to impressions, so it rides in that tile rather than
 * taking a column of its own.
 */
function Stat({ label, value, delta, deltaTone = "flat", sub }) {
  return (
    <div className="rstat">
      <div className="rstat-label">{label}</div>
      <div className="rstat-value">{value}</div>
      {delta && <div className={`rstat-delta ${deltaTone}`}>{delta}</div>}
      {sub && <div className="rstat-sub">{sub}</div>}
    </div>
  );
}

/** Compact: 1,284 stays, 12,900 becomes 12.9K. */
function compact(n) {
  if (n == null) return "—";
  return n >= 10000 ? `${Math.round(n / 100) / 10}K` : n.toLocaleString("en-GB");
}

export function Figures({ row }) {
  // A fall in the position number is a climb up the results, so the arrow and
  // the colour follow the meaning rather than the arithmetic.
  const moved =
    row.positionPrev != null && row.position != null
      ? Math.round((row.positionPrev - row.position) * 10) / 10
      : null;

  return (
    <div className="rising-figures">
      <Stat
        label="Impressions, 7 days"
        value={compact(row.recent)}
        delta={`▲ ${compact(row.change)}${row.pct != null ? ` · +${row.pct}%` : ""}`}
        deltaTone="up"
        sub={`from ${compact(row.previous)} the week before`}
      />
      <Stat
        label="Average position"
        value={row.position ?? "—"}
        delta={moved ? `${moved > 0 ? "▲" : "▼"} ${Math.abs(moved)}` : moved === 0 ? "no change" : null}
        deltaTone={moved > 0 ? "up" : moved < 0 ? "down" : "flat"}
        sub={row.positionPrev != null ? `from ${row.positionPrev}` : "first week ranking"}
      />
      <Stat
        label="Clicks, all time"
        value={compact(row.clicksAll ?? row.clicks)}
        // A row with no clicks at all says so once, in the figure. Repeating
        // "0 in the last 7 days" underneath is the same nothing twice.
        sub={
          !(row.clicksAll ?? row.clicks)
            ? null
            : row.clicks
              ? `${row.clicks.toLocaleString("en-GB")} in the last 7 days`
              : "none in the last 7 days"
        }
      />
    </div>
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
      <p className="rising-note">
        28 days to {last ? fmtDay(last) : "yesterday"}, last 7 highlighted · each chart on its own scale · a lower position number is better · Search Console, hourly
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
                <Bars daily={r.daily} dates={dates} title={r.title} />
                <Figures row={r} />
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
