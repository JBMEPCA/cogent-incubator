"use client";

import { useState } from "react";
import { ORDER_SLOTS, specFor, unitWord } from "@/lib/ad-positions";
import { shortTitle } from "@/lib/black-book-labels";

// One thing a campaign bought: the placement, the title it runs on, how many
// (Qty/Duration) and, only if already agreed, when. No spec box: the spec is
// the placement's, shown under the row. Fields are named `${prefix}field` so
// one Save can carry every line on the page (see saveCampaign).
//
// form: the id of the form the fields belong to, when they sit outside it.
// each: offer "Each title" (one line per campaign title on save).
// booked: { ordered, booked } from the grid, for an existing line.

export default function OrderLine({ prefix, d = {}, sites, form, each = false, booked, actions }) {
  const [slot, setSlot] = useState(d.slot || "");
  const [qty, setQty] = useState(String(d.quantity ?? 1));
  const f = (k) => ({ name: `${prefix}${k}`, form });
  const spec = specFor(slot);
  const left = booked?.ordered != null ? booked.ordered - booked.booked : null;
  return (
    <div className="ol">
      <label className="field ol-slot">
        <span className="micro">Placement</span>
        <select {...f("slot")} defaultValue={d.slot || ""} onChange={(e) => setSlot(e.target.value)} required>
          {!d.slot && <option value="">Pick one…</option>}
          {ORDER_SLOTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field ol-title">
        <span className="micro">Title</span>
        <select {...f("siteId")} defaultValue={d.siteId || (each ? "each" : "")}>
          {each && <option value="each">Each title</option>}
          {!each && <option value="">Not set</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {shortTitle(s.name).emoji} {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field ol-qty">
        <span className="micro">Qty/Duration</span>
        <span className="ol-qty-in">
          <input {...f("quantity")} type="number" min={1} max={120} defaultValue={d.quantity ?? 1} onChange={(e) => setQty(e.target.value)} />
          <span className="micro">{slot ? unitWord(slot, Number(qty) || 2) : ""}</span>
        </span>
      </label>
      <label className="field ol-date">
        <span className="micro">Material due</span>
        <input {...f("assetsDue")} type="date" defaultValue={d.assetsDue || ""} />
      </label>
      <label className="field ol-date">
        <span className="micro" title="Leave empty until it has a slot. Set it and the line is booked from that month.">
          Starts (optional)
        </span>
        <input {...f("dueDate")} type="date" defaultValue={d.dueDate || ""} />
      </label>
      {slot === "other" && (
        <label className="field ol-name">
          <span className="micro">What it is</span>
          <input {...f("title")} defaultValue={d.name || ""} placeholder="e.g. Event sponsorship" />
        </label>
      )}
      <div className="ol-foot micro">
        {spec && <span style={{ color: "var(--muted)" }}>{spec}</span>}
        {left != null && (
          <span className={left > 0 ? "ol-left" : "ol-full"}>
            {booked.booked} of {booked.ordered} in the grid{left > 0 ? `, ${left} to place` : " ✓"}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
