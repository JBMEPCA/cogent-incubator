// Read-only: which titles have Search Console and GA4 wired up, and whether the
// last liveness probe passed. Prints field NAMES and set/unset only — never a
// credential value. Run with: node scripts/check-analytics-wiring.mjs
import { listSites, credentialSummary } from "../lib/site.js";

const sites = await listSites();
if (!sites.length) console.log("no sites");

for (const site of sites) {
  const summary = await credentialSummary(site.id);
  const ga = summary.google_analytics;
  console.log(`\n${site.name}  (/s/${site.slug})  status=${site.status}`);
  console.log(`  google_analytics configured: ${ga.configured}`);
  console.log(`  healthy: ${ga.healthy}  checked: ${ga.checkedAt || "never"}`);
  if (ga.lastError) console.log(`  lastError: ${ga.lastError}`);
  for (const field of ["gscSiteUrl", "ga4PropertyId"]) {
    const v = ga.fields?.[field];
    console.log(`  ${field}: ${v ? "set" : "NOT SET"}`);
  }
}
process.exit(0);
