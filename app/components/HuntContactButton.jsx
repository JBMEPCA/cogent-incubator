"use client";

import { useTransition } from "react";
import { huntContactNow } from "@/lib/advertiser-actions";

// Reads one brand's website for a published contact now, instead of waiting for
// the sweep. Can take up to 25s on a slow site, so it says it is working.
export default function HuntContactButton({ id }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={busy}
      onClick={() => start(() => huntContactNow(id))}
      title="Reads the brand's homepage, contact, about and press pages for a marketing, partnerships, press or general inbox"
    >
      {busy ? "Looking on their website…" : "Find contact on website"}
    </button>
  );
}
