"use client";

import { useActionState, useState } from "react";
import { markAllMailRead } from "@/lib/mail-actions";

// Marks every unread message the mail-worth-reading list covers, which can be
// more than the widget shows. Two clicks on purpose: this changes the real
// Gmail inboxes, and there is no undo short of marking each one unread again.
export default function MarkAllRead({ unread }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(async () => {
    const r = await markAllMailRead();
    setConfirming(false);
    return r;
  }, null);

  if (state && !pending) {
    return (
      <span className={state.ok ? "field-note" : "field-err"} role="status">
        {state.message}
      </span>
    );
  }
  if (!unread) return null;

  return (
    <form action={action} className="dw-markread">
      {confirming ? (
        <>
          <button type="submit" className="dw-btn dw-btn-strong" disabled={pending}>
            {pending ? "Marking…" : "Yes, mark all read"}
          </button>
          {!pending && (
            <button type="button" className="dw-btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          )}
        </>
      ) : (
        <button type="button" className="dw-btn" onClick={() => setConfirming(true)}>
          Mark all read
        </button>
      )}
    </form>
  );
}
