import Link from "next/link";
import { PERIODS } from "@/lib/periods";

// Today / 7D / 1M / All time, as links: the page re-renders on the server with
// ?period= set, so a filtered view can be bookmarked or sent to someone.
export default function PeriodFilter({ current, hrefFor, note }) {
  return (
    <div className="period-filter">
      <nav className="period-tabs" aria-label="Time period">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={hrefFor(p.key)}
            className={`period-tab${p.key === current ? " is-active" : ""}`}
            aria-current={p.key === current ? "page" : undefined}
            scroll={false}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      {note && <span className="period-note">{note}</span>}
    </div>
  );
}
