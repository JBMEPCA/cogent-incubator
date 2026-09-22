"use client";

import { useActionState, useState } from "react";
import { saveBlackBookContact } from "@/lib/black-book-actions";
import { shortTitle } from "@/lib/black-book-labels";

// The input half of the Black Book. A client component so the form can say
// what happened (added, or merged into an existing entry). React clears the
// form after every action run, so anything the browser can check is checked
// here first: a rejected submit would otherwise wipe what was typed.
export default function BlackBookForm({ sites }) {
  const [state, action, pending] = useActionState(saveBlackBookContact, null);
  const [localErr, setLocalErr] = useState("");

  const onSubmit = (e) => {
    const f = e.currentTarget;
    const any = f.querySelector('input[name="allTitles"]:checked, input[name="siteIds"]:checked');
    if (!any) {
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

      {/* Pills rather than bare checkboxes: the input is visually hidden and
          the label lights up when checked (CSS :has). When All titles is on
          the individual pills grey out, and the server ignores them. */}
      <fieldset className="field field-wide bb-titles">
        <legend className="micro">Relevant to</legend>
        <label className="bb-check bb-all">
          <input type="checkbox" name="allTitles" />
          <span aria-hidden="true">🌍</span> All titles
        </label>
        {sites.map((s) => {
          const t = shortTitle(s.name);
          return (
            <label key={s.id} className="bb-check bb-site" title={s.name}>
              <input type="checkbox" name="siteIds" value={s.id} aria-label={s.name} />
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </label>
          );
        })}
      </fieldset>

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
