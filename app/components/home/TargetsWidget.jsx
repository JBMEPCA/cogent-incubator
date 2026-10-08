import TargetsCard from "./TargetsCard";
import { WidgetNote, Widget } from "./Widget";
import { METRICS, monthKey, monthName, targetsInForce, ringMetrics, fleetSum } from "@/lib/monthly-targets";

/**
 * The rings at the top of the home page. `actuals` and `targets` are worked
 * out once by the page, because the title cards under it read the same
 * figures; a second query would let the two drift.
 */
export default async function TargetsWidget({ sites, actuals, targets, canEdit }) {
  if (!targets) {
    return (
      <Widget span={12} title="Targets" href="/analytics" linkLabel="Open analytics">
        <WidgetNote>The targets table isn&apos;t in the database yet. Run the monthly_targets migration.</WidgetNote>
      </Widget>
    );
  }

  const thisMonth = targets.month;
  const [next, prev, rings] = await Promise.all([
    targetsInForce(monthKey(new Date(), 1)),
    targetsInForce(monthKey(new Date(), -1)),
    ringMetrics(),
  ]);

  // A target only counts toward the fleet figure for the titles that have one,
  // but the actual counts every title: a title with no target still published
  // what it published.
  const ringsData = METRICS.filter((m) => rings.includes(m.key)).map((m) => {
    const anyReading = sites.some((s) => actuals[s.id]?.[m.key] != null);
    return {
      metric: m.key,
      actual: anyReading ? fleetSum(actuals, m.key) : null,
      target: fleetSum(targets.values, m.key),
    };
  });

  const titles = sites
    .map((s) => ({ id: s.id, name: s.name, accentHex: s.accentHex }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <TargetsCard
      monthLabel={monthName(thisMonth)}
      ringsData={ringsData}
      titles={titles}
      months={[
        { month: thisMonth, values: targets.values, carriedFrom: targets.carriedFrom },
        { month: next.month, values: next.saved ? next.values : targets.values, carriedFrom: next.saved ? null : thisMonth },
      ]}
      prev={{ month: prev.month, values: prev.values }}
      actuals={actuals}
      rings={rings}
      canEdit={canEdit}
    />
  );
}
