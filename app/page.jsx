import Link from "next/link";
import SiteMark, { statusTone } from "./components/SiteMark";
import FleetNav from "./components/FleetNav";
import FleetMailWidget from "./components/FleetMailWidget";
import { fleetSnapshot } from "@/lib/fleet";
import { visitUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function timeAgo(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const money = (usd) => (usd >= 100 ? `$${Math.round(usd)}` : `$${usd.toFixed(2)}`);

function Figure({ value, label, tone }) {
  return (
    <div className="fleet-fig">
      <div className="fleet-fig-v" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="fleet-fig-l">{label}</div>
    </div>
  );
}

function TitleCard({ site }) {
  const tone = statusTone(site.status);
  const s = site.stats;
  const live = visitUrl(site);
  return (
    <div className="panel fleet-card">
      {/* Covers the whole panel, so the card still opens the control room from
          anywhere on it. Sits under the visit link rather than around it. */}
      <Link href={`/s/${site.slug}`} className="fleet-card-open" aria-label={`Open ${site.name}`} />

      <div className="fleet-card-head">
        <SiteMark site={site} size={46} showStatus={false} />
        <div className="fleet-card-id">
          <h2>{site.name}</h2>
          {live ? (
            // The domain IS the affordance — it is already the line that names
            // the website, so making it the link needs no extra furniture.
            <a
              className="micro site-visit"
              href={live}
              target="_blank"
              rel="noopener noreferrer"
            >
              {site.domain}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens the live site in a new tab)</span>
            </a>
          ) : (
            // No domain, or a title still being provisioned. Plain text beats
            // a link to a site that is not serving yet.
            <span className="micro">{site.domain || site.slug}</span>
          )}
        </div>
        <span className="fleet-status">
          <span className="agent-dot" style={{ background: tone.dot, boxShadow: `0 0 10px ${tone.dot}` }} />
          {tone.label}
        </span>
      </div>

      <div className="fleet-figs">
        <Figure value={s.publishedWeek} label="published, 7d" />
        <Figure value={s.pipeline} label="in pipeline" />
        <Figure value={money(s.spendMonth)} label="spend, month" />
        <Figure value={s.awaiting} label="awaiting you" tone={s.awaiting ? "var(--neon-amber)" : undefined} />
      </div>

      <div className="fleet-card-foot">
        {site.attention ? (
          <span className={`fleet-flag level-${site.attention.level}`}>{site.attention.text}</span>
        ) : (
          <span className="fleet-flag level-0">Running clean</span>
        )}
        <span className="micro">last published {timeAgo(s.lastPublishedAt)}</span>
      </div>
    </div>
  );
}

export default async function FleetOverview() {
  let data;
  try {
    data = await fleetSnapshot();
  } catch (err) {
    // Before the first migration there is no schema to query. Say so plainly
    // rather than showing an empty grid that looks like a working fleet of
    // nothing — the two states need very different responses from whoever is
    // reading the screen.
    return (
      <main className="fleet-wrap">
        <section className="panel fleet-empty">
          <span className="micro">Not connected</span>
          <h1>The database isn&apos;t ready yet</h1>
          <p>
            Run <code>npx prisma migrate dev --name init</code> and then{" "}
            <code>node scripts/seed-smart-sme.js</code> to bring Smart SME in as the first title.
          </p>
          <p className="fleet-err">{String(err.message).split("\n")[0]}</p>
        </section>
      </main>
    );
  }

  const { sites, totals } = data;

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>All titles</h1>
        </div>
        {/* The fleet-level views sit above the figures they belong to: the
            spend total here is a number, and Group costs is the breakdown
            behind it. This was a text link under the heading, where it read as
            a caption and got missed. */}
        <div className="fleet-head-right">
          <FleetNav />
          <div className="fleet-totals">
            <Figure value={totals.publishedWeek} label="published this week" />
            <Figure value={money(totals.spendMonth)} label="fleet spend, month" />
            <Figure
              value={totals.awaiting}
              label="awaiting approval"
              tone={totals.awaiting ? "var(--neon-amber)" : undefined}
            />
            <Figure
              value={totals.blocked}
              label="agents blocked"
              tone={totals.blocked ? "var(--neon-red)" : undefined}
            />
          </div>
        </div>
      </header>

      {sites.length === 0 ? (
        <section className="panel fleet-empty">
          <span className="micro">No titles yet</span>
          <h1>Nothing to run</h1>
          <p>
            Bring Smart SME in as title #1 with <code>node scripts/seed-smart-sme.js</code>, or set
            up a new title from scratch.
          </p>
          <Link href="/new-title" className="btn">Add a title</Link>
        </section>
      ) : (
        <section className="fleet-grid stagger">
          {sites.map((site) => (
            <TitleCard key={site.id} site={site} />
          ))}
          <Link href="/new-title" className="panel fleet-card fleet-card-new">
            <span className="fleet-new-plus">+</span>
            <span>Add a title</span>
            <span className="micro">provision a new publication</span>
          </Link>
        </section>
      )}

      {sites.length > 0 && <FleetMailWidget sites={sites} />}
    </main>
  );
}
