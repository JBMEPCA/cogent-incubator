// Visits the sites counted for themselves. "Readers" until Nov 2026, renamed
// because a count of page visits is not a count of people.
//
// Since Nov 2026 the visits are the page's headline figure, over the page's
// own period, and this panel is their source breakdown. History below:
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
// Email has its own source from Pulse 1.3.0 (newsletter links carry
// utm_medium=email); before that, newsletter clicks arrived without a referrer
// and were filed as direct, which is why old direct figures run so high.
const SOURCES = [
  { key: "email", label: "Email", color: "var(--neon-red)" },
  { key: "direct", label: "Direct", color: "var(--brand-2)" },
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

// Ahrefs Domain Rating, with the day it was taken on hover. Below 10 it keeps
// one decimal, because 0.1 and 0 are different stories on a young title.
function Dr({ r }) {
  if (!r) return <span className="pulse-fig pulse-dr">–</span>;
  const v = r.dr < 10 ? Math.round(r.dr * 10) / 10 : Math.round(r.dr);
  return (
    <span className="pulse-fig pulse-dr" title={`Domain Rating by Ahrefs, ${r.at}`}>
      {v}
    </span>
  );
}

function DrCredit() {
  return (
    <p className="pulse-attrib">
      DR: <a href="https://ahrefs.com/" target="_blank" rel="noreferrer">Domain Rating by Ahrefs</a> · hover a figure
      for the day it was taken
    </p>
  );
}

// Its own panel, never rows in the Pulse list: every figure here is GA4, for
// the established titles and the fleet alike, because the established titles
// run no Pulse and a Pulse count beside a GA4 one flatters the fleet about
// threefold. The measure is engaged sessions, which strips the bot traffic
// that inflated MEPCA's page views, on ONE scale so a bar's length is real
// size. Fleet rows keep their colour; established titles are greyed.
export function ComparePanel({ legacy = [], dr = null, since = null }) {
  if (!legacy.length) return null;
  const max = legacy[0]?.views || 1;
  return (
    <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        Against CIM&rsquo;s established titles <span className="pulse-pill">GA4</span>
      </h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
        Our three biggest new titles beside CIM&rsquo;s established ones, {since ? `since ${since}` : "same dates"}, on one
        scale so a bar&rsquo;s length is its real size. Search on our titles is Pulse&rsquo;s count of visits from
        any search engine, because GA4 there only sees readers who accept cookies; CIM&rsquo;s titles run no Pulse,
        so theirs is Search Console&rsquo;s Google clicks or GA4, whichever is higher. Every other channel is GA4 engaged visits, the one measure CIM&rsquo;s titles share with ours;
        GA4 fixes its own rule (10 seconds, a second page, or an action) and it cannot be set to Pulse&rsquo;s 3 seconds.
      </p>
      <div className="pulse-list">
        <div className="pulse-legend">
          {SOURCES.filter((s) => s.key !== "internal").map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="pulse-row pulse-head">
          <span>Title</span>
          <span>Where visitors came from</span>
          <span className="pulse-fig">Visits</span>
          <span className="pulse-fig">From search</span>
          <span className="pulse-fig">DR</span>
        </div>
        <LegacyRows legacy={legacy} dr={dr} max={max} />
        {dr && <DrCredit />}
      </div>
    </section>
  );
}

function LegacyRows({ legacy, dr, max }) {
  return (
    <>
      {legacy.map((t) => {
        const src = t.sources || {};
        const search = src.search || 0;
        return (
          <div key={t.name} className={`pulse-row pulse-row-compare${t.fleet ? "" : " pulse-row-legacy"}`}>
            <span className="pulse-name">
              <span
                className={`pulse-dot${t.fleet ? "" : " pulse-dot-legacy"}`}
                style={t.fleet ? { background: t.accentHex || "var(--brand-2)" } : undefined}
              />
              <span className="pulse-title">{t.name}</span>
            </span>
            <span className="pulse-track">
              <span className="pulse-bar" style={{ width: `${(t.views / max) * 100}%` }}>
                {SOURCES.filter((s) => src[s.key]).map((s) => (
                  <span
                    key={s.key}
                    title={`${s.label}: ${int(src[s.key])} (${pct(src[s.key], t.views)})`}
                    style={{ flex: src[s.key], background: s.color }}
                  />
                ))}
              </span>
            </span>
            <span className="pulse-fig pulse-readers">{int(t.views)}</span>
            <span className="pulse-fig pulse-search" title={`Search figure from ${t.searchFrom || "GA4"}`}>
              {pct(search, t.views)}
              <small>{int(search)}</small>
            </span>
            <Dr r={t.fleet ? dr?.bySlug?.[t.slug] : dr?.byName?.[t.name]} />
          </div>
        );
      })}
    </>
  );
}

export default function PulsePanel({ pulse, rows = [], dr = null, windowLabel = null }) {
  if (!pulse || pulse.errors?.length && !pulse.counting) {
    return (
      <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Visits, counted on the sites</h3>
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
  // Which titles run Pulse 1.3.0 yet, and the latest day one switched: the
  // honest start for the fleet as a whole.
  const switched = Object.values(pulse.bySite || {}).map((p) => p.ruleSince).filter(Boolean);
  const rules = { count: switched.length, since: switched.sort().at(-1) || null };

  return (
    <section className="panel" style={{ padding: 18, marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Where visits came from</h3>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)", maxWidth: 820 }}>
        Counted by each site itself, with no cookie, so the consent banner cannot hide anyone. A visit counts once the
        page has been on screen for 3 seconds, which keeps out the mail scanners that open every newsletter link.{" "}
        {started ? (
          <>
            {windowLabel ? `Over ${windowLabel}, the same window as the figures above. ` : ""}
            Counting since <strong style={{ color: "var(--text)" }}>{started}</strong>, which is{" "}
            {days === 1 ? "today" : `${days} days`}.
          </>
        ) : (
          "Nothing counted yet."
        )}
      </p>
      <p className="rising-note">
        there is no history before {started || "the start date"}, because nothing recorded one, so a longer window holds only what has been counted · known crawlers counted separately
      </p>
      <p className="rising-note">
        {rules.count === 0
          ? "the 3 second rule and the Email source are not on the sites yet (Pulse 1.3.0), so Direct still includes newsletter clicks and scanners"
          : `3 second rule and Email source since ${since(rules.since)}${
              rules.count < pulse.counting ? ` on ${rules.count} of ${pulse.counting} titles` : ""
            } · days before that counted every page load, so totals that span the change run high`}
      </p>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", margin: "0 0 14px" }}>
        <div>
          <div className="rstat-label">Visits</div>
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
            <span>Where visits came from</span>
            <span className="pulse-fig">Visits</span>
            <span className="pulse-fig">From search</span>
            <span className="pulse-fig">DR</span>
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
                <Dr r={dr?.bySlug?.[row.slug]} />
              </div>
            );
          })}
          {dr && <DrCredit />}
        </div>
      ) : (
        <p className="micro" style={{ margin: 0 }}>
          Counting is live on every title. Nothing has been read yet since it started.
        </p>
      )}
    </section>
  );
}
