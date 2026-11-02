"use client";

import { useActionState, useEffect, useState } from "react";
import { createCampaign } from "@/lib/campaign-actions";
import BlackBookTitlePills from "./BlackBookTitlePills";

// Book a campaign. The advertiser is picked by type-ahead because the list runs
// to thousands of brands; `preset` is the brand when arriving from its row on
// the Advertisers tab.
export default function CampaignForm({ sites, preset }) {
  const [state, action, pending] = useActionState(createCampaign, null);
  const [q, setQ] = useState(preset ? preset.company : "");
  const [picked, setPicked] = useState(preset || null);
  const [hits, setHits] = useState([]);

  useEffect(() => {
    if (picked || q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/campaigns/advertisers?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => live && setHits(rows))
        .catch(() => {});
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked]);
  // Derived rather than cleared in the effect: once a brand is picked, or the
  // box is nearly empty, there is nothing to suggest.
  const shown = picked || q.trim().length < 2 ? [] : hits;

  return (
    <form action={action} className="bb-form">
      <label className="field camp-pick">
        <span className="micro">Advertiser</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
          }}
          placeholder="Start typing, e.g. Miele"
          autoComplete="off"
          required
        />
        <input type="hidden" name="advertiserId" value={picked?.id || ""} />
        {shown.length > 0 && (
          <ul className="camp-hits" role="listbox">
            {shown.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(h);
                    setQ(h.company);
                  }}
                >
                  <strong>{h.company}</strong> <span className="micro">{h.domain}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="field">
        <span className="micro">Campaign name</span>
        <input name="name" required placeholder="e.g. Miele launch, new titles" />
      </label>
      <label className="field">
        <span className="micro">Value, £ ex VAT</span>
        <input name="value" inputMode="decimal" placeholder="0.00" />
      </label>
      <label className="field">
        <span className="micro">Starts</span>
        <input name="startDate" type="date" />
      </label>
      <label className="field">
        <span className="micro">Ends</span>
        <input name="endDate" type="date" />
      </label>
      <label className="field">
        <span className="micro">Booked by</span>
        <input name="bookedBy" placeholder="e.g. Dec" />
      </label>
      <label className="field">
        <span className="micro">Client contact</span>
        <input name="clientContact" placeholder="Name and email of who signs off" />
      </label>
      <label className="field field-wide">
        <span className="micro">What was sold</span>
        <textarea name="specMd" rows={3} placeholder="Placements, sizes, frequency, anything promised in the deal" />
      </label>
      <BlackBookTitlePills sites={sites} selected={preset?.siteIds?.length ? preset.siteIds : undefined} />
      <div className="field-wide bb-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Booking…" : "Book campaign"}
        </button>
        {state?.message && (
          <span className="micro" style={{ color: state.ok ? "var(--neon-green)" : "var(--neon-amber)" }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
