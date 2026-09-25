"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushPressRelease } from "@/lib/press-actions";

// The override button on the Press Releases page.
//
// It does not wait for the work. Writing a release takes fifty to ninety
// seconds, and the first version of this simply awaited it: JB's first two
// pushes both ran correctly, one published and one correctly held again, and
// neither answer ever came back — the buttons sat on "Writing it up..." for
// ever while the articles quietly appeared on the sites. So the action now
// answers at once and the outcome is read back off the row.
//
// Which means this has one job after the click: keep asking the server what
// happened. It reloads the page every eight seconds until the row stops being
// in flight, which unmounts this component and ends the polling on its own.

const POLL_MS = 8000;
const GIVE_UP_AFTER = 30; // four minutes, comfortably past the slowest release

export default function PressPush({ id, label = "Push it live", stale, subject, force = false }) {
  const [state, formAction, pending] = useActionState(pushPressRelease.bind(null, id, force), null);
  const [ticks, setTicks] = useState(0);
  const router = useRouter();
  const watching = state?.working && ticks < GIVE_UP_AFTER;

  useEffect(() => {
    if (!watching) return;
    const t = setTimeout(() => {
      setTicks((n) => n + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [watching, ticks, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <form
        action={formAction}
        onSubmit={(e) => {
          // Releases go off. Three days on, "push it live" usually means someone
          // is reading down an old list rather than making a decision.
          if (stale && !window.confirm(`This came in more than three days ago. Publish it now?\n\n${subject}`)) {
            e.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          className="btn"
          disabled={pending || state?.working}
          style={{ whiteSpace: "nowrap" }}
        >
          {pending || state?.working ? "Writing it up…" : label}
        </button>
      </form>

      {state && (
        <div
          className="micro"
          style={{ color: state.ok ? "var(--neon-cyan)" : "var(--neon-amber)", maxWidth: 380 }}
        >
          {state.message}
          {state.working && ticks >= GIVE_UP_AFTER && (
            <div style={{ marginTop: 4, color: "var(--neon-amber)" }}>
              Still nothing after four minutes. Reload the page: the outcome is on the row either
              way, and the run is recorded whether it worked or not.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
