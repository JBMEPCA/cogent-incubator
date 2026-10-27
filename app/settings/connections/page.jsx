import Link from "next/link";
import { canEdit } from "@/lib/permissions";
import { SHARED_SERVICES, TITLE_KINDS, lastSharedChecks, titleHealth } from "@/lib/connections";
import Scroller from "@/app/components/Scroller";
import SettingsHead, { AdminsOnly } from "../SettingsHead";
import CheckButton from "./CheckButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connections" };

// Whether each outside service is answering. The shared services are checked
// on demand (a button, not every page load, so opening the page costs nothing);
// the per-title grid shows what each title's own credential probe last found.

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

function Dot({ state }) {
  return <span className={`conn-dot is-${state}`} aria-hidden="true" />;
}

const STATE_LABEL = { ok: "Working", bad: "Failing", unknown: "Not checked yet", none: "Not set up" };

export default async function ConnectionsPage() {
  if (!(await canEdit())) {
    return (
      <main className="fleet-wrap">
        <SettingsHead active="/settings/connections" />
        <AdminsOnly />
      </main>
    );
  }

  const [last, titles] = await Promise.all([lastSharedChecks(), titleHealth()]);
  const results = last?.results || {};

  return (
    <main className="fleet-wrap">
      <SettingsHead active="/settings/connections" />

      <section className="panel acct-panel">
        <div className="acct-head">
          <div>
            <h2>Shared services</h2>
            <p className="micro">
              One account each, used by every title. Each check is a single read-only call that changes nothing.
              {last ? ` Last checked ${when(last.at)}.` : " Not checked yet."}
            </p>
          </div>
          <CheckButton which="shared" label="Check now" busyLabel="Checking…" />
        </div>

        <ul className="conn-list">
          {SHARED_SERVICES.map((s) => {
            const r = results[s.key];
            const state = !r ? "unknown" : r.ok ? "ok" : "bad";
            return (
              <li key={s.key} className="conn-row">
                <Dot state={state} />
                <div className="conn-what">
                  <b>{s.label}</b>
                  <span className="micro">{s.what}</span>
                </div>
                <div className={`conn-result is-${state}`}>
                  {!r ? STATE_LABEL.unknown : r.ok ? r.detail || "Working" : r.error}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel acct-panel">
        <div className="acct-head">
          <div>
            <h2>Each title</h2>
            <p className="micro">
              Every title&apos;s own connections, as last checked. A red dot is worth fixing in that title&apos;s
              Settings; hover it for the reason.
            </p>
          </div>
          <CheckButton which="titles" label="Recheck all titles" busyLabel="Rechecking…" />
        </div>

        <Scroller>
          <table className="lists-table conn-table">
            <thead>
              <tr>
                <th>Title</th>
                {TITLE_KINDS.map((k) => (
                  <th key={k.kind}>{k.label}</th>
                ))}
                <th>Social posting</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((t) => (
                <tr key={t.slug}>
                  <td>
                    <Link href={`/s/${t.slug}/settings`} className="lists-title">
                      <span className="lists-dot" style={{ background: t.accentHex }} />
                      {t.name}
                    </Link>
                  </td>
                  {[...TITLE_KINDS.map((k) => k.kind), "social"].map((kind) => {
                    const c = t.cells[kind];
                    const tip = [STATE_LABEL[c.state], c.error, c.checkedAt && `checked ${when(c.checkedAt)}`]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <td key={kind} title={tip}>
                        <span className="conn-cell">
                          <Dot state={c.state} />
                          <span className={c.state === "bad" ? "conn-bad-text" : "lists-muted"}>
                            {c.state === "bad" ? c.error || "Failing" : c.label || STATE_LABEL[c.state]}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      </section>
    </main>
  );
}
