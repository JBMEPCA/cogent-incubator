"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawTrend } from "@/lib/trending-actions";

// Pull a commission before it publishes. Asks first: it stops the piece, and
// the article is kept as a parked idea rather than deleted.
export default function WithdrawButton({ topicId }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!window.confirm("Withdraw this article? It will not publish. The draft is kept as a parked idea.")) return;
    startTransition(async () => {
      const res = await withdrawTrend(topicId);
      if (!res?.ok) setMsg(res?.error || "Could not withdraw it.");
      router.refresh();
    });
  };

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="button" className="commission-link" onClick={run} disabled={pending} title="Stop this piece. The draft is kept as a parked idea.">
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      {msg && <span className="micro">{msg}</span>}
    </span>
  );
}
