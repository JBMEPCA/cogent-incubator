import Skeleton from "@/app/components/Skeleton";

// The fleet-level screens: the overview, group analytics, group costs, the
// interview pipeline, and adding a title.
//
// These have no Header of their own (each draws its own `.fleet-head`), so this
// stands in for the heading as well as the body. The title rail is in the root
// layout above this boundary, so it stays put throughout, which is what keeps a
// navigation feeling like a page changing rather than the app restarting.

export default function FleetLoading() {
  return (
    <main className="fleet-wrap" aria-busy="true">
      <header className="fleet-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="skel" style={{ display: "block", width: 120, height: 10, marginBottom: 12 }} />
          <span className="skel" style={{ display: "block", width: 240, height: 30 }} />
        </div>
      </header>
      <Skeleton panels={6} />
    </main>
  );
}
