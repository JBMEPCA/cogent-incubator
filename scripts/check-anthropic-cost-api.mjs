// Read-only: can this account read Anthropic's own spend figures?
//
// There is no balance or remaining-credits endpoint anywhere in the Anthropic
// API — the closest thing is /v1/organizations/cost_report, which reports what
// has been SPENT over a date range. That endpoint needs an Admin API key
// (sk-ant-admin01-...), and the Admin API is unavailable to individual
// accounts, so this script answers both questions at once: do we have a key of
// the right kind, and does the organisation behind it allow the call.
//
// Prints key SHAPE only — never a key value. Run with:
//   node --env-file=.env scripts/check-anthropic-cost-api.mjs
const key = process.env.ANTHROPIC_ADMIN_KEY || process.env.ANTHROPIC_API_KEY;

if (!key) {
  console.log("No ANTHROPIC_ADMIN_KEY or ANTHROPIC_API_KEY set. Nothing to test.");
  process.exit(1);
}

const isAdminShaped = key.startsWith("sk-ant-admin");
console.log(`Key in use:        ${process.env.ANTHROPIC_ADMIN_KEY ? "ANTHROPIC_ADMIN_KEY" : "ANTHROPIC_API_KEY"}`);
console.log(`Admin-shaped:      ${isAdminShaped ? "yes (sk-ant-admin...)" : "NO — this is a standard API key"}`);
console.log(`Length:            ${key.length} chars`);

// A one-day window is enough to prove access; we care about the status code,
// not the figures.
const end = new Date();
const start = new Date(end.getTime() - 86400e3);
const iso = (d) => `${d.toISOString().slice(0, 19)}Z`;

const url =
  "https://api.anthropic.com/v1/organizations/cost_report" +
  `?starting_at=${iso(start)}&ending_at=${iso(end)}`;

console.log(`\nCalling ${url.split("?")[0]} ...`);

const res = await fetch(url, {
  headers: {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "User-Agent": "CogentIncubator/1.0 (spend tracker probe)",
  },
});

const body = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}`);

if (res.ok) {
  const data = JSON.parse(body);
  const buckets = data.data?.length ?? 0;
  console.log(`\nWORKS. ${buckets} bucket(s) returned.`);
  // Costs come back as decimal strings in cents.
  let cents = 0;
  for (const bucket of data.data || []) {
    for (const item of bucket.results || []) cents += Number(item.amount || 0);
  }
  console.log(`Spend in the last 24h: $${(cents / 100).toFixed(2)}`);
  console.log("\n→ A live spend figure can be pulled through.");
} else {
  // The message names the reason: wrong key kind, or an individual account
  // with no organisation behind it.
  let detail = body.slice(0, 300);
  try {
    detail = JSON.parse(body).error?.message ?? detail;
  } catch {}
  console.log(`\nBLOCKED: ${detail}`);
  console.log(
    isAdminShaped
      ? "\n→ Key is the right shape, so this is an account/permission problem."
      : "\n→ Expected: the Cost API rejects standard API keys. An Admin API key is required, and those can only be created by an organisation (not an individual account)."
  );
}
process.exit(res.ok ? 0 : 1);
