"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import CampaignPanel from "./CampaignPanel";

// One row of the Campaigns list. Clicking it opens the placement panel over
// the list rather than navigating away (JB, 3 Nov 2026: the everyday jobs,
// swapping a banner, fixing a link, reading the clicks, should be one click).
// The row's content is rendered by the server page and passed in.
export default function CampaignRow({ campaignId, label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="camp-sum camp-row"
        aria-label={`Open ${label}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </div>
      {/* Portalled to <body>: the list sits in an animated section, and a
          transformed ancestor makes position: fixed relative to it, which
          left the panel under the title rail and cut off at the right. */}
      {open && createPortal(<CampaignPanel campaignId={campaignId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
