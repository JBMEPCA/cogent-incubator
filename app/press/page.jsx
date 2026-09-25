import Link from "next/link";
import FleetNav from "@/app/components/FleetNav";
import Scroller from "@/app/components/Scroller";
import PressPush from "@/app/components/PressPush";
import { pressBoard, replyMode, REPLY_MODE_NOTE, OUTCOMES } from "@/lib/press-desk";
import { DEFAULT_USD_TO_GBP } from "@/lib/agents/costs";

export const dynamic = "force-dynamic";
// A push runs the whole desk on one release: rewrite, quote check, quality
// gate, WordPress, reply. That is well past a minute, and a server action runs
// on this route's budget, not its own.
export const maxDuration = 300;

// Every release sent to a press@ box, and what we did with it.
//
// JB, 25 Sep 2026: "the sites are going to transition to being majority PR fed,
// so I want to make sure we have eyes on which ones are used, and can push ones
// forward that you reject." The desk publishes with nobody in the loop and that
// does not change — no human gate before publishing, on any title. What changes
// is that the refusals are now visible and reversible, which is a different
// thing: the gate is after the fact, not in front of it.
//
// Fleet-wide on purpose. Ten mailboxes are ten places to look, and the question
// "what came in today and what did we do with it" is a group question.

const FILTERS = [
  { key: "all", label: "Everything", match: () => true },
  { key: "used", label: "Used", match: (r) => OUTCOMES[r.outcome].used },
  { key: "held", label: "Held", match: (r) => r.outcome === "held" },
  { key: "not-used", label: "Not used", match: (r) => r.outcome === "rejected" },
];

const RANGES = [7, 30, 90];

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const gbp = (usd, rate) => (usd == null ? "—" : `£${(usd * rate).toFixed(2)}`);
const pence = (usd, rate) => (usd == null ? "—" : `${Math.round(usd * rate * 100)}p`);

/** A filter/range/title pill that keeps the other two settings. */
function Pill({ params, set, children }) {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(set)) {
    if (v == null) next.delete(k);
    else next.set(k, String(v));
  }
  const active = Object.entries(set).every(([k, v]) => (params.get(k) || null) === (v == null ? null : String(v)));
  const qs = next.toString();
  return (
    <Link
      href={qs ? `/press?${qs}` : "/press"}
      className={`fleet-nav-btn${active ? " is-active" : ""}`}
      style={{ fontSize: 12.5 }}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, hint, tone }) {
  return (
    <div>
      <div className="stat-value" style={{ fontSize: 24, color: tone }}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="micro" style={{ color: "var(--muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default async function PressPage({ searchParams }) {
  const sp = await searchParams;
  const params = new URLSearchParams(
    Object.entries(sp || {}).flatMap(([k, v]) => (v == null ? [] : [[k, Array.isArray(v) ? v[0] : v]]))
  );
  const days = RANGES.includes(Number(params.get("days"))) ? Number(params.get("days")) : 30;
  const show = FILTERS.find((f) => f.key === params.get("show"))?.key || "all";
  const titleSlug = params.get("title") || null;

  const [board, mode] = await Promise.all([pressBoard({ days, titleSlug }), replyMode()]);
  const { rows, totals, byTitle, lastRunAt } = board;
  const rate = DEFAULT_USD_TO_GBP;
  const shown = rows.filter(FILTERS.find((f) => f.key === show).match);

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Press releases</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <section className="panel panel-glow stagger" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Every press@ box, last {days} days</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 620 }}>
                What arrived at the ten press desks, what went up, and what did not. Anything the
                desk turned down can be overruled here: pushing it rewrites the release, puts it on
                the site and thanks the sender.
              </p>
              <p className="micro" style={{ color: "var(--muted)", marginTop: 8 }}>
                Last desk run {fmt(lastRunAt)}. It ticks every fifteen minutes, around the clock.
              </p>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat label="Received" value={totals.received} />
              <Stat label="Published" value={totals.live} tone="var(--neon-green)" />
              <Stat label="Scheduled" value={totals.scheduled} />
              <Stat label="Held" value={totals.held} tone={totals.held ? "var(--neon-amber)" : undefined} />
              <Stat label="Not used" value={totals.rejected} />
              <Stat
                label="Cost"
                value={gbp(totals.spendUsd, rate)}
                hint={totals.perUsedUsd ? `${pence(totals.perUsedUsd, rate)} per piece used, sorting the rest included` : null}
              />
            </div>
          </div>

          {/* The reply switch, because this page offers to email people back and
              the fleet default is not to. */}
          <p
            className="micro"
            style={{
              margin: "14px 0 0",
              padding: "8px 12px",
              borderRadius: 8,
              background: mode === "send" ? "rgba(5,150,105,.12)" : "rgba(217,119,6,.12)",
              color: mode === "send" ? "var(--neon-green)" : "var(--neon-amber)",
            }}
          >
            Sender replies: <strong>{mode}</strong>. {REPLY_MODE_NOTE[mode]}
            {mode !== "send" && " Set the global setting press_link_ask to send to change that."}
          </p>
        </section>

        {/* By title. A title with nothing coming in is a list Lucas has not
            subscribed it to, which is invisible from anywhere else. */}
        <section className="panel stagger" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>By title</h2>
            <span className="micro" style={{ color: "var(--muted)" }}>received · published · not used</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill params={params} set={{ title: null }}>All titles</Pill>
            {byTitle.map((t) => (
              <Pill key={t.slug} params={params} set={{ title: t.slug }}>
                {t.name} <span style={{ opacity: 0.55 }}>{t.received} · {t.live} · {t.rejected}</span>
              </Pill>
            ))}
          </div>
        </section>

        <section className="panel stagger">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <Pill key={f.key} params={params} set={{ show: f.key === "all" ? null : f.key }}>
                {f.label} <span style={{ opacity: 0.55 }}>{rows.filter(f.match).length}</span>
              </Pill>
            ))}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {RANGES.map((d) => (
                <Pill key={d} params={params} set={{ days: d === 30 ? null : d }}>{d} days</Pill>
              ))}
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
              Nothing here in this window.
            </p>
          ) : (
            <Scroller>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "6px 10px 6px 0", fontWeight: 500 }}>Received</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>Title</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>Release</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }}>Outcome</th>
                    <th style={{ padding: "6px 10px", fontWeight: 500 }} />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }}>
                      <td style={{ padding: "10px 10px 10px 0", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {fmt(r.receivedAt)}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{ width: 8, height: 8, borderRadius: "50%", background: r.siteAccent || "var(--muted)" }}
                          />
                          {r.siteName}
                        </span>
                      </td>
                      <td style={{ padding: "10px", maxWidth: 460 }}>
                        <strong style={{ fontWeight: 600 }}>{r.subject}</strong>
                        <div className="micro" style={{ color: "var(--muted)", marginTop: 2 }}>
                          {r.fromName || r.fromEmail ? (
                            <>from {r.fromName || r.fromEmail}{r.fromName && r.fromEmail ? ` <${r.fromEmail}>` : ""}</>
                          ) : (
                            <span style={{ opacity: 0.6 }}>sender not recorded</span>
                          )}
                          {r.company && <> · {r.company}</>}
                        </div>
                        {r.reason && (
                          <div className="micro" style={{ color: "var(--muted)", marginTop: 4, opacity: 0.85 }}>
                            {r.reason}
                          </div>
                        )}
                        {r.photo && (
                          <div className="micro" style={{ color: "var(--muted)", marginTop: 4, opacity: 0.6 }}>
                            photo: {r.photo}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                        <span className={`chip ${OUTCOMES[r.outcome].chip}`}>{OUTCOMES[r.outcome].label}</span>
                        {r.goLiveAt && (
                          <div className="micro" style={{ color: "var(--muted)", marginTop: 4 }}>
                            live {fmt(r.goLiveAt)}
                          </div>
                        )}
                        {r.costUsd != null && (
                          <div className="micro" style={{ color: "var(--muted)", marginTop: 4, opacity: 0.6 }}>
                            {pence(r.costUsd, rate)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        {r.pushing ? (
                          // Someone has already pressed it and the desk is
                          // writing. No button: a second click would pay to
                          // write the same release twice.
                          <span className="micro" style={{ color: "var(--neon-cyan)" }}>
                            Writing it up… started {fmt(r.pushing)}
                          </span>
                        ) : r.articleUrl ? (
                          <a
                            href={r.articleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            View article ↗
                          </a>
                        ) : r.outcome === "scheduled" ? (
                          <span className="micro" style={{ color: "var(--muted)" }}>waiting on the embargo</span>
                        ) : r.outcome === "pending" && !r.stuck ? (
                          <span className="micro" style={{ color: "var(--muted)" }}>the desk has it</span>
                        ) : (
                          <PressPush
                            id={r.id}
                            subject={r.subject}
                            stale={r.stale}
                            // The unclear-embargo hold is the one a person, and
                            // only a person, can answer. The row knows which
                            // holds those are, so the second click is a
                            // differently-worded button rather than client state.
                            force={r.needsForce}
                            label={
                              r.needsForce ? "Embargo checked — publish now"
                              : r.outcome === "pending" ? "Stuck — run it again"
                              : r.outcome === "held" ? "Push it live"
                              : "Use it anyway"
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          )}

          <p className="micro" style={{ color: "var(--muted)", marginTop: 14, maxWidth: 720 }}>
            A push overrules the selection — relevance, news value, and whether another title already
            has the story. It does not overrule the checks that every quote is the sender&rsquo;s own
            words and every figure is in the release, so a piece can still come back held. Releases
            the desk has never looked at are not here: they are still sitting in Gmail under
            Topics/Press.
          </p>
        </section>
      </div>
    </main>
  );
}
