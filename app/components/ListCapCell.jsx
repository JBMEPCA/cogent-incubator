"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The Cap cell on /lists. Click the number to edit it; Enter or clicking away
// saves, Escape cancels, and an empty box removes the cap. Read-only accounts
// see the number and nothing to click.

const fmt = (v) => (v == null ? "–" : v.toLocaleString());

export default function ListCapCell({ slug, cap, editable, atCap }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cap == null ? "" : String(cap));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    // "17000", "17,000", "17k" and "10.5k" all mean what they look like.
    const cleaned = value.replace(/[,\s]/g, "");
    const thousands = /k$/i.test(cleaned);
    const next =
      cleaned === "" ? null : Math.round(Number(thousands ? cleaned.slice(0, -1) : cleaned) * (thousands ? 1000 : 1));
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setError("Not a number");
      return;
    }
    if (next === cap) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lists/cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, cap: next }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      setValue(out.cap == null ? "" : String(out.cap));
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!editable) return <span className={atCap ? "lists-atcap" : undefined}>{fmt(cap)}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        className={`lists-cap${atCap ? " lists-atcap" : ""}`}
        onClick={() => setEditing(true)}
        title="Click to change the cap. Leave it empty for no cap."
      >
        {fmt(cap)}
      </button>
    );
  }

  return (
    <span className="lists-cap-edit">
      <input
        autoFocus
        inputMode="numeric"
        value={value}
        disabled={saving}
        placeholder="No cap"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(cap == null ? "" : String(cap));
            setError(null);
            setEditing(false);
          }
        }}
      />
      {error && <span className="lists-cap-error">{error}</span>}
    </span>
  );
}
