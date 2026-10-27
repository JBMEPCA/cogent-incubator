import FleetNav from "@/app/components/FleetNav";
import SubTabs, { APP_SETTINGS_TABS } from "@/app/components/SubTabs";

/** The heading and sub-tabs every App settings page shares. */
export default function SettingsHead({ active }) {
  return (
    <>
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>App settings</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <SubTabs items={APP_SETTINGS_TABS} active={active} />
    </>
  );
}

/** What a read-only account sees instead of a settings page. */
export function AdminsOnly() {
  return (
    <section className="panel fleet-empty">
      <h1>Admins only</h1>
      <p>App settings can only be changed from an admin account.</p>
    </section>
  );
}
