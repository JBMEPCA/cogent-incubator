"use client";

import { useActionState, useState } from "react";
import { saveBlackBookContact } from "@/lib/black-book-actions";
import BlackBookTitlePills, { hasTitle } from "../BlackBookTitlePills";

// The quick version of the Black Book form: company, name, email and titles.
// Notes and follow-up dates are on the full page. Same server action as the
// full form, so a repeat email still merges rather than duplicating.
export default function BlackBookQuickAdd({ sites }) {
  const [state, action, pending] = useActionState(saveBlackBookContact, null);
  const [localErr, setLocalErr] = useState("");

  const onSubmit = (e) => {
    if (!hasTitle(e.currentTarget)) {
      e.preventDefault();
      setLocalErr("Pick at least one title, or All titles.");
    } else {
      setLocalErr("");
    }
  };

  const msg = localErr ? { ok: false, message: localErr } : state;

  return (
    <form action={action} onSubmit={onSubmit} className="dw-bb-form">
      <input name="company" required placeholder="Company" aria-label="Company" />
      <input name="name" placeholder="Contact name" aria-label="Contact name" />
      <input name="email" type="email" required placeholder="name@agency.com" aria-label="Email" className="dw-bb-wide" />
      <div className="dw-bb-wide">
        <BlackBookTitlePills sites={sites} />
      </div>
      <div className="dw-bb-wide dw-bb-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add to Black Book"}
        </button>
        {msg?.message && (
          <span className={msg.ok ? "field-note" : "field-err"} role="status">
            {msg.message}
          </span>
        )}
      </div>
    </form>
  );
}
