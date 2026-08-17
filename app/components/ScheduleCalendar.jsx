import Link from "next/link";
import { TYPE_LABEL, TYPE_STYLE, SLOTS } from "@/lib/schedule";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Seven-day publishing calendar: one column per day, one row per slot.
//
// `slots` is this title's own times, which is not necessarily all seven — the
// footer used to print the full constant, so a title publishing twice a day
// still read "07:30 · 09:00 · 10:30 · … daily" underneath a two-row calendar.
export default function ScheduleCalendar({ days, slots = SLOTS }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${days.length}, minmax(150px, 1fr))`,
          gap: 10,
          minWidth: 900,
        }}
      >
        {days.map((day) => {
          const filled = day.slots.filter((s) => s.article).length;
          return (
            <div
              key={day.key}
              className="panel"
              style={{
                padding: 12,
                borderColor: day.isToday ? "var(--line-bright)" : "var(--line)",
                boxShadow: day.isToday ? "0 0 26px rgba(34,211,238,0.14)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>
                  {DAY[day.date.getDay()]}
                </span>
                <span className="micro num">{day.date.getDate()}</span>
                {day.isToday && (
                  <span className="micro" style={{ color: "var(--neon-cyan)", marginLeft: "auto" }}>
                    today
                  </span>
                )}
                <span
                  className="micro num"
                  style={{
                    marginLeft: day.isToday ? 0 : "auto",
                    color: filled === day.slots.length ? "var(--neon-green)" : "var(--muted)",
                  }}
                >
                  {filled}/{day.slots.length}
                </span>
              </div>

              <div style={{ display: "grid", gap: 7 }}>
                {day.slots.map((slot) => {
                  const style = TYPE_STYLE[slot.type] || TYPE_STYLE.pr_rewrite;
                  const a = slot.article;
                  return (
                    <div
                      key={slot.time}
                      style={{
                        position: "relative",
                        padding: "7px 9px",
                        borderRadius: 9,
                        border: "1px solid var(--line)",
                        background: a ? "rgba(101,125,255,0.07)" : "transparent",
                        opacity: a ? 1 : 0.55,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: a ? style.color : "var(--line)",
                          boxShadow: a ? `0 0 8px ${style.color}` : "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="micro num">{slot.time}</span>
                        <span className="micro" style={{ color: style.color }}>
                          {TYPE_LABEL[slot.type]}
                        </span>
                        {a?.qaPassed && (
                          <span
                            className="micro"
                            title="Passed editorial and image QA"
                            style={{ marginLeft: "auto", color: "var(--neon-green)" }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      {a ? (
                        <Link
                          href={`/content/article/${a.id}`}
                          style={{ fontSize: 12, lineHeight: 1.35, display: "block", marginTop: 4 }}
                        >
                          {a.title.length > 62 ? a.title.slice(0, 60) + "…" : a.title}
                        </Link>
                      ) : (
                        <div className="micro" style={{ marginTop: 4 }}>
                          slot open
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="micro" style={{ marginTop: 10 }}>
        {slots.join(" · ")} daily · articles publish automatically once QA passes ·
        click any title to review or edit before it goes out
      </p>
    </div>
  );
}
