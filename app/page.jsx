import Link from "next/link";
import { Suspense } from "react";
import FleetNav from "./components/FleetNav";
import TargetsWidget from "./components/home/TargetsWidget";
import TitlesWidget from "./components/home/TitlesWidget";
import MailWidget from "./components/home/MailWidget";
import BlackBookWidget from "./components/home/BlackBookWidget";
import { SpendWidget, SpendByTitleWidget } from "./components/home/SpendWidgets";
import AgentsWidget from "./components/home/AgentsWidget";
import TrafficWidget from "./components/home/TrafficWidget";
import CalendarWidget from "./components/home/CalendarWidget";
import { Widget } from "./components/home/Widget";
import { SkelLine } from "./components/Skeleton";
import { fleetSnapshot } from "@/lib/fleet";
import { fleetCosts } from "@/lib/fleet-costs";
import { targetsInForce, monthActuals } from "@/lib/monthly-targets";
import { canEdit } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The home page: a dashboard of widgets, each a summary of a page you can open
// for the whole thing. Targets lead because they are the month's question
// ("are we on track?"); the titles sit under them because that is where the
// answer is usually found. The ten big title cards this replaced are one click
// away in the rail on the right.
//
// The mailbox and traffic widgets wait on outside services (ten inboxes, ten
// GA4 properties), so they stream in behind skeletons rather than holding up
// everything else.

function greeting(name) {
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }));
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

function Loading({ title, span = 6, rows = 5 }) {
  return (
    <Widget span={span} title={title}>
      <div style={{ display: "grid", gap: 12 }} aria-busy="true">
        {Array.from({ length: rows }, (_, i) => (
          <SkelLine key={i} w={i % 2 ? "78%" : "100%"} />
        ))}
      </div>
    </Widget>
  );
}

export default async function Home() {
  let data;
  try {
    data = await fleetSnapshot();
  } catch (err) {
    // Before the first migration there is no schema to query. Say so plainly
    // rather than showing an empty dashboard that looks like a working fleet of
    // nothing.
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
  const session = await auth().catch(() => null);

  const head = (
    <header className="fleet-head">
      <div>
        <span className="micro">Cogent Incubator</span>
        <h1>{greeting(session?.user?.name)}</h1>
      </div>
      <div className="fleet-head-right">
        <FleetNav />
      </div>
    </header>
  );

  if (sites.length === 0) {
    return (
      <main className="fleet-wrap">
        {head}
        <section className="panel fleet-empty">
          <span className="micro">No titles yet</span>
          <h1>Nothing to run</h1>
          <p>
            Bring Smart SME in as title #1 with <code>node scripts/seed-smart-sme.js</code>, or set
            up a new title from scratch.
          </p>
          <Link href="/new-title" className="btn">Add a title</Link>
        </section>
      </main>
    );
  }

  // Read once and shared: the targets rings, the title cards and the spend
  // gauge all use these, and separate reads could disagree with each other.
  const [costs, targets, editable] = await Promise.all([
    fleetCosts().catch(() => null),
    // Null means the table is not migrated yet; the widget says so.
    targetsInForce().catch(() => null),
    canEdit().catch(() => false),
  ]);
  const spendGbpBySite = costs
    ? Object.fromEntries(costs.titles.map((t) => [t.id, t.thisUsd * costs.rate]))
    : {};
  const actuals = await monthActuals(sites, { spendGbpBySite }).catch(() => ({}));

  return (
    <main className="fleet-wrap">
      {head}

      <div className="dw-grid">
        <TargetsWidget sites={sites} actuals={actuals} targets={targets} canEdit={editable} />
        <TitlesWidget sites={sites} actuals={actuals} targets={targets} />

        <Suspense fallback={<Loading title="Mail worth reading" rows={7} />}>
          <MailWidget sites={sites} />
        </Suspense>
        <BlackBookWidget sites={sites} />

        <SpendWidget costs={costs} targets={targets} />
        <SpendByTitleWidget costs={costs} />
        <AgentsWidget awaiting={totals.awaiting} />

        <Suspense fallback={<Loading title="Fleet traffic" span={8} rows={4} />}>
          <TrafficWidget />
        </Suspense>
        <CalendarWidget />
      </div>
    </main>
  );
}
