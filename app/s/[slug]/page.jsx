import Link from "next/link";
import Header from "@/app/components/Header";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { addTodo, toggleTodo, deleteTodo } from "@/lib/actions";
import { launchProgress } from "@/lib/milestones";
import { buildCostReport } from "@/lib/agents/costs";
import { withinOfficeHours } from "@/lib/site";
import { fmtMoney } from "@/lib/crm";

export const dynamic = "force-dynamic";

const AGENT_NAMES = {
  director: "Director", researcher: "Researcher", seo: "SEO Expert", editor: "Editor",
  designer: "Graphic Designer", finance: "Finance Manager", linkedin: "LinkedIn Manager",
};

function timeAgo(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ---------------------------------------------------------------- widgets */

function Widget({ title, href, cta, children }) {
  return (
    <section className="panel widget" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, letterSpacing: ".01em" }}>{title}</h2>
        {href && (
          <Link href={href} className="widget-link" style={{ marginLeft: "auto", fontSize: 11.5 }}>
            {cta || "Open"} →
          </Link>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
    </section>
  );
}

function Figure({ value, label, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: tone || "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Bar({ value, max, tone }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: tone || "var(--neon-cyan)", transition: "width .5s ease" }} />
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default async function Dashboard({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  // Bound into every server action on this page. Next signs bound arguments,
  // so this cannot be re-pointed at another title from the browser.
  const siteRef = { id: site.id, slug: site.slug };

  const weekAgo = new Date(Date.now() - 7 * 864e5);

  const [todos, progress, costs, agents, articles, topics, linkedIn, seoPending, publishedWeek, nextUp, leadRows] =
    await Promise.all([
      db.todo.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "asc" }] }),
      launchProgress(site.id, { hasWordPress: Boolean(creds.wordpress?.url) }),
      buildCostReport(site.id),
      db.agent.findMany(),
      db.article.groupBy({ by: ["status"], _count: true }),
      db.researchTopic.findMany({ where: { status: "proposed" }, orderBy: { score: "desc" }, take: 3 }),
      db.linkedInPost.count({ where: { status: "draft" } }),
      db.seoSuggestion.count({ where: { status: "pending" } }),
      db.article.count({ where: { publishedAt: { gte: weekAgo } } }),
      db.article.findFirst({
        where: { scheduledFor: { gte: new Date() } },
        orderBy: { scheduledFor: "asc" },
        select: { title: true, scheduledFor: true },
      }),
      db.lead.findMany({ select: { stage: true, offerValue: true, perMonth: true } }),
    ]);

  const openTodos = todos.filter((t) => !t.done);
  const byStatus = Object.fromEntries(articles.map((a) => [a.status, a._count]));
  const working = agents.filter((a) => a.state === "working");
  const blocked = agents.filter((a) => a.state === "blocked");
  const onShift = withinOfficeHours(site);
  const lastActive = agents.map((a) => a.lastRunAt).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];

  // Deals are quoted either per month or as a one-off, so annualise the monthly
  // ones rather than adding a £350/mo banner to a £500 one-off as if they match.
  const dealValue = (l) => (l.offerValue || 0) * (l.perMonth ? 12 : 1);
  const pipelineValue = leadRows.filter((l) => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + dealValue(l), 0);
  const wonValue = leadRows.filter((l) => l.stage === "won").reduce((s, l) => s + dealValue(l), 0);

  const budgetPct = costs.targetGbp ? Math.round((costs.totalMonthlyGbp / costs.targetGbp) * 100) : 0;
  const budgetTone = budgetPct >= 100 ? "#d03b3b" : budgetPct >= 80 ? "#fab219" : "#0ca30c";

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 40px" }}>
        <style>{`
          .widget { transition: transform .25s ease, border-color .25s ease; }
          .widget:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.16); }
          .widget-link { opacity: .6; transition: opacity .2s ease; white-space: nowrap; }
          .widget:hover .widget-link { opacity: 1; }
          .dash-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); }
          .phase-row { display: flex; align-items: center; gap: 9px; padding: 4px 0; font-size: 12.5px; }
          @media (prefers-reduced-motion: reduce) {
            .widget, .widget-link { transition: none }
            .widget:hover { transform: none }
          }
        `}</style>

        {/* What the operation is doing right now. */}
        <section className="panel" style={{ padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", opacity: 0.5 }}>
                Launch progress
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>
                {progress.done}
                <span style={{ opacity: 0.4, fontSize: 20 }}>/{progress.total}</span>
              </div>
              <div style={{ marginTop: 7, width: 170 }}>
                <Bar value={progress.done} max={progress.total} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 24, flex: 1, flexWrap: "wrap" }}>
              <Figure value={progress.stats.published} label="articles live" />
              <Figure value={publishedWeek} label="published this week" />
              <Figure value={progress.stats.backlog} label="written or queued" />
              <Figure
                value={
                  blocked.length ? `${blocked.length} blocked`
                    : working.length ? `${working.length} working`
                    : onShift ? "idle" : "asleep"
                }
                label={onShift ? "AI team, on shift" : `AI team, ${site.officeHoursStart}:00–${site.officeHoursEnd}:00`}
                tone={blocked.length ? "#d03b3b" : working.length ? "#0ca30c" : undefined}
              />
              <Figure value={`£${costs.totalMonthlyGbp.toFixed(0)}`} label={`of £${costs.targetGbp} budget`} tone={budgetTone} />
            </div>
          </div>
        </section>

        <div className="dash-grid">
          <Widget title="Content engine" href="/content" cta="Content">
            <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
              <Figure value={byStatus.published || 0} label="published" />
              <Figure value={(byStatus.drafting || 0) + (byStatus.review || 0)} label="in production" />
              <Figure value={byStatus.approved || 0} label="ready" />
            </div>
            {nextUp ? (
              <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.45, marginTop: "auto" }}>
                Next out: <strong>{nextUp.title.slice(0, 44)}</strong>
                <br />
                {new Date(nextUp.scheduledFor).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: "auto" }}>Nothing scheduled yet.</div>
            )}
          </Widget>

          <Widget title="Engine Room" href="/engine-room" cta="The team">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {agents.slice(0, 4).map((a) => {
                const state = !onShift && a.state !== "working" ? "asleep" : a.state;
                const tone = { working: "#0ca30c", blocked: "#d03b3b", asleep: "#7c89a6", idle: "#94a3b8" }[state] || "#94a3b8";
                return (
                  <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{AGENT_NAMES[a.key] || a.key}</span>
                    <span style={{ opacity: 0.5, fontSize: 11 }}>{state}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: "auto" }}>
              {agents.length} agents · last active {timeAgo(lastActive)}
            </div>
          </Widget>

          <Widget title="Costs" href="/engine-room/costs" cta="Breakdown">
            <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
              <Figure value={`£${costs.totalMonthlyGbp.toFixed(2)}`} label="projected / month" tone={budgetTone} />
              <Figure
                value={costs.perArticle ? `${(costs.perArticle * costs.rate * 100).toFixed(1)}p` : "—"}
                label="per article"
              />
            </div>
            <Bar value={costs.totalMonthlyGbp} max={costs.targetGbp} tone={budgetTone} />
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8 }}>
              {budgetPct}% of the £{costs.targetGbp} target
              {costs.daysLive < 7 && " · early estimate"}
            </div>
          </Widget>

          <Widget title="Research pipeline" href="/engine-room" cta="Researcher">
            {topics.length === 0 && <div style={{ fontSize: 12.5, opacity: 0.5 }}>No topics queued.</div>}
            {topics.map((t) => (
              <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>{t.title.slice(0, 60)}</div>
                <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 2 }}>
                  {t.source}
                  {t.score != null && ` · score ${t.score}`}
                </div>
              </div>
            ))}
          </Widget>

          {/* The only items the agents genuinely cannot action themselves. */}
          <Widget title="Waiting on you" href={linkedIn ? "/linkedin" : "/seo"} cta="Review">
            <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
              <Figure value={linkedIn} label="LinkedIn posts" tone={linkedIn ? "#fab219" : undefined} />
              <Figure value={seoPending} label="SEO suggestions" tone={seoPending ? "#fab219" : undefined} />
              <Figure value={openTodos.length} label="to-dos" />
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: "auto", lineHeight: 1.45 }}>
              {linkedIn + seoPending === 0
                ? "Nothing needs your approval right now."
                : "These are the only items the agents cannot action themselves."}
            </div>
          </Widget>

          <Widget title="Commercial" href="/crm" cta="CRM">
            <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
              <Figure value={fmtMoney(pipelineValue)} label="open pipeline" />
              <Figure value={fmtMoney(wonValue)} label="won" />
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: "auto", lineHeight: 1.45 }}>
              {leadRows.length === 0
                ? `No leads yet. ${progress.stats.advertisers} advertiser prospects researched and ready to promote.`
                : `${leadRows.length} leads · ${progress.stats.advertisers} prospects researched`}
            </div>
          </Widget>
        </div>

        <section className="panel" style={{ padding: 18, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 14 }}>Launch phases</h2>
            <span style={{ fontSize: 11.5, opacity: 0.5 }}>ticked from live data, not by hand. Hover any line for the evidence.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 12 }}>
            {progress.byPhase.map((p) => (
              <div key={p.key}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 12.5 }}>{p.label}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, opacity: 0.55 }}>{p.done}/{p.total}</span>
                </div>
                <Bar value={p.done} max={p.total} tone={p.done === p.total ? "#0ca30c" : undefined} />
                <div style={{ marginTop: 7 }}>
                  {p.items.map((i) => (
                    <div key={i.label} className="phase-row" title={i.evidence}>
                      <span style={{ color: i.done ? "#0ca30c" : "rgba(255,255,255,.28)", fontWeight: 700, width: 12 }}>
                        {i.done ? "✓" : "○"}
                      </span>
                      <span style={{ opacity: i.done ? 0.85 : 0.55 }}>{i.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ padding: 18, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 14 }}>To-dos</h2>
            <span style={{ fontSize: 11.5, opacity: 0.5 }}>{openTodos.length ? `${openTodos.length} open` : "all clear"}</span>
          </div>

          <form action={addTodo.bind(null, siteRef)} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              name="title"
              placeholder="Something only you can do…"
              required
              style={{ flex: 1, padding: "8px 11px", borderRadius: 9, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "inherit", fontSize: 13 }}
            />
            <input type="hidden" name="phase" value="general" />
            <button type="submit" className="btn" style={{ padding: "8px 18px" }}>Add</button>
          </form>

          {openTodos.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, margin: 0 }}>Nothing outstanding.</p>}
          {openTodos.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <form action={toggleTodo.bind(null, siteRef)} style={{ display: "flex" }}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="btn-ghost" style={{ padding: "2px 8px" }} aria-label="Mark done">○</button>
              </form>
              <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
              <form action={deleteTodo.bind(null, siteRef)} style={{ display: "flex" }}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="btn-ghost" style={{ padding: "2px 8px", opacity: 0.5 }} aria-label="Delete">×</button>
              </form>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
