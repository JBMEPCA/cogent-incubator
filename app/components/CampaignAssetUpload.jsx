"use client";

import { useActionState } from "react";
import { uploadAssets } from "@/lib/campaign-actions";

// Upload the client's banners, logos and copy. A client component only so it
// can say which files were too big to keep, rather than dropping them quietly.
export default function CampaignAssetUpload({ campaignId, deliverables }) {
  const [state, action, pending] = useActionState(uploadAssets.bind(null, campaignId), null);
  return (
    <form action={action} className="adv-inline">
      <input name="files" type="file" multiple required style={{ flex: "2 1 240px" }} />
      {deliverables.length > 0 && (
        <select name="deliverableId" defaultValue="" aria-label="For deliverable">
          <option value="">Whole campaign</option>
          {deliverables.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="btn-ghost" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </button>
      <span className="micro" style={{ color: state ? (state.ok ? "var(--neon-green)" : "var(--neon-amber)") : "var(--muted)" }}>
        {state?.message || "Up to 3.8 MB each. Bigger files go in as a link below."}
      </span>
    </form>
  );
}
