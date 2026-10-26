import Link from "next/link";
import FleetNav from "../components/FleetNav";
import ListImport from "../components/ListImport";
import Scroller from "../components/Scroller";
import { listSizes } from "@/lib/prospect-import";
import { canEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Every title's newsletter list and the drip queue behind it, on one screen.
//
// The question this answers is "who needs topping up?". Before it existed the
// queue was a hint under one Stat on each title's Newsletter tab, so knowing
// that Barbering had three weeks left meant opening ten pages. Lucas sources
// the data, so the upload box lives here too, with the table it changes.

// Under this many weeks of queue, a title is flagged. Apollo exports take Lucas
// a few days to pull and screen, so four weeks gives him a fortnight's warning.
const LOW_WEEKS = 4;

const n = (v) => (v == null ? "–" : v.toLocaleString());
const day = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : "–";

/** The Monday the queue runs out on, at this title's weekly rate. */
function runsOut(weeks) {
  if (weeks == null) return null;
  const d = new Date(Date.now() + weeks * 7 * 864e5);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export default async function ListsPage() {
  const editable = await canEdit();
  let rows = null;
  let error = null;
  try {
    rows = await listSizes();
  } catch (e) {
    error = e.message;
  }

  const totals = rows && {
    members: rows.reduce((s, r) => s + (r.members ?? 0), 0),
    queued: rows.reduce((s, r) => s + r.queued, 0),
  };

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Newsletter lists</h1>
        </div>
        <FleetNav />
      </header>

      {error && <p style={{ color: "#fca5a5" }}>Could not read the lists: {error}</p>}

      {rows && (
        <section className="lists-card">
          <h2>Lists and drip queues</h2>
          <p className="lists-note">
            {n(totals.members)} subscribers across the fleet, with {n(totals.queued)} more queued. Subscribers are
            read live from Mailchimp. Queued means waiting in the drip and allowed to go up, after duplicates, catch-alls
            and anything off-title have been taken out.
          </p>
          <Scroller>
            <table className="lists-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="num">Subscribers</th>
                  <th className="num">Queued</th>
                  <th className="num">Per week</th>
                  <th className="num">This week</th>
                  <th>Runs out</th>
                  <th>Last drip</th>
                  <th>Last top-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.dripOn && r.weeksRemaining != null && r.weeksRemaining < LOW_WEEKS;
                  return (
                    <tr key={r.slug}>
                      <td>
                        <Link href={`/s/${r.slug}/newsletter`} className="lists-title">
                          <span className="lists-dot" style={{ background: r.accentHex }} />
                          {r.name}
                        </Link>
                      </td>
                      <td className="num">{n(r.members)}</td>
                      <td className={`num${low ? " is-low" : ""}`}>{n(r.queued)}</td>
                      <td className="num">{r.dripOn ? n(r.weeklyTarget) : "off"}</td>
                      <td className="num">{r.dripOn ? n(r.importedThisWeek) : "–"}</td>
                      <td className={low ? "is-low" : undefined}>
                        {!r.dripOn
                          ? "Drip not connected"
                          : r.queued === 0
                            ? "Empty now"
                            : `${runsOut(r.weeksRemaining)} (${r.weeksRemaining} wk${r.weeksRemaining === 1 ? "" : "s"})`}
                      </td>
                      <td>{day(r.lastImport)}</td>
                      <td>
                        {r.lastUpload
                          ? `${day(r.lastUpload.at)}, ${n(r.lastUpload.queued)} queued by ${r.lastUpload.by}`
                          : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroller>
          <p className="lists-note" style={{ marginTop: 10 }}>
            Amber means less than {LOW_WEEKS} weeks of queue left at the title&rsquo;s weekly rate.
          </p>
        </section>
      )}

      {rows && editable && <ListImport titles={rows.map((r) => ({ slug: r.slug, name: r.name }))} />}

      {rows && rows.some((r) => r.uploads.length) && (
        <section className="lists-card">
          <h2>Recent top-ups</h2>
          <Scroller>
            <table className="lists-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Title</th>
                  <th>File</th>
                  <th>By</th>
                  <th className="num">Rows</th>
                  <th className="num">Queued</th>
                  <th className="num">Off-title</th>
                  <th className="num">Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .flatMap((r) => r.uploads.map((u) => ({ ...u, title: r.name })))
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 12)
                  .map((u) => (
                    <tr key={u.id}>
                      <td>{day(u.at)}</td>
                      <td>{u.title}</td>
                      <td className="lists-file">{u.file}</td>
                      <td>{u.by}</td>
                      <td className="num">{n(u.rows)}</td>
                      <td className="num">{n(u.queued)}</td>
                      <td className="num">{n(u.offTitle ?? 0)}</td>
                      <td className="num">{n(u.dupes ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Scroller>
        </section>
      )}
    </main>
  );
}
