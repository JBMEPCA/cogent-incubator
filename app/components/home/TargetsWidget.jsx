import TargetsCard from "./TargetsCard";
import { METRICS, monthKey, monthName, monthStart, targetsInForce, ringMetrics, fleetSum } from "@/lib/monthly-targets";

/**
 * The rings at the top of the home page: the fleet's month so far against
 * one target per measure. `actuals` is per title and worked out once by the
 * page, because the title cards read the same figures.
 */
export default async function TargetsWidget({ sites, actuals, targets, canEdit }) {
  const thisMonth = targets.month;
  const [next, prev, rings] = await Promise.all([
    targetsInForce(monthKey(new Date(), 1)),
    targetsInForce(monthKey(new Date(), -1)),
    ringMetrics(),
  ]);

  // Fleet totals; null where no title has a reading yet (not connected).
  const fleet = Object.fromEntries(
    METRICS.map((m) => [m.key, sites.some((s) => actuals[s.id]?.[m.key] != null) ? fleetSum(actuals, m.key) : null])
  );

  const ringsData = METRICS.filter((m) => rings.includes(m.key)).map((m) => ({
    metric: m.key,
    actual: fleet[m.key],
    target: Number(targets.values[m.key]) || 0,
  }));

  // How far through the month we are, 0–1: where each ring should have got to
  // by now if the month runs evenly.
  const from = monthStart(thisMonth).getTime();
  const to = monthStart(monthKey(new Date(from), 1)).getTime();
  const pace = Math.min(1, Math.max(0, (new Date().getTime() - from) / (to - from)));

  return (
    <TargetsCard
      pace={pace}
      monthLabel={monthName(thisMonth)}
      ringsData={ringsData}
      months={[
        { month: thisMonth, values: targets.values, carriedFrom: targets.carriedFrom },
        {
          month: next.month,
          values: next.saved ? next.values : targets.values,
          carriedFrom: next.saved ? null : thisMonth,
        },
      ]}
      prev={{ month: prev.month, values: prev.values }}
      actuals={fleet}
      rings={rings}
      canEdit={canEdit}
    />
  );
}
