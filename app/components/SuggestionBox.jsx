import { suggestTopic, withdrawSuggestion, wakeDirectorNow } from "@/lib/actions";

// JB's own content ideas, handed to the team. These are not treated as
// suggestions in the polite sense: the Director commissions them ahead of
// everything the Researcher found, ignores the backlog guard, and cannot strike
// them out. The Editor writes anything carrying a brief before the rest of the
// queue, so a request does not join the back of a fortnight's work.

const label = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.55, marginBottom: 5 };
const field = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.05)",
  color: "inherit",
  fontSize: 13.5,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const btn = {
  padding: "9px 14px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.05)",
  color: "inherit",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const STATE = {
  proposed: { text: "Waiting for the Director", colour: "#94a3b8" },
  commissioned: { text: "Commissioned, being written", colour: "#059669" },
  rejected: { text: "Struck out", colour: "#dc2626" },
};

export default function SuggestionBox({ suggestions = [], articles = [] }) {
  const byTitle = new Map(articles.map((a) => [a.title, a]));

  return (
    <section
      style={{
        background: "var(--surface, #10182b)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 14,
        padding: 16,
        gridColumn: "1 / -1",
      }}
    >
      <h3 style={{ margin: "0 0 3px", fontSize: 15 }}>Suggestion box</h3>
      <p style={{ margin: "0 0 13px", fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, maxWidth: 620 }}>
        Anything you put here goes to the front of the queue. The Director commissions it ahead of whatever the
        Researcher has found, and the Editor writes it before the rest of the backlog.
      </p>

      <form action={suggestTopic} style={{ display: "grid", gap: 10, maxWidth: 620 }}>
        <div>
          <div style={label}>Title or topic</div>
          <input
            name="title"
            required
            maxLength={300}
            placeholder="Fable 5 vs Opus 5: which Claude model should an SME actually use?"
            style={field}
          />
        </div>
        <div>
          <div style={label}>Brief — optional, but it is what the writer follows</div>
          <textarea
            name="brief"
            rows={3}
            placeholder="Compare on cost per task, speed and quality. Aim it at a non-technical owner deciding what to put in their business. Include a table and real £ pricing."
            style={{ ...field, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
        <div>
          <button type="submit" style={{ ...btn, background: "#2E3EEE", borderColor: "#2E3EEE" }}>
            Send it to the team
          </button>
        </div>
      </form>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Your requests</span>
            <form action={wakeDirectorNow}>
              <button
                type="submit"
                style={{ ...btn, padding: "5px 10px", fontSize: 11.5, textTransform: "none", letterSpacing: 0 }}
              >
                Wake the Director now
              </button>
            </form>
          </div>
          {suggestions.map((s) => {
            const st = STATE[s.status] || { text: s.status, colour: "#94a3b8" };
            const article = byTitle.get(s.title);
            return (
              <div
                key={s.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,.06)",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{s.title}</div>
                  {s.query && (
                    <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 3, lineHeight: 1.45 }}>{s.query}</div>
                  )}
                  <div style={{ fontSize: 11, marginTop: 4, color: st.colour }}>
                    {st.text}
                    {article && ` · now ${article.status}`}
                    {article?.wpPostId && (
                      <>
                        {" · "}
                        <a
                          href={`https://smartsme.co.uk/?p=${article.wpPostId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#7ea6ff" }}
                        >
                          read it live
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {s.status === "proposed" && (
                  <form action={withdrawSuggestion}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" style={{ ...btn, padding: "4px 9px", fontSize: 11.5, opacity: 0.7 }}>
                      Withdraw
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
