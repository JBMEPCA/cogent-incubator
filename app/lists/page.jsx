import Link from "next/link";
import FleetNav from "../components/FleetNav";
import SubTabs, { FLEET_ANALYTICS_TABS } from "@/app/components/SubTabs";
import ListImport from "../components/ListImport";
import Scroller from "../components/Scroller";
import { listSizes } from "@/lib/prospect-import";
import {
  fleetSendStats,
  FLEET_SEND_WINDOW_DAYS,
  latestIssueStats,
  MAX_HARD_BOUNCE_RATE,
} from "@/lib/newsletter-stats";
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
// Mailchimp gives rates as fractions (0.243).
const pct = (v) => (v == null ? "–" : `${(v * 100).toFixed(1)}%`);
/** Mailchimp send times are UTC; "today" has to mean today in London. */
const isToday = (d) => {
  if (!d) return false;
  const fmt = (x) => new Date(x).toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  return fmt(d) === fmt(Date.now());
};
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
  // Sends come from one cached Mailchimp report for the whole account. A
  // failure there costs the sends table, never the lists above it.
  const [sizes, sends, latest] = await Promise.all([
    listSizes().catch((e) => ({ error: e.message })),
    fleetSendStats().catch((e) => ({ __error: e.message })),
    latestIssueStats().catch((e) => ({ __error: e.message })),
  ]);
  if (sizes.error) error = sizes.error;
  else rows = sizes;
  const sendError = sends.__error || null;
  const latestError = latest.__error || null;

  const totals = rows && {
    members: rows.reduce((s, r) => s + (r.members ?? 0), 0),
    queued: rows.reduce((s, r) => s + r.queued, 0),
  };

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>eNewsletter lists</h1>
        </div>
        <FleetNav />
      </header>
      <SubTabs items={FLEET_ANALYTICS_TABS} active="/lists" />

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

      {rows && (
        <section className="lists-card">
          <h2>Latest eNewsletter stats</h2>
          <p className="lists-note">
            The most recent issue each title sent. Opens exclude Apple Mail Privacy and other proxies, and clicks count
            real people rather than the security scanners that open every link in a business inbox, so these read lower
            than Mailchimp&rsquo;s own dashboard and are the ones worth acting on. Bounce is hard bounces only, as a
            share of emails sent, because that is what the send gate blocks a title on. Refreshed every two minutes.
          </p>
          {latestError ? (
            <p className="lists-note" style={{ color: "var(--neon-red)" }}>
              Could not read Mailchimp reports: {latestError}
            </p>
          ) : (
            <Scroller>
              <table className="lists-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Issue</th>
                    <th className="num">Delivered</th>
                    <th className="num">Opened</th>
                    <th className="num">Open rate</th>
                    <th className="num">Clicks</th>
                    <th className="num">Click rate</th>
                    <th className="num">Bounced</th>
                    <th className="num">Unsub</th>
                    <th className="num">Spam</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const i = r.audienceId ? latest[r.audienceId] : null;
                    const hot = i && isToday(i.sentAt);
                    const overGate = i && i.hardRate != null && i.hardRate > MAX_HARD_BOUNCE_RATE;
                    return (
                      <tr key={r.slug}>
                        <td>
                          <Link href={`/s/${r.slug}/newsletter`} className="lists-title">
                            <span className="lists-dot" style={{ background: r.accentHex }} />
                            {r.name}
                          </Link>
                        </td>
                        {!i ? (
                          <td colSpan={9} className="lists-muted">
                            {r.audienceId ? "Nothing sent yet" : "No Mailchimp audience connected"}
                          </td>
                        ) : (
                          <>
                            <td>
                              <span className={hot ? "lists-today" : undefined}>{hot ? "Today" : day(i.sentAt)}</span>
                              <span className="lists-muted"> &middot; {i.kind}</span>
                              <div className="lists-file" title={i.subject}>{i.subject}</div>
                            </td>
                            <td className="num">{n(i.delivered)}</td>
                            <td className="num">{n(i.opens)}</td>
                            <td className="num">{pct(i.openRate)}</td>
                            <td className="num">{n(i.clicks)}</td>
                            <td className="num">{pct(i.clickRate)}</td>
                            <td className={`num${overGate ? " is-low" : ""}`} title={`${i.hardBounces} hard bounces`}>
                              {pct(i.hardRate)}
                            </td>
                            <td className="num">{n(i.unsubscribed)}</td>
                            <td className="num">{n(i.complaints)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroller>
          )}
          <p className="lists-note" style={{ marginTop: 10 }}>
            Amber bounce means the issue went over {(MAX_HARD_BOUNCE_RATE * 100).toFixed(0)}%. One is a warning, two
            issues running and the title is blocked from sending until it clears. Bounces take Mailchimp several hours
            to finish counting, so an issue sent this morning will read low until the afternoon.
          </p>
        </section>
      )}

      {rows && (
        <section className="lists-card">
          <h2>eNewsletters sent, last {FLEET_SEND_WINDOW_DAYS} days</h2>
          <p className="lists-note">
            Every issue each title sent: the Monday briefing and the Thursday weekly. Open and click rates are averaged
            across the issues, weighted by how many each went to. From Mailchimp, refreshed every fifteen minutes.
          </p>
          {sendError ? (
            <p className="lists-note" style={{ color: "var(--neon-red)" }}>Could not read Mailchimp reports: {sendError}</p>
          ) : (
            <Scroller>
              <table className="lists-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th className="num">Issues</th>
                    <th className="num">Emails sent</th>
                    <th className="num">Open rate</th>
                    <th className="num">Click rate</th>
                    <th className="num">Unsubscribed</th>
                    <th className="num">Bounced</th>
                    <th>Last sent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = r.audienceId ? sends[r.audienceId] : null;
                    return (
                      <tr key={r.slug}>
                        <td>
                          <Link href={`/s/${r.slug}/newsletter`} className="lists-title">
                            <span className="lists-dot" style={{ background: r.accentHex }} />
                            {r.name}
                          </Link>
                        </td>
                        {!r.audienceId ? (
                          <td colSpan={7} className="lists-muted">No Mailchimp audience connected</td>
                        ) : !s || !s.issues ? (
                          <>
                            <td className="num">0</td>
                            <td className="num">–</td>
                            <td className="num">–</td>
                            <td className="num">–</td>
                            <td className="num">–</td>
                            <td className="num">–</td>
                            <td>{s?.last ? day(s.last.sentAt) : "Never"}</td>
                          </>
                        ) : (
                          <>
                            <td className="num" title={`${s.briefings} briefing, ${s.issues - s.briefings} weekly`}>
                              {n(s.issues)}
                            </td>
                            <td className="num">{n(s.emails)}</td>
                            <td className="num">{pct(s.openRate)}</td>
                            <td className="num">{pct(s.clickRate)}</td>
                            <td className="num">{n(s.unsubscribed)}</td>
                            <td className="num">{n(s.bounced)}</td>
                            <td>
                              {day(s.last.sentAt)}
                              <span className="lists-muted"> · {n(s.last.sent)} sent, {pct(s.last.open)} opened</span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroller>
          )}
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
