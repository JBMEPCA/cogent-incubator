// The measures and month helpers for monthly targets, with no database import,
// so the client-side editor can use them. See lib/monthly-targets.js.

/**
 * The measures a target can be set on. `ring` is the label under the gauge;
 * `cap` marks a ceiling rather than a goal, which turns the ring amber then red
 * as it fills instead of rewarding it. Spend is held in pounds, because that is
 * what Group costs shows and what anyone typing a budget will think in.
 */
export const METRICS = [
  { key: "articles", label: "Articles published", ring: "articles", color: "var(--neon-cyan)", step: 1 },
  { key: "visitors", label: "New visitors", ring: "visitors", color: "var(--neon-green)", step: 100 },
  { key: "backlinks", label: "Backlinks earned", ring: "backlinks", color: "var(--neon-violet)", step: 1 },
  { key: "subscribers", label: "Newsletter growth", ring: "sign-ups", color: "#f0abfc", step: 5 },
  { key: "spend", label: "Spend cap (£)", ring: "budget used", color: "var(--neon-amber)", step: 10, cap: true, money: true },
];
export const METRIC_KEYS = METRICS.map((m) => m.key);

// Which measures show as rings on the home page. Kept in GlobalSetting so the
// choice is the team's, not one browser's.
export const RINGS_KEY = "home_target_rings";
// Each month's fleet targets, as JSON: monthly_targets:2026-10.
export const TARGET_PREFIX = "monthly_targets:";
export const DEFAULT_RINGS = ["articles", "visitors", "backlinks", "spend"];

/** "2026-10" for the UTC month containing `d`, shifted by `offset` months. */
export function monthKey(d = new Date(), offset = 0) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  return x.toISOString().slice(0, 7);
}

export function monthStart(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function monthName(key, style = "long") {
  return monthStart(key).toLocaleDateString("en-GB", { month: style, timeZone: "UTC" });
}

