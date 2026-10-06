"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshTrendsNow } from "@/lib/trending-actions";

// The feed refreshes itself twice an hour; this is for when something has just
// happened and waiting up to thirty minutes would defeat the point.
export default function RefreshButton() {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setMsg(null);
      try {
        const r = await refreshTrendsNow();
        setMsg(`${r.fresh} new from Google, ${r.matched} matched to a title, ${r.spikes} Search Console spikes${r.errors?.length ? ` · ${r.errors.length} error(s): ${r.errors[0]}` : ""}`);
      } catch (e) {
        setMsg(e.message);
      }
      router.refresh();
    });

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="btn-ghost" onClick={run} disabled={pending}>
        {pending ? "Checking Google…" : "Refresh now"}
      </button>
      {msg && <span className="micro">{msg}</span>}
    </div>
  );
}
