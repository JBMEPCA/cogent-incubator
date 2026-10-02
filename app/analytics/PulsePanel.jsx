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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {counted.map(({ row, p }) => (
            <div
              key={row.id}
              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 70px 150px", gap: 14, alignItems: "baseline" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: row.accentHex || "var(--brand-2)",
                    flex: "none",
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
              </span>
              <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>{int(p.humans)}</span>
              <span className="micro" style={{ color: "var(--muted)" }}>
                {Object.entries(p.sources || {})
                  .filter(([k]) => k !== "bot")
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${k} ${v}`)
                  .join(", ") || "—"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="micro" style={{ margin: 0 }}>
          Counting is live on every title. Nothing has been read yet since it started.
        </p>
      )}
    </section>
  );
}
