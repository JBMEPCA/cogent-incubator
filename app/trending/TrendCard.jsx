"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SiteMark from "@/app/components/SiteMark";
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

/** 2000 -> "2K", 20000 -> "20K", 1500000 -> "1.5M". Google's bands are floors, hence the "+". */
function compact(n) {
  if (!n) return "—";
  const fmt = (v, unit) => `${Number(v.toFixed(v < 10 ? 1 : 0))}${unit}`;
  if (n >= 1e6) return fmt(n / 1e6, "M");
  if (n >= 1e3) return fmt(n / 1e3, "K");
  return String(n);
}

export default function TrendCard({ topic, sites }) {
  const router = useRouter();
  const [slug, setSlug] = useState(topic.siteSlug || "");
  const [state, setState] = useState(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || (state && state.step && !state.done);
  const gsc = topic.source === "search_console";

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
    <article className={`trend-card${topic.live ? " is-live" : ""}`}>
      <div className={`trend-volume${gsc ? " is-gsc" : ""}`}>
        <div className="trend-volume-num">
          {compact(topic.trafficNum)}
          {!gsc && topic.trafficNum ? "+" : ""}
        </div>
        <div className="trend-volume-label">{gsc ? "impressions · 3 days" : `searches · ${topic.market}`}</div>
        {gsc && topic.spike ? <span className="trend-spike">▲ {topic.spike}× normal</span> : null}
        {gsc && topic.position ? <span className="trend-volume-label">we rank {topic.position}</span> : null}
        {topic.relevance > 0 && (
          <div className="trend-fit">
            <div className="trend-fit-bar">
              <span style={{ width: `${Math.min(100, topic.relevance)}%` }} />
            </div>
            <div className="trend-fit-label">
              <span>fit</span>
              <span>{topic.relevance}</span>
            </div>
          </div>
        )}
      </div>

      <div className="trend-body">
        <div className="trend-meta">
          {topic.site && (
            <span className="trend-title-pill">
              <SiteMark site={topic.site} size={20} showStatus={false} />
              {topic.site.name}
            </span>
          )}
          {topic.live && <span className="trend-live">Trending now</span>}
          <span className="micro">{gsc ? "Rising on our site" : "Google Trends"} · {topic.seen}</span>
          {!state?.done && (
            <button type="button" className="trend-dismiss" onClick={dismiss} disabled={busy} aria-label={`Dismiss ${topic.term}`} title="Dismiss">
              ×
            </button>
          )}
        </div>
        <h3 className="trend-term">{topic.term}</h3>
        {topic.angle && <p className="trend-angle">{topic.angle}</p>}
        {topic.why && <p className="trend-why">{topic.why}</p>}
        {topic.keywords && (
          <div className="trend-keywords">
            {topic.keywords.split(",").map((k) => k.trim()).filter(Boolean).map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>
        )}
      </div>

      <div className="trend-side">
        {topic.news.length > 0 ? (
          <ul className="trend-sources">
            {topic.news.slice(0, 3).map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer noopener" title={n.title}>
                  {n.title}
                </a>
                <small>{n.source}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="trend-status">No reporting listed yet. Commissioning searches the news for it first.</p>
        )}

        <div className="trend-actions">
          <select value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy || state?.done} aria-label="Title to commission for">
            <option value="">Choose a title…</option>
            {sites.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={commission} disabled={!slug || busy || state?.done}>
            {state?.done ? "Commissioned" : busy ? "Working…" : "Commission article"}
          </button>
          {state?.step && (
            <p className={`trend-status${state.done ? " is-done" : ""}`}>
              {state.step}
              {state.note ? ` · ${state.note}` : ""}
            </p>
          )}
          {state?.error && <p className="trend-status is-error">{state.error}</p>}
        </div>
      </div>

    </article>
  );
}
