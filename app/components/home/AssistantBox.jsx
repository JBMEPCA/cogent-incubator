"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { confirmAction, cancelAction } from "@/lib/assistant-actions";

// The assistant's thread and prompt box. Requests go to /api/assistant and the
// answer comes back with the whole thread redrawn. Proposals arrive as cards
// with Confirm and Cancel; nothing outward-facing happens without a click.

const TOOL_WORDS = {
  list_titles: "titles",
  search_mail: "searched mail",
  read_mail: "read an email",
  subscriber_count: "list sizes",
  newsletter_status: "newsletter status",
  find_posts: "searched posts",
  read_post: "read a post",
  interview_status: "interviews",
  press_desk: "press desk",
  email_lucas: "emailed you",
  send_newsletter_proof: "sent a proof",
  reply_to_email: "drafted a reply",
  forward_email: "drafted a forward",
  set_featured_image: "proposed an image",
  update_post: "proposed an edit",
  push_press_release: "proposed a press push",
};

const ACTION_TITLE = {
  email_lucas: "Emailed to you",
  send_newsletter_proof: "Newsletter proof",
  reply_to_email: "Reply",
  forward_email: "Forward",
  set_featured_image: "Featured image",
  update_post: "Post edit",
  push_press_release: "Press release",
};

const STATUS_WORD = { pending: "Waiting for you", running: "Working", done: "Done", failed: "Failed", cancelled: "Cancelled" };

const EXAMPLES = [
  "How many subscribers does Gym Business News have?",
  "Write 7 interview questions for the MD of Acme Fleet and email them to me",
  "Send me a proof of today's Smart SME newsletter",
  "Any emails from Novuna this week?",
];

function ActionCard({ item, onSettled }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const act = (fn) =>
    start(async () => {
      const r = await fn(item.id);
      if (!r.ok) setMsg(r.message);
      onSettled();
    });
  return (
    <div className={`as-card as-${item.status}`}>
      <div className="as-card-head">
        <b>{ACTION_TITLE[item.tool] || item.tool}</b>
        <span className="as-status">{STATUS_WORD[item.status] || item.status}</span>
      </div>
      <pre className="as-preview">{item.preview}</pre>
      {item.result && item.status !== "pending" && <p className="as-result">{item.result}</p>}
      {msg && <p className="as-err">{msg}</p>}
      {item.status === "pending" && (
        <div className="as-card-actions">
          <button type="button" className="dw-btn as-confirm" disabled={pending} onClick={() => act(confirmAction)}>
            {pending ? "Working…" : "Confirm"}
          </button>
          <button type="button" className="dw-btn" disabled={pending} onClick={() => act(cancelAction)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssistantBox({ initial, unavailable }) {
  const [view, setView] = useState(initial);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [asked, setAsked] = useState(null);
  const bottom = useRef(null);

  const items = view?.items || [];
  const running = items.some((i) => i.kind === "action" && i.status === "running");

  const refresh = async () => {
    const res = await fetch(`/api/assistant${view?.id ? `?c=${view.id}` : ""}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data.view) setView(data.view);
  };

  // A press push finishes after the response; poll while one is running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, view?.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [items.length, busy]);

  const ask = async (e) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setAsked(text);
    setPrompt("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text, conversationId: view?.id || null }),
      });
      const data = await res.json().catch(() => ({ error: `The request failed (HTTP ${res.status}).` }));
      if (data.view) setView(data.view);
      if (data.error) {
        setError(data.error);
        if (!data.view) setPrompt(text);
      }
    } catch (err) {
      setError(`The request failed: ${err.message}`);
      setPrompt(text);
    } finally {
      setBusy(false);
      setAsked(null);
    }
  };

  return (
    <section className="dw dw-span-12 as" aria-label="Assistant">
      <header className="dw-head">
        <div>
          <h2>Assistant</h2>
          <p className="dw-sub">
            Small jobs and questions: mail, list sizes, interview questions, proofs, quick post fixes. Anything that
            sends to someone else or changes a site waits for your Confirm.
          </p>
        </div>
        {items.length > 0 && (
          <div className="dw-actions">
            <button type="button" className="dw-btn" onClick={() => { setView(null); setError(null); }} disabled={busy}>
              New conversation
            </button>
          </div>
        )}
      </header>

      {unavailable ? (
        <p className="dw-note">{unavailable}</p>
      ) : (
        <>
          {(items.length > 0 || busy) && (
            <div className="as-thread">
              {items.map((item, i) =>
                item.kind === "user" ? (
                  <div key={i} className="as-msg as-user">{item.text}</div>
                ) : item.kind === "assistant" ? (
                  <div key={i} className="as-msg as-bot">{item.text}</div>
                ) : item.kind === "tools" ? (
                  <div key={i} className="as-trail">{[...new Set(item.tools.map((t) => TOOL_WORDS[t] || t))].join(" · ")}</div>
                ) : (
                  <ActionCard key={item.id} item={item} onSettled={refresh} />
                )
              )}
              {busy && (
                <>
                  <div className="as-msg as-user">{asked}</div>
                  <div className="as-trail as-working">Working on it…</div>
                </>
              )}
              <div ref={bottom} />
            </div>
          )}

          <form className="as-form" onSubmit={ask}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) ask(e);
              }}
              placeholder={items.length ? "Reply, or ask something else" : "Ask for something small, e.g. how many subscribers a title has"}
              rows={2}
              disabled={busy}
              aria-label="Ask the assistant"
            />
            <button type="submit" className="btn" disabled={busy || !prompt.trim()}>
              {busy ? "Working…" : "Ask"}
            </button>
          </form>
          {error && <p className="as-err">{error}</p>}
          {!items.length && !busy && (
            <div className="as-examples">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="as-chip" onClick={() => setPrompt(x)}>
                  {x}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
