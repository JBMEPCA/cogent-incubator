"use client";

import { useActionState, useState } from "react";
import { pushPressRelease } from "@/lib/press-actions";

// The override button on the Press Releases page.
//
// It is deliberately slow and deliberately talkative. Pushing a release runs
// the whole desk — sort, rewrite, quote check, quality gate, WordPress, reply —
// which is a minute or two and five to fifteen pence, and it ends with
// something on a live magazine. A button that went quiet for ninety seconds and
// then silently refreshed would be indistinguishable from a broken one, and the
// natural response to that is to click it again.

export default function PressPush({ id, label = "Push it live", stale, subject, rate = 0.79 }) {
  // Set by the embargo answer below: the same action, told that a person has
  // looked at the email and is happy to publish it now.
  const [force, setForce] = useState(false);
  const [state, formAction, pending] = useActionState(pushPressRelease.bind(null, id, force), null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <form
        action={formAction}
        onSubmit={(e) => {
          // Releases go off. Three days on, "push it live" usually means
          // someone is reading down an old list rather than making a decision.
          if (stale && !window.confirm(`This came in more than three days ago. Publish it now?\n\n${subject}`)) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="btn" disabled={pending} style={{ whiteSpace: "nowrap" }}>
          {pending ? "Writing it up…" : force ? "Publish anyway" : label}
        </button>
      </form>

      {pending && (
        <span className="micro" style={{ color: "var(--muted)" }}>
          Rewriting, checking the quotes and publishing. A minute or two.
        </span>
      )}

      {!pending && state && (
        <div className="micro" style={{ color: state.ok ? "var(--neon-green)" : "var(--neon-amber)", maxWidth: 380 }}>
          {state.message}
          {state.url && (
            <>
              {" "}
              <a href={state.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-cyan)" }}>
                View it ↗
              </a>
            </>
          )}
          {state.cost != null && state.cost > 0 && (
            <span style={{ opacity: 0.6 }}> · {Math.round(state.cost * rate * 100)}p</span>
          )}
          {state.needsForce && !force && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="btn-ghost" onClick={() => setForce(true)}>
                I have checked the embargo — publish it now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
