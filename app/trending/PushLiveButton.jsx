"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runTrendPipeline } from "./pipeline";

// Resume a commissioned trend from wherever it stopped (still writing, held by
// QA, waiting for a picture, written but unpublished) and take it live now.
// Only the steps it still needs are run.
export default function PushLiveButton({ topicId, siteSlug, siteName, needsDraft, needsPicture }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      try {
        const out = await runTrendPipeline(
          { topicId, siteSlug, siteName, skipDraft: !needsDraft, skipPicture: !needsPicture },
          (step) => setMsg(step)
        );
        setMsg(out.published ? "Live now" : out.note || "Not live yet");
      } catch (e) {
        setMsg(e.message);
      }
      router.refresh();
    });

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button type="button" className="btn" onClick={run} disabled={pending} style={{ padding: "6px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
        {pending ? "Working…" : "Push live"}
      </button>
      {msg && <span className="commission-note" style={{ textAlign: "right", maxWidth: 220 }}>{msg}</span>}
    </span>
  );
}
