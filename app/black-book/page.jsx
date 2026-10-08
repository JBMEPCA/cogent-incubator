import FleetNav from "@/app/components/FleetNav";
import BlackBook from "@/app/components/BlackBook";
import { listSites } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = { title: "Black Book" };

// The full Black Book: the add form with notes and follow-up dates, every
// contact with editing, and the CSV export. The home page has the quick
// version.
export default async function BlackBookPage() {
  const sites = await listSites();
  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Black Book</h1>
        </div>
        <div className="fleet-head-right">
          <FleetNav />
        </div>
      </header>
      <BlackBook sites={sites} />
    </main>
  );
}
