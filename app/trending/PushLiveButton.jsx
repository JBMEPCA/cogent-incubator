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
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="button" className="btn" onClick={run} disabled={pending} style={{ padding: "5px 12px", fontSize: 12 }}>
        {pending ? "Working…" : "Push live now"}
      </button>
      {msg && <span className="micro">{msg}</span>}
    </span>
  );
}
