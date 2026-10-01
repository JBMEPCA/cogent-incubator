"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commissionTrendAction, dismissTrend } from "@/lib/trending-actions";

// One trend, and the button that turns it into an article.
//
// Commissioning puts the article at the front of the title's queue, but the
// engine only ticks every half hour, so the button also wakes the Editor and
// then the Designer straight away rather than leaving the first thirty minutes
// of a spike on the table. Each wake is its own request with the full 300s
// budget; if the tab is closed mid-draft the server still finishes, and the
// queue rules pick up anything left on the next tick.

async function wake(agent, slug) {
  const res = await fetch(`/api/agents/wake?agent=${agent}&site=${encodeURIComponent(slug)}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.text()).slice(0, 160) || `${agent} returned ${res.status}`);
  return res.json();
}

export default function TrendCard({ topic, sites }) {
  const router = useRouter();
  const [slug, setSlug] = useState(topic.siteSlug || "");
  const [state, setState] = useState(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || (state && state.step && !state.done);

  const commission = () =>
    startTransition(async () => {
      setState({ step: "Commissioning…" });
      const res = await commissionTrendAction(topic.id, slug);
      if (!res?.ok) {
        setState({ error: res?.error || "Could not commission it." });
        return;
      }
      try {
        setState({ step: `Drafting for ${res.siteName}…` });
        const drafted = await wake("editor", res.siteSlug);
        setState({ step: "Finding a picture…", note: drafted?.summary });
        const pictured = await wake("designer", res.siteSlug);
        setState({
          done: true,
          step: "Done",
          note: `${drafted?.summary || "Drafted"}. ${pictured?.summary || ""}`.trim(),
        });
      } catch (e) {
        // The article exists and is first in the queue, so a failed wake only
        // costs speed: the next engine tick picks it up.
        setState({ done: true, step: "Queued", note: `Commissioned and first in line; the next engine tick will finish it. (${e.message})` });
      }
      router.refresh();
    });

  const dismiss = () =>
    startTransition(async () => {
      await dismissTrend(topic.id);
      router.refresh();
    });

  return (
    <article className="panel trend-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className={`chip ${topic.source === "search_console" ? "chip-audience" : "chip-content"}`}>
          {topic.source === "search_console" ? "Rising on our site" : `Google Trends · ${topic.market}`}
        </span>
        {topic.live && <span className="chip chip-monetise">Trending now</span>}
        {topic.relevance > 0 && <span className="micro">fit {topic.relevance}</span>}
        <span className="micro" style={{ marginLeft: "auto" }}>{topic.seen}</span>
      </div>

      <div>
        <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.3 }}>{topic.term}</h3>
        <p className="micro" style={{ margin: "4px 0 0" }}>
          {topic.traffic ? `${topic.traffic}${topic.source === "google_trends" ? " searches" : ""}` : ""}
          {topic.spike ? ` · ${topic.spike}x normal` : ""}
          {topic.position ? ` · we rank ${topic.position}` : ""}
        </p>
      </div>

      {topic.angle && (
        <p style={{ margin: 0, fontSize: 14 }}>
          <span className="micro" style={{ display: "block", marginBottom: 2 }}>Suggested headline</span>
          {topic.angle}
        </p>
      )}
      {topic.why && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{topic.why}</p>}

      {topic.keywords && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {topic.keywords.split(",").map((k) => k.trim()).filter(Boolean).map((k) => (
            <span key={k} className="chip chip-general" style={{ fontSize: 11 }}>{k}</span>
          ))}
        </div>
      )}

      {topic.news.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--muted)" }}>
          {topic.news.slice(0, 3).map((n) => (
            <li key={n.url} style={{ marginBottom: 2 }}>
              <a href={n.url} target="_blank" rel="noreferrer noopener" style={{ color: "inherit" }}>
                {n.title}
              </a>{" "}
              <span className="micro">{n.source}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: "auto", paddingTop: 4 }}>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy || state?.done} aria-label="Title to commission for" style={{ flex: "1 1 160px", minWidth: 0 }}>
          <option value="">Choose a title…</option>
          {sites.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={commission} disabled={!slug || busy || state?.done || !topic.news.length}>
          Commission article
        </button>
        {!state?.done && (
          <button type="button" className="btn-ghost" onClick={dismiss} disabled={busy}>
            Dismiss
          </button>
        )}
      </div>
      {!topic.news.length && <p className="micro" style={{ margin: 0 }}>No reporting listed yet, so nothing to write from.</p>}
      {state?.step && (
        <p style={{ margin: 0, fontSize: 13, color: state.done ? "var(--neon-green, #6ee7b7)" : "var(--muted)" }}>
          {state.step}
          {state.note ? ` · ${state.note}` : ""}
        </p>
      )}
      {state?.error && <p style={{ margin: 0, fontSize: 13, color: "var(--neon-amber, #fcd34d)" }}>{state.error}</p>}
    </article>
  );
}
