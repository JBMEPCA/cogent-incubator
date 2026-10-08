import Link from "next/link";
import SiteMark, { statusTone } from "../SiteMark";
import { Widget, Meter, fmtK } from "./Widget";

// Every title as a small card, five to a row: status, this month's articles
// against its target, and its numbers. The full cards these replace live on
// each title's own page; the rail on the right still opens any of them.

const ATTENTION = { 3: "var(--neon-red)", 2: "var(--neon-amber)", 1: "var(--neon-amber)" };

export default function TitlesWidget({ sites, actuals, targets }) {
  return (
    <Widget
      span={12}
      title="Titles at a glance"
      sub="status, this month's articles against target, and what needs you"
      href="/engine-hub"
      linkLabel="Open engine hub"
    >
      <div className="dw-titles">
        {sites.map((s) => {
          const tone = statusTone(s.status);
          const done = actuals[s.id]?.articles ?? 0;
          const goal = targets?.values?.[s.id]?.articles;
          const visitors = actuals[s.id]?.visitors;
          return (
            <Link key={s.id} href={`/s/${s.slug}`} className="dw-title">
              <span className="dw-title-name">
                <SiteMark site={s} size={26} showStatus={false} />
                <span className="dw-title-n">{s.name}</span>
                <span
                  className="dw-dot"
                  title={tone.label}
                  style={{ background: tone.dot, boxShadow: `0 0 8px ${tone.dot}` }}
                />
              </span>
              <span className="dw-title-bar">
                <span className="dw-title-row">
                  <span>articles this month</span>
                  <b className="num">{goal ? `${done}/${goal}` : done}</b>
                </span>
                <Meter pct={goal ? done / goal : 0} color={s.accentHex} />
              </span>
              <span className="dw-title-row">
                <span>published 7d</span>
                <b className="num">{s.stats.publishedWeek}</b>
              </span>
              <span className="dw-title-row">
                <span>new visitors, month</span>
                <b className="num">{fmtK(visitors)}</b>
              </span>
              <span className="dw-title-flag" style={{ color: ATTENTION[s.attention?.level] || "var(--muted)" }}>
                {s.attention?.text || "Running clean"}
              </span>
            </Link>
          );
        })}
      </div>
    </Widget>
  );
}
