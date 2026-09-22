"use client";

import { useState, useTransition } from "react";
import { updateBlackBookContact } from "@/lib/black-book-actions";
import { shortTitle } from "@/lib/black-book-labels";
import BlackBookDelete from "./BlackBookDelete";
import BlackBookTitlePills, { hasTitle } from "./BlackBookTitlePills";

// One Black Book entry: read-only by default, with Edit opening the same
// fields pre-filled in place. Dates arrive as ISO strings (server to client).
//
// The edit form submits through onSubmit rather than a form `action` because
// React resets a form after its action runs, and a rejected edit (say, an
// email already used by another entry) would snap back to the old values and
// lose what was typed.

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

export default function BlackBookRow({ contact: c, sites }) {
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [saving, startSaving] = useTransition();
  const names = new Map(sites.map((s) => [s.id, s.name]));

  const onSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!hasTitle(form)) {
      setErr("Pick at least one title, or All titles.");
      return;
    }
    const fd = new FormData(form);
    startSaving(async () => {
      const r = await updateBlackBookContact(c.id, fd);
      if (r?.ok) {
        setErr("");
        setEditing(false);
      } else {
        setErr(r?.message || "Couldn't save that.");
      }
    });
  };

  if (editing) {
    return (
      <div className="bb-row bb-row-editing">
        <form onSubmit={onSubmit} className="bb-form">
          <label className="field">
            <span className="micro">Company</span>
            <input name="company" required defaultValue={c.company} />
          </label>
          <label className="field">
            <span className="micro">Name</span>
            <input name="name" defaultValue={c.name || ""} />
          </label>
          <label className="field">
            <span className="micro">Email</span>
            <input name="email" type="email" required defaultValue={c.email} />
          </label>
          <label className="field">
            <span className="micro">Follow up on</span>
            <input name="followUpDate" type="date" defaultValue={c.followUpDate ? c.followUpDate.slice(0, 10) : ""} />
          </label>

          <BlackBookTitlePills sites={sites} selected={c.siteIds} />

          <label className="field field-wide">
            <span className="micro">Notes</span>
            <textarea name="notes" rows={Math.min(8, Math.max(3, (c.notes || "").split("\n").length + 1))} defaultValue={c.notes || ""} />
          </label>

          <div className="field-wide bb-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setErr("");
                setEditing(false);
              }}
            >
              Cancel
            </button>
            {err && (
              <span className="field-err" role="status">
                {err}
              </span>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bb-row">
      <div className="bb-who">
        <strong>{c.company}</strong>
        <span className="micro">
          {c.name ? `${c.name} · ` : ""}
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </span>
      </div>
      <div className="bb-tags">
        {c.siteIds.length === 0 ? (
          <span className="chip chip-brand">🌍 All titles</span>
        ) : (
          c.siteIds.map((id) => {
            const t = names.has(id) ? shortTitle(names.get(id)) : null;
            return (
              <span key={id} className="chip chip-general">
                {t ? `${t.emoji} ${t.label}` : "Removed title"}
              </span>
            );
          })
        )}
      </div>
      {c.notes && <p className="bb-notes">{c.notes}</p>}
      <div className="bb-meta micro">
        <span>added {fmtDate(c.createdAt)}</span>
        {c.updatedAt !== c.createdAt && fmtDate(c.updatedAt) !== fmtDate(c.createdAt) && (
          <span>updated {fmtDate(c.updatedAt)}</span>
        )}
        {c.followUpDate && (
          <span style={c.due ? { color: "var(--neon-amber)" } : undefined}>
            {c.due ? "follow up due " : "follow up "}
            {fmtDate(c.followUpDate)}
          </span>
        )}
        <span className="bb-row-actions">
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <BlackBookDelete id={c.id} company={c.company} />
        </span>
      </div>
    </div>
  );
}
