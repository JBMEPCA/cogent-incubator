// Readers the sites counted for themselves.
//
// This began life as a column in the comparison table and had to come out.
// Every other column there is a 28 day window; this one started counting on 2
// October. Formatted identically and sitting one cell away from GA4's users,
// it read as the same kind of number over the same period, and it is neither.
// JB spotted it within an hour of it shipping.
//
// On its own, with its own start date in the heading, it can say what it is:
// a count that began on a particular day and has no history before it, because
// nothing recorded one. GA4 did not mislabel those readers, it never saw them,
// so there is nothing to backfill from.

const int = (n) => Math.round(n || 0).toLocaleString("en-GB");
const pct = (n, of) => `${Math.round((100 * (n || 0)) / (of || 1))}%`;

// Fixed order and colours, so a segment means the same thing on every row.
// Direct (mostly newsletter clicks, which arrive without a referrer) is the
// base of every bar, with search next to it.
const SOURCES = [
  { key: "direct", label: "Direct and newsletter", color: "var(--brand-2)" },
  { key: "search", label: "Search", color: "var(--neon-green)" },
  { key: "social", label: "Social", color: "var(--neon-violet)" },
  { key: "internal", label: "Internal", color: "var(--neon-amber)" },
  { key: "other", label: "Other", color: "var(--muted)" },
];

function since(iso) {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

// Calendar days, counting both ends, so the first day reads "today" rather
// than "2 days". Rounding part of a day up was giving the count a day it had
// not had, which on a figure this young is most of its claimed life.
function daysOf(iso) {
  if (!iso) return 0;
  const start = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(1, Math.round((today - start) / 864e5) + 1);
}

export default function PulsePanel({ pulse, rows = [] }) {
  if (!pulse || pulse.errors?.length && !pulse.counting) {
    return (
      <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Readers, counted on the sites</h3>
        <p className="micro" style={{ margin: 0 }}>
          {pulse?.errors?.[0] || "Not reporting yet."}
        </p>
      </section>
    );
  }

  const started = since(pulse.first);
  const days = daysOf(pulse.first);
  // Only titles that have actually counted something, biggest first. A title
  // with nothing yet is not a title nobody read, it is a title nobody has read
  // SINCE WE STARTED, and listing a column of zeros says the wrong thing.
  const counted = rows
    .map((r) => ({ row: r, p: pulse.bySite?.[r.id] }))
    .filter((x) => x.p && x.p.humans > 0)
    .sort((a, b) => b.p.humans - a.p.humans);
  const max = counted[0]?.p.humans || 1;

  return (
    <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Readers, counted on the sites</h3>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
        Counted by each site itself, with no cookie, so the consent banner cannot hide anyone.{" "}
        {started ? (
          <>
            Since <strong style={{ color: "var(--text)" }}>{started}</strong>, which is {days === 1 ? "today" : `${days} days`}.
          </>
        ) : (
          "Nothing counted yet."
        )}
      </p>
      <p className="rising-note">
        not comparable with the 28 day figures above · there is no history before the start date, because nothing recorded one · known crawlers counted separately
      </p>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", margin: "0 0 14px" }}>
        <div>
          <div className="rstat-label">Readers</div>
          <div className="rstat-value" style={{ color: "var(--neon-cyan)" }}>{int(pulse.totals.humans)}</div>
          <div className="rstat-sub">across {pulse.counting} titles reporting</div>
        </div>
        <div>
          <div className="rstat-label">Crawlers</div>
          <div className="rstat-value">{int(pulse.totals.bots)}</div>
          <div className="rstat-sub">excluded from the figure left</div>
        </div>
      </div>

      {counted.length ? (
        <div className="pulse-list">
          <div className="pulse-legend">
            {SOURCES.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          <div className="pulse-row pulse-head">
            <span>Title</span>
            <span>Where readers came from</span>
            <span className="pulse-fig">Readers</span>
            <span className="pulse-fig">From search</span>
          </div>
          {counted.map(({ row, p }) => {
            const src = p.sources || {};
            const total = SOURCES.reduce((n, s) => n + (src[s.key] || 0), 0) || 1;
            const search = src.search || 0;
            return (
              <div key={row.id} className="pulse-row">
                <span className="pulse-name">
                  <span className="pulse-dot" style={{ background: row.accentHex || "var(--brand-2)" }} />
                  <span className="pulse-title">{row.name}</span>
                </span>
                {/* Bar length is the title's readers against the biggest
                    title's, so the column compares titles at a glance; the
                    segments inside it are that title's own source split. */}
                <span className="pulse-track">
                  <span className="pulse-bar" style={{ width: `${(p.humans / max) * 100}%` }}>
                    {SOURCES.filter((s) => src[s.key]).map((s) => (
                      <span
                        key={s.key}
                        title={`${s.label}: ${int(src[s.key])} (${pct(src[s.key], total)})`}
                        style={{ flex: src[s.key], background: s.color }}
                      />
                    ))}
                  </span>
                </span>
                <span className="pulse-fig pulse-readers">{int(p.humans)}</span>
                <span className="pulse-fig pulse-search">
                  {pct(search, total)}
                  <small>{int(search)}</small>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="micro" style={{ margin: 0 }}>
          Counting is live on every title. Nothing has been read yet since it started.
        </p>
      )}
    </section>
  );
}
