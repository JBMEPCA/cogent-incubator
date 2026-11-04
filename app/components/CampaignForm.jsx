"use client";

import { useActionState, useEffect, useState } from "react";
import { createCampaign } from "@/lib/campaign-actions";
import { monthlySchedule, money, toPence, ukDay } from "@/lib/campaigns";
import BlackBookTitlePills from "./BlackBookTitlePills";
import OrderLine from "./OrderLine";

// Book a campaign in one go: the brand, the elements it bought (a line per
// placement with its Qty/Duration, see OrderLine) and how the money comes in. The
// advertiser is picked by type-ahead because the list runs to thousands of
// brands; `preset` is the brand when arriving from its row on the Advertisers
// tab.

let nextKey = 1;

/** Whole months from one date input to another, counting both ends. */
function monthsBetween(a, b) {
  if (!a || !b) return null;
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  const n = (yb - ya) * 12 + (mb - ma) + 1;
  return n > 0 ? n : null;
}

export default function CampaignForm({ sites, preset }) {
  const [state, action, pending] = useActionState(createCampaign, null);
  const [q, setQ] = useState(preset ? preset.company : "");
  const [picked, setPicked] = useState(preset || null);
  const [hits, setHits] = useState([]);

  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [elements, setElements] = useState([]);
  const [payMode, setPayMode] = useState("monthly");
  // Left blank, these follow the campaign dates; typing in them takes over.
  const [months, setMonths] = useState("");
  const [firstDue, setFirstDue] = useState("");

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


  const totalPence = toPence(value) || 0;
  const monthCount = Number(months) || monthsBetween(startDate, endDate) || 12;
  const firstDate = firstDue || startDate || ukDay(new Date());
  const plan = payMode === "monthly" && totalPence ? monthlySchedule(totalPence, new Date(`${firstDate}T12:00:00Z`), monthCount) : [];
  const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

  return (
    <form action={action} className="camp-book">
      <div className="bb-form">
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
          <span className="micro">Total value, £ ex VAT</span>
          <input name="value" inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="field">
          <span className="micro">Starts</span>
          <input name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="micro">Ends</span>
          <input name="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
          <span className="micro">Notes on the deal</span>
          <textarea name="specMd" rows={2} placeholder="Anything promised that isn't an element below" />
        </label>
        <BlackBookTitlePills sites={sites} selected={preset?.siteIds?.length ? preset.siteIds : undefined} />
      </div>

      {/* ---------------- elements */}
      <h3 className="camp-book-h">What they bought</h3>
      {elements.length === 0 && (
        <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
          A line per placement with how many, e.g. 12 months of leaderboard, 4 e-shots. Pick Each title for the same on every title above. Leave
          Starts empty to put them in months on the campaign page.
        </p>
      )}
      {elements.map((k) => (
        <div key={k} className="ol-new">
          <OrderLine
            prefix={`new:${k}:`}
            sites={sites}
            each
            actions={
              <button type="button" className="btn-ghost ol-x" onClick={() => setElements((els) => els.filter((e) => e !== k))}>
                Remove
              </button>
            }
          />
        </div>
      ))}
      <div>
        <button type="button" className="btn-ghost" onClick={() => setElements((els) => [...els, nextKey++])}>
          + Add element
        </button>
      </div>

      {/* ---------------- payments */}
      <h3 className="camp-book-h">How it&apos;s paid</h3>
      <div className="adv-inline" role="radiogroup" aria-label="Payment">
        {[
          { v: "monthly", label: "Monthly instalments" },
          { v: "single", label: "One payment" },
          { v: "later", label: "Set up later" },
        ].map((o) => (
          <label key={o.v} className={`adv-type${payMode === o.v ? " is-active" : ""}`}>
            <input type="radio" name="payMode" value={o.v} checked={payMode === o.v} onChange={() => setPayMode(o.v)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {payMode === "monthly" && (
        <div className="adv-inline">
          {/* The count the preview shows is the count sent: left blank, the
              box only shows the dates' month count as a placeholder. */}
          <input type="hidden" name="months" value={monthCount} />
          <input inputMode="numeric" value={months} placeholder={String(monthCount)} onChange={(e) => setMonths(e.target.value)} aria-label="Months" style={{ width: 60 }} />
          <span className="micro">monthly payments, first due</span>
          <input name="firstDue" type="date" value={firstDue || startDate} onChange={(e) => setFirstDue(e.target.value)} aria-label="First payment due" />
          <span className="micro" style={{ color: "var(--muted)" }}>
            {plan.length
              ? `${plan.length} × ${money(plan[plan.length - 1].amountPence)}${plan[0].amountPence !== plan[plan.length - 1].amountPence ? ` (first ${money(plan[0].amountPence)})` : ""}, last due ${fmtDay(plan[plan.length - 1].dueDate)}`
              : "Enter the total value above to see the instalments."}
          </span>
        </div>
      )}
      {payMode === "single" && (
        <div className="adv-inline">
          <span className="micro">{totalPence ? money(totalPence) : "The total"} due on</span>
          <input name="payDate" type="date" defaultValue={startDate} aria-label="Payment due" />
        </div>
      )}
      {payMode === "later" && (
        <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>Add instalments on the campaign page once the terms are agreed.</p>
      )}

      <div className="bb-actions" style={{ marginTop: 6 }}>
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
