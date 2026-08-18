// Read-only: does every number on /analytics actually pull through?
//
// Prints what fleetAnalytics() returns and checks the page's internal
// arithmetic — the fleet totals against the sum of the rows, and each donut
// against the total it is drawn around. A donut that does not add up to the
// figure in its own centre is the failure mode this is here to catch, because
// it looks completely fine on screen.
//
// Run with: node scripts/check-fleet-analytics.mjs
import { fleetAnalytics } from "../lib/fleet-analytics.js";

const n = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
const money = (v) => `$${(v || 0).toFixed(2)}`;

const problems = [];
const check = (label, a, b, tolerance = 0.5) => {
  const ok = Math.abs((a || 0) - (b || 0)) <= tolerance;
  if (!ok) problems.push(`${label}: page shows ${a}, rows add to ${b}`);
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${label.padEnd(34)} ${n(a)}  vs rows ${n(b)}`);
};

const sum = (rows, pick) => rows.reduce((t, r) => t + (pick(r) || 0), 0);

const data = await fleetAnalytics();
const { rows, titleOrder, totals, trend, channels, topPages, topQueries, connected, windowDays } = data;

console.log(`\nWindow: ${windowDays} days`);
console.log(`Titles: ${connected.total}  ·  Search Console: ${connected.gsc}  ·  GA4: ${connected.ga4}`);
console.log(`Colour order (oldest first): ${titleOrder.join(" → ")}`);

console.log("\n── Per title ────────────────────────────────────────────────");
for (const r of rows) {
  console.log(`\n${r.name}  (/s/${r.slug})  status=${r.status}`);
  console.log(`  published ${windowDays}d ${String(r.publishedWindow).padStart(4)}   pipeline ${String(r.pipeline).padStart(3)}   awaiting ${String(r.awaiting).padStart(4)}   spend ${money(r.spendMonth)}`);
  if (r.ga4) {
    console.log(`  GA4    users ${n(r.ga4.users)}  sessions ${n(r.ga4.sessions)}  views ${n(r.ga4.pageViews)}  live ${r.ga4.liveUsers}  trend days ${r.ga4.trend.length}`);
  } else {
    console.log(`  GA4    not connected`);
  }
  if (r.gsc) {
    console.log(`  GSC    clicks ${n(r.gsc.clicks)}  impressions ${n(r.gsc.impressions)}  pos ${r.gsc.position?.toFixed(1)}  trend days ${r.gsc.trend.length}`);
  } else {
    console.log(`  GSC    not connected`);
  }
  for (const e of r.errors || []) console.log(`  note   ${e}`);
}

console.log("\n── Fleet totals vs the sum of the rows ──────────────────────");
check("published (28d)", totals.publishedWindow, sum(rows, (r) => r.publishedWindow));
check("pipeline", totals.pipeline, sum(rows, (r) => r.pipeline));
check("awaiting", totals.awaiting, sum(rows, (r) => r.awaiting));
check("spend, month", totals.spendMonth, sum(rows, (r) => r.spendMonth), 0.005);
check("users", totals.users, sum(rows, (r) => r.ga4?.users));
check("sessions", totals.sessions, sum(rows, (r) => r.ga4?.sessions));
check("page views", totals.pageViews, sum(rows, (r) => r.ga4?.pageViews));
check("clicks", totals.clicks, sum(rows, (r) => r.gsc?.clicks));
check("impressions", totals.impressions, sum(rows, (r) => r.gsc?.impressions));

console.log("\n── Donuts add up to the figure in their centre ──────────────");
check("readers donut", totals.sessions, sum(rows, (r) => r.ga4?.sessions));
check("output donut", totals.publishedWindow, sum(rows, (r) => r.publishedWindow));
check("clicks donut", totals.clicks, sum(rows, (r) => r.gsc?.clicks));
check("spend donut", totals.spendMonth, sum(rows, (r) => r.spendMonth), 0.005);
// Channels come from a separate GA4 report than the session total, so they can
// legitimately disagree by a little. A big gap means the donut is missing a
// channel and its centre figure is lying about what the slices cover.
const channelSum = channels.reduce((t, c) => t + c.sessions, 0);
const drift = totals.sessions ? Math.abs(channelSum - totals.sessions) / totals.sessions : 0;
console.log(`  ${drift <= 0.02 ? "OK  " : "WARN"}  ${"channel donut".padEnd(34)} ${n(totals.sessions)}  vs channels ${n(channelSum)}  (${(drift * 100).toFixed(1)}% drift)`);
if (drift > 0.02) problems.push(`channel donut drifts ${(drift * 100).toFixed(1)}% from the session total`);

console.log("\n── Derived figures ─────────────────────────────────────────");
const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
console.log(`  CTR              ${totals.ctr.toFixed(2)}%   (recomputed ${ctr.toFixed(2)}%)`);
console.log(`  Avg position     ${totals.position?.toFixed(2) ?? "—"}  impression-weighted`);
console.log(`  Avg session      ${Math.floor(totals.avgDuration / 60)}:${String(Math.round(totals.avgDuration % 60)).padStart(2, "0")}  session-weighted`);
console.log(`  Live now         ${totals.liveUsers}`);
if (Math.abs(totals.ctr - ctr) > 0.01) problems.push("CTR does not match clicks/impressions");
// A weighted average outside the range of its inputs means the weights are wrong.
const positions = rows.filter((r) => r.gsc).map((r) => r.gsc.position);
if (positions.length && totals.position != null) {
  const lo = Math.min(...positions), hi = Math.max(...positions);
  if (totals.position < lo - 0.01 || totals.position > hi + 0.01) {
    problems.push(`fleet position ${totals.position.toFixed(2)} sits outside the per-title range ${lo.toFixed(1)}–${hi.toFixed(1)}`);
  }
}

console.log("\n── Charts have something to draw ───────────────────────────");
console.log(`  audience trend   ${trend.audience.length} days  peak ${n(Math.max(0, ...trend.audience.map((d) => d.users)))} users`);
console.log(`  search trend     ${trend.search.length} days  peak ${n(Math.max(0, ...trend.search.map((d) => d.impressions)))} impressions`);
console.log(`  channels         ${channels.length}  (${channels.map((c) => c.channel).join(", ") || "none"})`);
console.log(`  top pages        ${topPages.length}`);
console.log(`  top queries      ${topQueries.length}`);
// Merged series must not be longer than the longest title's own series — if it
// is, dates are failing to line up and every day is being counted twice.
const longestGa4 = Math.max(0, ...rows.filter((r) => r.ga4).map((r) => r.ga4.trend.length));
if (trend.audience.length > longestGa4) {
  problems.push(`merged audience trend has ${trend.audience.length} days but the longest title has ${longestGa4} — dates are not lining up`);
}
const longestGsc = Math.max(0, ...rows.filter((r) => r.gsc).map((r) => r.gsc.trend.length));
if (trend.search.length > longestGsc) {
  problems.push(`merged search trend has ${trend.search.length} days but the longest title has ${longestGsc} — dates are not lining up`);
}
// Every slice needs a colour, or a donut segment renders black.
const missingColour = titleOrder.length !== new Set(titleOrder).size ? "duplicate slugs in colour order" : null;
if (missingColour) problems.push(missingColour);

console.log(
  problems.length
    ? `\n${problems.length} PROBLEM(S):\n` + problems.map((p) => `  - ${p}`).join("\n") + "\n"
    : "\nAll checks passed.\n"
);
process.exit(problems.length ? 1 : 0);
