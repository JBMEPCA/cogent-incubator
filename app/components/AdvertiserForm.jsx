"use client";

import { useActionState, useState } from "react";
import { addAdvertiser } from "@/lib/advertiser-actions";
import BlackBookTitlePills, { hasTitle } from "./BlackBookTitlePills";

// Add one brand by hand, with its first marketing contact if we have one.
// Same shape as the Black Book form, and for the same reasons: a client
// component so it can say "merged" rather than just "saved", and checked here
// first because React clears a form after its action runs.
export default function AdvertiserForm({ sites, categories }) {
  const [state, action, pending] = useActionState(addAdvertiser, null);
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
        <input name="company" required placeholder="Brand name" />
      </label>
      <label className="field">
        <span className="micro">Website</span>
        <input name="website" placeholder="brand.co.uk" />
      </label>
      <label className="field">
        <span className="micro">Category</span>
        <input name="category" list="adv-categories" placeholder="e.g. Gym equipment" />
        <datalist id="adv-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span className="micro">Where from</span>
        <input name="sourceDetail" placeholder="e.g. Elevate 2026 exhibitors" />
      </label>
      <label className="field">
        <span className="micro">Contact email</span>
        <input name="email" type="email" placeholder="marketing@brand.co.uk" />
      </label>
      <label className="field">
        <span className="micro">First name</span>
        <input name="firstName" />
      </label>
      <label className="field">
        <span className="micro">Last name</span>
        <input name="lastName" />
      </label>
      <label className="field">
        <span className="micro">Job title</span>
        <input name="jobTitle" placeholder="Marketing Manager" />
      </label>

      <BlackBookTitlePills sites={sites} />

      <div className="field-wide bb-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add advertiser"}
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
