"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveCampaign } from "@/lib/campaign-actions";
import { SAVE_FORM } from "./save-form";

// The campaign page's one Save, floating at the bottom of the window. Every
// editable field on the page names this form (form="campaign-save") wherever
// it sits, so the page can keep its sections and their own action buttons
// (upload, book, take down) without a form inside a form.
//
// Sent by hand rather than as a form action, so React does not reset the
// fields after the save: they already hold what was saved.

export default function MasterSave({ campaignId }) {
  const [state, action, pending] = useActionState(saveCampaign.bind(null, campaignId), null);
  const [dirty, setDirty] = useState(false);
  const seen = useRef(null);

  useEffect(() => {
    const on = (e) => {
      if (e.target?.form?.id === SAVE_FORM || e.target?.getAttribute?.("form") === SAVE_FORM) setDirty(true);
    };
    document.addEventListener("input", on);
    document.addEventListener("change", on);
    // Rows added or removed on the page count as changes too.
    const touched = () => setDirty(true);
    window.addEventListener("campaign-dirty", touched);
    return () => {
      document.removeEventListener("input", on);
      document.removeEventListener("change", on);
      window.removeEventListener("campaign-dirty", touched);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Tell the new-element rows they are now saved lines, so they clear.
  useEffect(() => {
    if (state?.at && state.at !== seen.current) {
      seen.current = state.at;
      window.dispatchEvent(new Event("campaign-saved"));
    }
  }, [state]);

  return (
    <form
      id={SAVE_FORM}
      className="msave-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        setDirty(false);
        startTransition(() => action(fd));
      }}
    >
      <div className={`msave${dirty ? " is-dirty" : ""}${pending ? " is-busy" : ""}`} role="status">
        <span className="micro msave-msg" style={{ color: !dirty && state && !state.ok ? "var(--neon-amber)" : undefined }}>
          {pending ? "Saving…" : dirty ? "Unsaved changes" : state?.message || "Everything is saved"}
        </span>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
