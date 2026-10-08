"use client";

import { useActionState, useEffect, useState } from "react";
import { Widget, Gauge, fmtK, gbp } from "./Widget";
import { METRICS, monthName } from "@/lib/monthly-target-metrics";
import { saveMonthlyTargets } from "@/lib/monthly-target-actions";

// The targets rings, and the editor that sets them.
//
// The rings are worked out on the server and arrive ready to draw. The editor
// holds one month's numbers in state so the fleet total under each column moves
// as you type, and "copy last month" can fill every box at once.

const show = (m, v) => (v == null ? "–" : m.money ? gbp(v) : fmtK(v));

function ringColor(m, pct) {
  if (!m.cap) return m.color;
  if (pct > 1) return "var(--neon-red)";
  if (pct > 0.85) return "var(--neon-amber)";
  return "var(--neon-green)";
}

function Ring({ ring }) {
  const m = METRICS.find((x) => x.key === ring.metric);
  if (ring.actual == null) {
    return (
      <div className="dw-ring">
        <Gauge pct={0} label="–" sub={m.ring} color="var(--muted)" />
        <span className="dw-ring-l">Not connected yet</span>
      </div>
    );
  }
  if (!ring.target) {
    return (
      <div className="dw-ring">
        <Gauge pct={0} label={show(m, ring.actual)} sub={m.ring} color="var(--muted)" />
        <span className="dw-ring-l">No target set</span>
      </div>
    );
  }
  const pct = ring.actual / ring.target;
  return (
    <div className="dw-ring">
      <Gauge pct={pct} label={`${Math.round(pct * 100)}%`} sub={m.ring} color={ringColor(m, pct)} />
      <span className={`dw-ring-l${m.cap && pct > 1 ? " is-over" : ""}`}>
        <b className="num">{show(m, ring.actual)}</b> of {show(m, ring.target)}
        {m.cap ? " cap" : ""}
      </span>
    </div>
  );
}

function Editor({ titles, months, prev, actuals, rings, onClose }) {
  const [month, setMonth] = useState(months[0].month);
  const current = months.find((x) => x.month === month);
  const [values, setValues] = useState(() =>
    Object.fromEntries(months.map((x) => [x.month, x.values]))
  );
  const [state, action, pending] = useActionState(saveMonthlyTargets, null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const vals = values[month] || {};
  const set = (siteId, metric, v) =>
    setValues((all) => ({
      ...all,
      [month]: { ...all[month], [siteId]: { ...(all[month]?.[siteId] || {}), [metric]: v } },
    }));
  const total = (metric) =>
    titles.reduce((n, t) => n + (Number(vals[t.id]?.[metric]) || 0), 0);

  // The month before the one being edited: last month's saved targets for the
  // current month, or this month's (as edited so far) for next month.
  const source = month === months[0].month ? prev : { month: months[0].month, values: values[months[0].month] };
  const copy = () => {
    setValues((all) => ({ ...all, [month]: JSON.parse(JSON.stringify(source.values || {})) }));
    setNote(`Filled in from ${monthName(source.month)}. Save to keep.`);
  };

  return (
    <form action={action} className="dw-ted">
      <input type="hidden" name="month" value={month} />
      <div className="dw-ted-top">
        <div>
          <h3>Monthly targets</h3>
          <p>
            Set a number for each title. The fleet target is the total, and the rings and title cards
            read from it. Leave a box empty for no target. Tick a column to show it as a ring.
          </p>
          {current.carriedFrom && Object.keys(current.values || {}).length > 0 && !note && (
            <p className="dw-ted-carry">
              Nothing saved for {monthName(month)} yet. These are carried over from {monthName(current.carriedFrom)}.
            </p>
          )}
        </div>
        <div className="dw-month" role="group" aria-label="Month">
          {months.map((x) => (
            <button
              key={x.month}
              type="button"
              aria-pressed={x.month === month}
              onClick={() => {
                setMonth(x.month);
                setNote("");
              }}
            >
              {monthName(x.month)}
            </button>
          ))}
        </div>
      </div>

      <div className="dw-ted-scroll">
        <table className="dw-ted-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              {METRICS.map((m) => (
                <th scope="col" key={m.key}>
                  <span className="dw-sw" style={{ background: m.color }} />
                  {m.label}
                  <label className="dw-ted-ring">
                    <input type="checkbox" name="ring" value={m.key} defaultChecked={rings.includes(m.key)} />
                    ring on dashboard
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {titles.map((t) => (
              <tr key={t.id}>
                <th scope="row">
                  <span className="dw-sw" style={{ background: t.accentHex }} />
                  {t.name}
                </th>
                {METRICS.map((m) => (
                  <td key={m.key}>
                    <input
                      type="number"
                      min="0"
                      step={m.step}
                      inputMode="numeric"
                      id={`t-${month}-${t.id}-${m.key}`}
                      name={`t:${t.id}:${m.key}`}
                      aria-label={`${t.name}, ${m.label}`}
                      value={vals[t.id]?.[m.key] ?? ""}
                      onChange={(e) => set(t.id, m.key, e.target.value)}
                    />
                    {month === months[0].month && (
                      <span className="dw-ted-now">now {show(m, actuals[t.id]?.[m.key])}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Fleet target</th>
              {METRICS.map((m) => (
                <td key={m.key} className="num">{show(m, total(m.key))}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="dw-ted-foot">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : `Save ${monthName(month)}'s targets`}
        </button>
        {source?.month && (
          <button type="button" className="dw-btn" onClick={copy}>
            Copy {monthName(source.month)}&apos;s
          </button>
        )}
        <button type="button" className="dw-btn" onClick={onClose}>
          Cancel
        </button>
        <span className={state && !state.ok ? "field-err" : "field-note"} role="status">
          {state && !state.ok ? state.message : note}
        </span>
      </div>
    </form>
  );
}

export default function TargetsCard({ monthLabel, ringsData, titles, months, prev, actuals, rings, canEdit }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Widget
      span={12}
      title={`${monthLabel} against targets`}
      sub="fleet-wide, the total of every title's target · resets on the 1st"
      href="/analytics"
      linkLabel="Open analytics"
      actions={
        canEdit && (
          <button type="button" className="dw-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Close targets" : "Set targets"}
          </button>
        )
      }
    >
      {ringsData.length ? (
        <div className="dw-rings">
          {ringsData.map((r) => (
            <Ring key={r.metric} ring={r} />
          ))}
        </div>
      ) : (
        <p className="dw-note">No measures are ticked to show as rings. Open Set targets to choose some.</p>
      )}
      {open && (
        <Editor titles={titles} months={months} prev={prev} actuals={actuals} rings={rings} onClose={close} />
      )}
    </Widget>
  );
}
