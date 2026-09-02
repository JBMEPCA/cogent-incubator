import Header from "@/app/components/Header";
import SubTabs, { CONTENT_TABS } from "@/app/components/SubTabs";
import { notFound } from "next/navigation";
import { getSiteContext } from "@/lib/site";
import { interviewStats, interviewSetupHint, STATUS_LABEL, EMAIL_SOURCES } from "@/lib/interviews";

export const dynamic = "force-dynamic";

const STATUS_CHIP = {
  pending: "chip-general",
  asked: "chip-content",
  agreed: "chip-brand",
  questioned: "chip-content",
  answered: "chip-audience",
  drafted: "chip-brand",
  published: "chip-audience",
  declined: "chip-general",
  exhausted: "chip-monetise",
  bounced: "chip-monetise",
  failed: "chip-monetise",
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  // Stored UTC, read by people in the UK. Converting here rather than at the
  // database is the only place it can be done once for every row on the page.
  return new Date(d).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InterviewsPage({ params }) {
  const { slug } = await params;
  const ctx = await getSiteContext(slug);
  if (!ctx) notFound();
  const { site, db, creds } = ctx;

  const [targets, stats] = await Promise.all([
    db.interviewTarget.findMany({
      orderBy: [{ askedAt: "desc" }, { createdAt: "desc" }],
      include: { article: { select: { id: true, title: true, status: true } } },
      take: 200,
    }),
    interviewStats(db, site.id),
  ]);

  const hint = interviewSetupHint(creds);

  // Replies are the whole point of the page, so they sit at the top rather
  // than being hunted for in a status column further down.
  const replies = targets.filter((t) => ["agreed", "answered", "drafted"].includes(t.status));
  const live = targets.filter((t) => ["asked", "questioned"].includes(t.status));
  const done = targets.filter((t) => ["published", "declined", "exhausted", "bounced", "failed"].includes(t.status));
  const queued = targets.filter((t) => t.status === "pending");

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "28px clamp(14px, 4vw, 24px)" }}>
        <SubTabs items={CONTENT_TABS} active="/interviews" />

        <section className="panel panel-glow stagger" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Interviews</h1>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 6px", maxWidth: 640 }}>
                Named people, a face on the article, and a subject who shares it. Outreach is two
                steps: a short note asking if we may send questions, then the questions once they
                say yes. Both send themselves.
              </p>
              {hint && (
                <p className="micro" style={{ color: "var(--neon-amber)", margin: "0 0 10px" }}>
                  {hint}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Queued", value: stats.pending },
                { label: "Asked", value: stats.asked },
                { label: "Said yes", value: stats.agreed },
                { label: "Answers in", value: stats.answered },
                { label: "Published", value: stats.published },
                { label: "Reply rate", value: stats.replyRate == null ? "—" : `${stats.replyRate}%` },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Replies */}
        <section className="panel stagger" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Replies</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px", maxWidth: 720 }}>
            Everyone who has written back. A yes moves itself on to the questions after a short,
            randomised wait inside working hours, so nothing here needs chasing by hand.
          </p>
          {replies.length === 0 ? (
            <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
              No replies yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {replies.map((t) => (
                <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{t.personName}</strong>
                    <span className="micro" style={{ color: "var(--muted)" }}>
                      {t.personRole ? `${t.personRole}, ` : ""}{t.company}
                    </span>
                    <span className={`chip ${STATUS_CHIP[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </div>
                  {t.replyBody && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
                      {t.replyBody.slice(0, 1200)}
                    </p>
                  )}
                  <div className="micro" style={{ color: "var(--muted)", marginTop: 10 }}>
                    Asked {fmtDate(t.askedAt)} · replied {fmtDate(t.agreedAt)}
                    {t.questionsSentAt ? ` · questions sent ${fmtDateTime(t.questionsSentAt)}` : ""}
                    {t.headshotUrl ? " · headshot received" : " · no headshot yet"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Awaiting a reply */}
        <section className="panel stagger" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Waiting to hear back</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px", maxWidth: 720 }}>
            One chase goes out seven days after the first note, and there is never a third email.
          </p>
          <PeopleTable rows={live} />
        </section>

        {/* Queue */}
        {queued.length > 0 && (
          <section className="panel stagger" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Queued</h2>
            <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px", maxWidth: 720 }}>
              Researched and written, waiting for the next send window.
            </p>
            <PeopleTable rows={queued} />
          </section>
        )}

        {/* Closed */}
        <section className="panel stagger">
          <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Closed</h2>
          <p className="micro" style={{ color: "var(--muted)", margin: "0 0 14px", maxWidth: 720 }}>
            Published, declined, or nobody home. &ldquo;No address found&rdquo; means every address
            we tried bounced, which is not the same as a no: they never saw it.
          </p>
          <PeopleTable rows={done} showPublished />
        </section>
      </main>
    </>
  );
}

function PeopleTable({ rows, showPublished }) {
  if (!rows.length) {
    return (
      <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
        Nothing here yet.
      </p>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            <th style={{ padding: "6px 10px 6px 0", fontWeight: 500 }}>Person</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Company</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Sent to</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Asked</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Status</th>
            {showPublished && <th style={{ padding: "6px 10px", fontWeight: 500 }}>Article</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 10px 8px 0" }}>
                <strong>{t.personName}</strong>
                {t.personRole && (
                  <div className="micro" style={{ color: "var(--muted)" }}>{t.personRole}</div>
                )}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{t.company}</td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                {t.email || "—"}
                {t.emailSource && (
                  <div className="micro" style={{ color: "var(--muted)", opacity: 0.75 }}>
                    {EMAIL_SOURCES[t.emailSource] || t.emailSource}
                  </div>
                )}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{fmtDateTime(t.askedAt)}</td>
              <td style={{ padding: "8px 10px" }}>
                <span className={`chip ${STATUS_CHIP[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                {t.error && (
                  <div className="micro" style={{ color: "var(--neon-amber)", marginTop: 4 }}>{t.error}</div>
                )}
              </td>
              {showPublished && (
                <td style={{ padding: "8px 10px" }}>
                  {t.publishedUrl ? (
                    <a href={t.publishedUrl} target="_blank" rel="noreferrer" style={{ color: "var(--neon-cyan)" }}>
                      {t.article?.title || "Read"}
                    </a>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                  {/* Telling the subject is the step that earns the link, so a
                      published piece nobody has been told about is flagged. */}
                  {t.status === "published" && !t.notifiedAt && (
                    <div className="micro" style={{ color: "var(--neon-amber)" }}>subject not told yet</div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
