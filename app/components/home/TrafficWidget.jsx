import { Widget, WidgetNote } from "./Widget";
import TrafficCard from "./TrafficCard";
import { fleetTraffic } from "@/lib/fleet-traffic";

// Visitors across every title GA4 can see, with the card's own period switch.
// Google is asked once per title for every period (cached for fifteen
// minutes), so the page streams this in rather than waiting on it, and the
// switch never goes back to the server.
export default async function TrafficWidget() {
  let data = null;
  try {
    data = await fleetTraffic();
  } catch {
    data = null;
  }

  if (!data?.periods || !data.connected) {
    return (
      <Widget span={8} className="dw-traffic" title="Fleet traffic" href="/analytics" linkLabel="Open analytics">
        <WidgetNote>No GA4 figures yet. Connect Google Analytics on a title to see traffic here.</WidgetNote>
      </Widget>
    );
  }
  return <TrafficCard data={data} />;
}
