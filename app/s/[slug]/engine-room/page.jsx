import Header from "@/app/components/Header";
import AgentOffice from "@/app/components/AgentOffice";
import SuggestionBox from "@/app/components/SuggestionBox";
import SubTabs, { ENGINE_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { ensureAgents } from "@/lib/agents/runtime";
import { spendWindow } from "@/lib/agents/costs";
import { withinOfficeHours } from "@/lib/site";
import { newsletterStatus } from "@/lib/newsletter";
import { prospectStats } from "@/lib/prospects";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "13px 15px", borderRadius: 12, background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 3 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function since(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function Card({ title, children, empty }) {
  return (
    <section style={{ background: "var(--surface, #10182b)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{title}</h3>
      {children || <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>{empty}</p>}
    </section>
  );
}

const AGENT_NAMES = {
  director: "Director",
  researcher: "Researcher",
  seo: "SEO Expert",
  editor: "Editor",
  designer: "Graphic Designer",
  finance: "Finance Manager",
  linkedin: "LinkedIn Manager",
  backlink: "Backlink Manager",
  newsletter: "Newsletter Manager",
};

function pct(v) {
  return v == null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}

export default async function EngineRoomPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;
  const siteRef = { id: site.id, slug: site.slug };
  const hoursLabel = `${site.officeHoursStart}:00–${site.officeHoursEnd}:00 UK`;

  await ensureAgents(site.id);
  const weekAgo = new Date(Date.now() - 7 * 864e5);

  const [agents, topics, messages, spend, pipeline, publishedWeek, suggestions, recent, week, newsletter, drip] = await Promise.all([
    db.agent.findMany(),
    db.researchTopic.findMany({
      // JB's own requests have their own panel, so this is what the Researcher found.
      where: { status: "proposed", source: { not: "jb" } },
      orderBy: [{ score: "desc" }],
      take: 10,
    }),
    db.agentMessage.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.agentRun.groupBy({
      by: ["agentKey"],
      where: { startedAt: { gte: weekAgo } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    db.article.groupBy({ by: ["status"], _count: true }),
    db.article.count({ where: { publishedAt: { gte: weekAgo } } }),
    db.researchTopic.findMany({
      where: { source: "jb" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.article.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: { id: true, title: true, publishedAt: true, wpPostId: true, type: true, seoScore: true, status: true },
    }),
    spendWindow(site.id, 7),
    // Mailchimp being down must never blank the Engine Room.
    newsletterStatus(site.id, creds.mailchimp).catch((e) => ({ configured: true, error: e.message })),
    prospectStats(site.id).catch(() => null),
  ]);

  // What became of each request. Matched on title, which is what the Director
  // carries across when it commissions one.
  const suggestedArticles = suggestions.length
    ? await db.article.findMany({
        where: { title: { in: suggestions.map((s) => s.title) } },
        select: { title: true, status: true, wpPostId: true },
      })
    : [];

  const totalCost = spend.reduce((s, r) => s + (r._sum.costUsd || 0), 0);
  const busy = agents.filter((a) => a.state === "working").length;
  const blocked = agents.filter((a) => a.state === "blocked").length;
  // A run lasts under a minute and the tick is hourly, so a count of agents
  // mid-run reads 0 almost all the time and says nothing. Time since the last
  // run is the number that actually shows whether the engine has stalled.
  const lastActive = agents.reduce((t, a) => (a.lastRunAt && (!t || a.lastRunAt > t) ? a.lastRunAt : t), null);
  const byStatus = Object.fromEntries(pipeline.map((p) => [p.status, p._count]));

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px" }}>
        <SubTabs items={ENGINE_TABS} active="/engine-room" />
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: "0 0 5px", fontSize: 25 }}>Engine Room</h1>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.7, maxWidth: 760, lineHeight: 1.55 }}>
            Nine agents, each with a single goal, woken by events rather than a clock. Everything routes through the
            Director, who settles the conflicts between them. Click any desk to see what that agent is working on
            right now, what it has just done, and what it cost.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, opacity: 0.6 }}>
            {withinOfficeHours(site) ? (
              <>
                <span style={{ color: "#059669", fontWeight: 600 }}>On shift</span> · the team works{" "}
                {hoursLabel} and sleeps outside those hours
              </>
            ) : (
              <>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Off shift</span> · the team works{" "}
                {hoursLabel}. Waking an agent from a desk still works.
              </>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <Stat
            label="Team"
            value={busy ? `${busy} working` : blocked ? `${blocked} blocked` : "All asleep"}
            hint={
              blocked && busy
                ? `${blocked} blocked`
                : lastActive
                  ? `last active ${since(lastActive)}`
                  : "never run"
            }
          />
          <Stat label="Topics queued" value={topics.length} hint="found by the Researcher" />
          <Stat label="In production" value={(byStatus.drafting || 0) + (byStatus.review || 0)} hint={`${byStatus.published || 0} published all time`} />
          <Stat label="Published, 7d" value={publishedWeek} />
          {/* Agent runs plus what the batch publisher recorded against each
              article. Per article is quoted only over articles whose cost was
              actually measured, because the old average divided agent-only
              spend by every published article and reported 1p against a real
              figure of roughly 16p. */}
          <Stat
            label="Spend, 7d"
            value={`$${week.total.toFixed(2)}`}
            hint={
              week.perArticle != null
                ? `$${week.perArticle.toFixed(2)} per article${week.unmeasuredCount ? ` · ${week.unmeasuredCount} unmeasured` : ""}`
                : week.publishedCount
                  ? `${week.publishedCount} articles, cost not recorded`
                  : `${week.runs} runs`
            }
          />
        </div>

        <AgentOffice />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginTop: 20 }}>
          <SuggestionBox suggestions={suggestions} articles={suggestedArticles} />

          <Card title="Published recently" empty="Nothing published yet.">
            {recent.length > 0 && (
              <div>
                {recent.map((a) => {
                  const when = new Date(a.publishedAt);
                  const today = when.toDateString() === new Date().toDateString();
                  return (
                    <div key={a.id} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                      <a
                        href={a.wpPostId ? `https://smartsme.co.uk/?p=${a.wpPostId}` : `/content/article/${a.id}`}
                        target={a.wpPostId ? "_blank" : undefined}
                        rel="noreferrer"
                        style={{ fontSize: 13.5, lineHeight: 1.4, color: "inherit", textDecoration: "none" }}
                      >
                        {a.title}
                      </a>
                      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>
                        {today ? (
                          <span style={{ color: "#059669", fontWeight: 700 }}>
                            Today {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : (
                          when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        )}
                        {" · "}
                        {a.type === "pr_rewrite" ? "PR" : "SEO"}
                        {a.seoScore != null && ` · score ${a.seoScore}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Newsletter" empty="Mailchimp is not connected yet.">
            {newsletter?.configured && (
              <div>
                {newsletter.error ? (
                  <p style={{ fontSize: 12.5, color: "#dc2626", margin: 0, lineHeight: 1.45 }}>
                    Could not reach Mailchimp: {newsletter.error}
                  </p>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "0 0 10px" }}>
                      <span style={{ opacity: 0.7 }}>{newsletter.audience}</span>
                      <span style={{ fontWeight: 700 }}>{newsletter.members.toLocaleString()} subscribers</span>
                    </div>

                    {!newsletter.enabled && (
                      <div style={{ fontSize: 12, color: "#d97706", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        Paused. NEWSLETTER_ENABLED is set to false.
                      </div>
                    )}

                    {/* Either of these silently drops imported contacts from every
                        send, so they are surfaced rather than left to be found. */}
                    {newsletter.gdprPermissions && (
                      <div style={{ fontSize: 12, color: "#d97706", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.06)", lineHeight: 1.45 }}>
                        GDPR marketing permissions are on. Contacts without the email permission ticked receive nothing,
                        whatever their status says.
                      </div>
                    )}
                    {newsletter.doubleOptIn && (
                      <div style={{ fontSize: 12, color: "#d97706", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.06)", lineHeight: 1.45 }}>
                        Double opt-in is on. Imports that do not set an explicit status land as pending and never send.
                      </div>
                    )}

                    {newsletter.last ? (
                      <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 3 }}>
                          Last issue · {new Date(newsletter.last.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {" · "}
                          {newsletter.last.sent.toLocaleString()} sent
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{newsletter.last.subject}</div>
                        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 5 }}>
                          {pct(newsletter.last.openRate)} opens · {pct(newsletter.last.clickRate)} clicks ·{" "}
                          <span style={{ color: newsletter.last.bounces / Math.max(newsletter.last.sent, 1) > 0.02 ? "#dc2626" : "inherit" }}>
                            {newsletter.last.bounces} bounced
                          </span>
                          {newsletter.last.complaints > 0 && ` · ${newsletter.last.complaints} complaints`}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12.5, opacity: 0.5, margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        No issue sent yet. The Newsletter Manager runs Thursday mornings.
                      </p>
                    )}

                    {drip && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>
                          Subscriber drip · {drip.weeksRemaining} week{drip.weeksRemaining === 1 ? "" : "s"} of list remaining
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${(drip.imported / drip.total) * 100}%`, background: "#059669" }} title="imported" />
                          <div style={{ width: `${(drip.readyToImport / drip.total) * 100}%`, background: "#2E3EEE" }} title="verified, waiting" />
                          <div style={{ width: `${(drip.suppressed / drip.total) * 100}%`, background: "#dc2626" }} title="suppressed" />
                        </div>
                        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.5 }}>
                          {drip.imported.toLocaleString()} imported ·{" "}
                          {drip.readyToImport.toLocaleString()} verified and waiting ·{" "}
                          {drip.awaitingVerification.toLocaleString()} to check ·{" "}
                          <span style={{ color: "#dc2626" }}>{drip.suppressed.toLocaleString()} rejected</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>

          <Card title="Research pipeline" empty="No topics proposed yet. Wake the Researcher to find some.">
            {topics.length > 0 && (
              <div>
                {topics.map((t) => (
                  <div key={t.id} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{t.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>
                      {t.source}
                      {t.score != null && ` · score ${t.score}`}
                      {t.impressions != null && ` · ${t.impressions} impressions`}
                      {t.position != null && ` · position ${t.position.toFixed(1)}`}
                    </div>
                    {t.rationale && <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 3, lineHeight: 1.4 }}>{t.rationale}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Team traffic" empty="No messages between agents yet.">
            {messages.length > 0 && (
              <div>
                {messages.map((m) => (
                  <div key={m.id} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>
                      {AGENT_NAMES[m.fromKey] || m.fromKey} → {AGENT_NAMES[m.toKey] || m.toKey} · {m.kind}
                      {m.resolved && " · resolved"}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.4, marginTop: 2 }}>{m.subject}</div>
                    {m.body && <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 3, lineHeight: 1.4 }}>{m.body.slice(0, 220)}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Spend by agent, 7 days" empty="No runs recorded yet.">
            {spend.length > 0 && (
              <div>
                {[...spend]
                  .sort((a, b) => (b._sum.costUsd || 0) - (a._sum.costUsd || 0))
                  .map((r) => {
                    const cost = r._sum.costUsd || 0;
                    const pct = totalCost ? (cost / totalCost) * 100 : 0;
                    return (
                      <div key={r.agentKey} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span>{AGENT_NAMES[r.agentKey] || r.agentKey}</span>
                          <span style={{ fontWeight: 600 }}>${cost.toFixed(3)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 5, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#2E3EEE" }} />
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 3 }}>
                          {r._count} run{r._count === 1 ? "" : "s"} ·{" "}
                          {((r._sum.inputTokens || 0) + (r._sum.outputTokens || 0)).toLocaleString()} tokens
                        </div>
                      </div>
                    );
                  })}
                <p style={{ fontSize: 11.5, opacity: 0.5, margin: "10px 0 0", lineHeight: 1.45 }}>
                  The Finance Manager reports these figures but never blocks work, by design.
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
