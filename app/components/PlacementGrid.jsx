"use client";

import { startTransition, useActionState, useState } from "react";
import { planPlacements } from "@/lib/campaign-actions";
import { shortTitle } from "@/lib/black-book-labels";

// The booking grid: the same shape as an advertiser's plan (Miele's 2027 deck
// is a row per format and an X per month), so entering a plan is copying ticks
// across rather than adding forty placements one by one.
//
// Only what the campaign bought: a row per placement on its order lines, for
// each title they are on, with how many are still to place. Once a row has
// had its Qty/Duration ticked, its other months lock. One title at a time,
// because the deck is one slide per title and the availability differs by
// title. A month another advertiser holds on a served position is greyed and
// named; one this campaign already has is shown ticked.
//
// rowsBySite: { siteId: [{ key, label, size, served, email, ordered, booked }] },
// ordered null for a row booked without an order line (no limit).

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function PlacementGrid({ campaignId, sites, rowsBySite, taken, defaultYear }) {
  const [state, action, pending] = useActionState(planPlacements.bind(null, campaignId), null);
  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [year, setYear] = useState(defaultYear);
  const [ticked, setTicked] = useState(() => new Set());
  const rows = rowsBySite[siteId] || [];

  const keyOf = (pos, y, m) => `${siteId}|${pos}|${y}-${String(m + 1).padStart(2, "0")}`;
  const cellState = (row, m) => {
    const holders = taken[keyOf(row.key, year, m)] || [];
    if (holders.some((h) => h.mine)) return { mine: true };
    const other = holders.find((h) => !h.mine);
    if (other && row.served) return { blocked: other.advertiser };
    return { free: true, note: other ? `${other.advertiser} also has one` : null };
  };
  // Ticks waiting to be booked on this row, in any year.
  const tickedOn = (row) => [...ticked].filter((k) => k.startsWith(`${siteId}|${row.key}|`)).length;
  const left = (row) => (row.ordered == null ? Infinity : row.ordered - row.booked - tickedOn(row));

  const toggle = (row, k) =>
    setTicked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else if (left(row) > 0) n.add(k);
      return n;
    });
  const fillRow = (row) =>
    setTicked((s) => {
      const n = new Set(s);
      const free = MONTHS.map((_, m) => m).filter((m) => cellState(row, m).free).map((m) => keyOf(row.key, year, m));
      if (free.some((k) => n.has(k))) {
        free.forEach((k) => n.delete(k));
        return n;
      }
      let room = left(row);
      for (const k of free) {
        if (room <= 0) break;
        n.add(k);
        room--;
      }
      return n;
    });

  if (!sites.length) {
    return (
      <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
        Add what they bought below, with a placement and a title, and its rows appear here to put in months.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        ticked.forEach((k) => fd.append("cell", k));
        setTicked(new Set());
        startTransition(() => action(fd));
      }}
      className="pg"
    >
      <div className="pg-bar">
        <div className="pg-sites" role="tablist" aria-label="Title">
          {sites.map((s) => {
            const todo = (rowsBySite[s.id] || []).reduce((n, r) => n + (r.ordered == null ? 0 : Math.max(0, r.ordered - r.booked)), 0);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === siteId}
                className={`adv-type${s.id === siteId ? " is-active" : ""}`}
                onClick={() => setSiteId(s.id)}
              >
                {shortTitle(s.name).emoji} {shortTitle(s.name).label}
                {todo > 0 && <span className="pg-todo">{todo}</span>}
              </button>
            );
          })}
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
              <th scope="col">Bought</th>
              {MONTHS.map((m, i) => (
                <th key={i} scope="col">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const room = left(row);
              const placed = row.booked + tickedOn(row);
              return (
                <tr key={row.key}>
                  <th scope="row">
                    <button type="button" className="pg-row" onClick={() => fillRow(row)} title="Tick the free months up to what was bought, or clear this year's ticks">
                      {row.label}
                      <span className={`micro${row.ordered != null && room <= 0 ? " pg-full" : ""}`}>
                        {row.ordered == null ? (row.size ? `${row.size[0]}×${row.size[1]}` : row.email ? "email" : "content") : `${placed} of ${row.ordered}${room <= 0 ? " ✓" : ""}`}
                      </span>
                    </button>
                  </th>
                  {MONTHS.map((_, m) => {
                    const k = keyOf(row.key, year, m);
                    const st = cellState(row, m);
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
                    const on = ticked.has(k);
                    return (
                      <td key={m} className={`pg-cell${!on && room <= 0 ? " is-locked" : ""}`}>
                        <label title={!on && room <= 0 ? "All of this one is placed" : st.note || undefined}>
                          <input type="checkbox" checked={on} disabled={!on && room <= 0} onChange={() => toggle(row, k)} aria-label={`${row.label}, month ${m + 1}`} />
                          <span aria-hidden="true" />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="adv-inline">
        <button type="submit" className="btn" disabled={pending || !ticked.size}>
          {pending ? "Booking…" : ticked.size ? `Book ${ticked.size} month${ticked.size === 1 ? "" : "s"}` : "Tick months to book"}
        </button>
        {!pending && state?.message && (
          <span className="micro" style={{ color: state.ok ? "var(--neon-green)" : "var(--neon-amber)" }}>
            {state.message}
          </span>
        )}
      </div>
      <p className="micro" style={{ color: "var(--muted)", margin: 0 }}>
        Click a row name to tick its free months up to what was bought. Consecutive months on a website position become one placement; each email
        month is its own send. Greyed months are held by another advertiser. A booked month is removed from its line below.
      </p>
    </form>
  );
}
