import { canEdit } from "@/lib/permissions";
import { readAutomations } from "@/lib/automations";
import SettingsHead, { AdminsOnly } from "../SettingsHead";
import AutomationControl from "./AutomationControl";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automations" };

// Fleet-wide switches for the things that run on their own. A change takes
// effect from the next run; nothing already sent is recalled.

export default async function AutomationsPage() {
  if (!(await canEdit())) {
    return (
      <main className="fleet-wrap">
        <SettingsHead active="/settings/automations" />
        <AdminsOnly />
      </main>
    );
  }

  const automations = await readAutomations();

  return (
    <main className="fleet-wrap">
      <SettingsHead active="/settings/automations" />

      <section className="panel acct-panel">
        <h2>Automations</h2>
        <p className="micro auto-intro">
          Switches for the things that run on their own, across every title. A change applies from the next run and
          saves the moment you click. Each title keeps its own on/off for the engine and its newsletter in its own
          Settings.
        </p>

        {/* A preview deployment shares production's database, so these are
            the live switches; and the two pauses are only obeyed by code that
            has been merged. Said on the page, where the click happens. */}
        {process.env.VERCEL_ENV === "preview" && (
          <p className="auto-warn auto-preview-note">
            This is a test deployment, but it shares the live database: changing a switch here changes it for the live
            app. The eNewsletter and drip pauses only take effect once this version is live.
          </p>
        )}

        <ul className="auto-list">
          {automations.map((a) => (
            <li key={a.key} className="auto-row">
              <div className="auto-what">
                <b>{a.label}</b>
                <p className="micro">{a.detail}</p>
                {a.envOff && (
                  <p className="auto-warn">
                    Also switched off in Vercel ({a.env}=false), so it stays off whatever is set here.
                  </p>
                )}
              </div>
              <AutomationControl automationKey={a.key} value={a.value} options={a.options} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
