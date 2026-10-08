import FleetNav from "@/app/components/FleetNav";
import EngineHub from "@/app/components/EngineHub";

export const dynamic = "force-dynamic";

export const metadata = { title: "Engine hub" };

export default function EngineHubPage() {
  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Engine hub</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <EngineHub />
    </main>
  );
}
