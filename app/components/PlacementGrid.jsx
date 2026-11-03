"use client";

import { useActionState, useMemo, useState } from "react";
import { planPlacements } from "@/lib/campaign-actions";
import { shortTitle } from "@/lib/black-book-labels";

// The booking grid: the same shape as an advertiser's plan (Miele's 2027 deck
// is a row per format and an X per month), so entering a plan is copying ticks
// across rather than adding forty placements one by one.
//
// One title at a time, because the deck is one slide per title and the
// availability differs by title. A month another advertiser holds on a served
// position is greyed and named; one this campaign already has is shown ticked.

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function PlacementGrid({ campaignId, sites, positions, taken, defaultYear, defaultUrl }) {
  const [state, action, pending] = useActionState(planPlacements.bind(null, campaignId), null);
  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [year, setYear] = useState(defaultYear);
  const [ticked, setTicked] = useState(() => new Set());

  const keyOf = (pos, m) => `${siteId}|${pos}|${year}-${String(m + 1).padStart(2, "0")}`;
  const cellState = (pos, m) => {
    const k = keyOf(pos, m);
    const holders = taken[k] || [];
    if (holders.some((h) => h.mine)) return { mine: true };
    const other = holders.find((h) => !h.mine);
    if (other && positions.find((p) => p.key === pos)?.served) return { blocked: other.advertiser };
    return { free: true, note: other ? `${other.advertiser} also has one` : null };
  };
  const toggle = (k) =>
    setTicked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const fillRow = (pos) =>
    setTicked((s) => {
      const n = new Set(s);
      const keys = MONTHS.map((_, m) => keyOf(pos, m)).filter((k, m) => cellState(pos, m).free);
      const all = keys.every((k) => n.has(k));
      keys.forEach((k) => (all ? n.delete(k) : n.add(k)));
      return n;
    });
  const count = useMemo(() => ticked.size, [ticked]);

  return (
    <form
      action={(fd) => {
        ticked.forEach((k) => fd.append("cell", k));
        action(fd);
        setTicked(new Set());
      }}
      className="pg"
    >
      <div className="pg-bar">
        <div className="pg-sites" role="tablist" aria-label="Title">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === siteId}
              className={`adv-type${s.id === siteId ? " is-active" : ""}`}
              onClick={() => setSiteId(s.id)}
            >
              {shortTitle(s.name).emoji} {shortTitle(s.name).label}
            </button>
          ))}
        </div>
        <div className="pg-year">
          <button type="button" className="btn-ghost" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            ‹
          </button>
          <b>{year}</b>
          <button type="button" className="btn-ghost" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            ›
          </button>
        </div>
      </div>

      <div className="pg-scroll">
        <table className="pg-table">
          <thead>
            <tr>
              <th scope="col">Position</th>
              {MONTHS.map((m, i) => (
                <th key={i} scope="col">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.key}>
                <th scope="row">
                  <button type="button" className="pg-row" onClick={() => fillRow(p.key)} title="Tick or clear every free month">
                    {p.label}
                    <span className="micro">{p.size ? `${p.size[0]}×${p.size[1]}` : p.email ? "email" : "content"}</span>
                  </button>
                </th>
                {MONTHS.map((_, m) => {
                  const k = keyOf(p.key, m);
                  const st = cellState(p.key, m);
                  if (st.mine)
                    return (
                      <td key={m} className="pg-cell is-mine" title="Booked on this campaign">
                        ✓
                      </td>
                    );
                  if (st.blocked)
                    return (
                      <td key={m} className="pg-cell is-taken" title={`Booked by ${st.blocked}`}>
                        {st.blocked.slice(0, 1)}
                      </td>
                    );
                  return (
                    <td key={m} className="pg-cell">
                      <label title={st.note || undefined}>
                        <input type="checkbox" checked={ticked.has(k)} onChange={() => toggle(k)} aria-label={`${p.label}, month ${m + 1}`} />
                        <span aria-hidden="true" />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adv-inline">
        <input name="targetUrl" type="url" defaultValue={defaultUrl || ""} placeholder="Click-through URL for these (can be added later)" style={{ flex: "2 1 280px" }} />
        <button type="submit" className="btn" disabled={pending || !count}>
          {pending ? "Booking…" : count ? `Book ${count} month${count === 1 ? "" : "s"}` : "Tick months to book"}
        </button>
        {state?.message && (
          <span className="micro" style={{ color: state.ok ? "var(--neon-green)" : "var(--neon-amber)" }}>
            {state.message}
          </span>
        )}
      </div>
      <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
        Click a position name to tick its whole year. Consecutive months on a website position become one placement; each email month is its own
        send. Greyed months are held by another advertiser.
      </p>
    </form>
  );
}
