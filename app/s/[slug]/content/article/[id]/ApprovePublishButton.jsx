"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The editor's call on a piece QA held: QA's fixes are made automatically,
// then it publishes. Asks first, because it goes live on the editor's word.
// Any override is recorded on the article's QA report (see approveAndPublish).
export default function ApprovePublishButton({ articleId, action, hasImage }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!hasImage) return setMsg({ error: "Add a header photo first; it would publish bare." });
    if (!window.confirm("Make QA's fixes and publish this now? It goes live on the site straight away.")) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("id", articleId);
      const res = await action(form);
      setMsg(res?.published ? { ok: "Published." } : { error: res?.error || "Could not publish it." });
      router.refresh();
    });
  };

  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="btn" onClick={run} disabled={pending}>
        {pending ? "Fixing and publishing… (about a minute)" : "Fix and publish now"}
      </button>
      {msg?.ok && <span className="micro" style={{ color: "var(--neon-green)" }}>{msg.ok}</span>}
      {msg?.error && <span className="micro" style={{ color: "var(--neon-amber)" }}>{msg.error}</span>}
    </span>
  );
}
