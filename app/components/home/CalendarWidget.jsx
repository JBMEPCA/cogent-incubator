import { fleetRead } from "@/lib/prisma";
import { Widget, WidgetNote } from "./Widget";

// This month as a calendar: how many articles went out each day so far, and
// how many are scheduled for the days still to come. Days run in UK time.

const UK = "Europe/London";
const ukDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: UK }); // 2026-10-08

export default async function CalendarWidget() {
  const now = new Date();
  const today = ukDay(now);
  const [y, m] = today.split("-").map(Number);
  // A little either side of the UTC month, so UK-time days at the edges land.
  const from = new Date(Date.UTC(y, m - 1, 1) - 864e5);
  const to = new Date(Date.UTC(y, m, 1) + 864e5);

  let published;
  let scheduled;
  try {
    [published, scheduled] = await Promise.all([
      fleetRead().article.findMany({
        where: { status: "published", publishedAt: { gte: from, lt: to } },
        select: { publishedAt: true },
      }),
      fleetRead().article.findMany({
        where: { status: { not: "published" }, scheduledFor: { gte: now, lt: to } },
        select: { scheduledFor: true },
      }),
    ]);
  } catch {
    return (
      <Widget title="Publishing calendar">
        <WidgetNote>The calendar couldn&apos;t be read just now.</WidgetNote>
      </Widget>
    );
  }

  const tally = (rows, field) => {
    const out = {};
    for (const r of rows) {
      const k = ukDay(r[field]);
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };
  const pub = tally(published, "publishedAt");
  const sch = tally(scheduled, "scheduledFor");

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const key = (d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const totalPub = Object.entries(pub).filter(([k]) => k.startsWith(key(1).slice(0, 7))).reduce((n, [, v]) => n + v, 0);
  const totalSch = Object.values(sch).reduce((n, v) => n + v, 0);

  return (
    <Widget title={`${monthLabel} publishing`} sub="articles out each day, and what is scheduled">
      <div className="dw-cal" role="grid" aria-label={`${monthLabel} publishing calendar`}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="dw-cal-h" role="columnheader">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const k = key(i + 1);
          const n = pub[k] || 0;
          const s = sch[k] || 0;
          const label = [n && `${n} published`, s && `${s} scheduled`].filter(Boolean).join(", ") || "nothing";
          return (
            <span
              key={k}
              role="gridcell"
              title={label}
              aria-label={`${i + 1} ${monthLabel}: ${label}`}
              className={`dw-cal-d${k === today ? " is-today" : ""}${k > today ? " is-future" : ""}`}
            >
              {i + 1}
              {(n > 0 || s > 0) && <span className={`dw-cal-n${s && !n ? " is-sched" : ""}`}>{n || s}</span>}
            </span>
          );
        })}
      </div>
      <footer className="dw-foot">
        <span>
          <b className="num">{totalPub}</b> published so far · <b className="num">{totalSch}</b> scheduled
        </span>
      </footer>
    </Widget>
  );
}
