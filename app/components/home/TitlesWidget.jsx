import Link from "next/link";
import SiteMark, { statusTone } from "../SiteMark";
import { Widget, Meter, fmtK } from "./Widget";
import { fleetRead } from "@/lib/prisma";
import { fleetAnalytics } from "@/lib/fleet-analytics";
import { periodStart } from "@/lib/periods";

// Every title as a small card, five to a row: status, articles published and
// visitors over the chosen period (the bar is against the busiest title), what
// is in the pipeline and what needs you. The full cards these replace live on
// each title's own page; the rail on the right still opens any of them.
//
// Visitors come from GA4 for the period, the same figures as Fleet traffic, so
// this streams in behind a skeleton like that widget does.

const ATTENTION = { 3: "var(--neon-red)", 2: "var(--neon-amber)", 1: "var(--neon-amber)" };

export default async function TitlesWidget({ sites, period }) {
  const start = periodStart(period);
  const [published, analytics] = await Promise.all([
    fleetRead()
      .article.groupBy({
        by: ["siteId"],
        where: { status: "published", ...(start ? { publishedAt: { gte: start } } : {}) },
        _count: { _all: true },
      })
      .catch(() => []),
    fleetAnalytics({ period: period.key }).catch(() => null),
  ]);
  const articles = Object.fromEntries(published.map((r) => [r.siteId, r._count._all]));
  const visitors = Object.fromEntries((analytics?.rows || []).map((r) => [r.id, r.ga4 ? r.ga4.users : null]));
  const busiest = Math.max(1, ...sites.map((s) => articles[s.id] || 0));

  return (
    <Widget
      span={12}
      title="Titles at a glance"
      sub={`status, articles and visitors over ${period.phrase}, and what needs you`}
      href="/engine-hub"
      linkLabel="Open engine hub"
    >
      <div className="dw-titles">
        {sites.map((s) => {
          const tone = statusTone(s.status);
          const done = articles[s.id] || 0;
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
                  <span>articles</span>
                  <b className="num">{done}</b>
                </span>
                <Meter pct={done / busiest} color={s.accentHex} />
              </span>
              <span className="dw-title-row">
                <span>visitors</span>
                <b className="num">{fmtK(visitors[s.id])}</b>
              </span>
              <span className="dw-title-row">
                <span>in the pipeline</span>
                <b className="num">{s.stats.pipeline}</b>
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
