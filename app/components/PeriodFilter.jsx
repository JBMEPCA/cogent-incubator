"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PERIODS } from "@/lib/periods";

// Today / 7D / 1M / All time for Group analytics. The page re-renders on the
// server with ?period= set (so a view can be linked), which takes a moment
// when Google has to be asked; the tab you clicked lights up straight away
// and the strip pulses until the new numbers land, so it never looks stuck.
export default function PeriodFilter({ current, hrefs, note }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState(current);
  const active = pending ? picked : current;

  return (
    <div className={`period-tabs${pending ? " is-pending" : ""}`} role="group" aria-label="Time period" title={note || undefined}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`period-tab${p.key === active ? " is-active" : ""}`}
          aria-pressed={p.key === active}
          onClick={() => {
            if (p.key === current) return;
            setPicked(p.key);
            startTransition(() => router.push(hrefs[p.key], { scroll: false }));
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
