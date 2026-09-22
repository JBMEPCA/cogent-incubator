"use client";

import { useActionState, useState } from "react";
import { saveBlackBookContact } from "@/lib/black-book-actions";
import BlackBookTitlePills, { hasTitle } from "./BlackBookTitlePills";

// The input half of the Black Book. A client component so the form can say
// what happened (added, or merged into an existing entry). React clears the
// form after every action run, so anything the browser can check is checked
// here first: a rejected submit would otherwise wipe what was typed.
export default function BlackBookForm({ sites }) {
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
    <form action={action} onSubmit={onSubmit} className="bb-form">
      <label className="field">
        <span className="micro">Company</span>
        <input name="company" required placeholder="Agency or brand" />
      </label>
      <label className="field">
        <span className="micro">Name</span>
        <input name="name" placeholder="Who got in touch" />
      </label>
      <label className="field">
        <span className="micro">Email</span>
        <input name="email" type="email" required placeholder="name@agency.com" />
      </label>
      <label className="field">
        <span className="micro">Follow up on</span>
        <input name="followUpDate" type="date" />
      </label>

      <BlackBookTitlePills sites={sites} />

      <label className="field field-wide">
        <span className="micro">Notes</span>
        <textarea name="notes" rows={2} placeholder="What they asked for, who their clients are" />
      </label>

      <div className="field-wide bb-actions">
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
