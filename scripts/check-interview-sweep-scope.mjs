/**
 * Proves runInterviewSweep only ever reads its own title's interview rows.
 *
 * InterviewTarget is not in TENANTED (lib/prisma.js), so forSite() does not
 * scope it and every query in the sweep has to carry siteId itself. On 14 Sep
 * 2026 they did not: each title's sweep chased the whole fleet's queue under its
 * own name, and nine people were chased by a magazine that had never written to
 * them. This runs the sweep against a fake db that records every interviewTarget
 * query and fails if any of them is missing the site's id.
 *
 * No network, no database. Run it after touching the sweep:
 *   node --import ./scripts/node-resolve-hook.mjs scripts/check-interview-sweep-scope.mjs
 */

import { runInterviewSweep } from "../lib/interviews.js";

const SITE = { id: "site-under-test", slug: "check", name: "Check Title" };
const seen = [];

const record = (op) => async (args = {}) => {
  seen.push({ op, where: args.where });
  return op === "count" ? 0 : op === "groupBy" || op === "findMany" ? [] : null;
};
const table = new Proxy({}, { get: (_, op) => record(op) });
const db = new Proxy(
  {},
  {
    get: (_, model) =>
      model === "interviewTarget"
        ? table
        : new Proxy({}, { get: () => async () => null }),
  }
);

const creds = {
  outreach: {
    provider: "gmail",
    fromEmail: "check@example.com",
    fromName: "Check",
    gmailUser: "check@example.com",
  },
};

await runInterviewSweep(SITE, {
  db,
  creds,
  anthropic: null,
  siteUrl: "https://example.com",
  draft: async () => ({}),
});

const reads = seen.filter((q) => ["findMany", "findFirst", "count", "groupBy", "updateMany"].includes(q.op));
const leaks = reads.filter((q) => q.where?.siteId !== SITE.id);

console.log(`interviewTarget queries recorded: ${reads.length}`);
if (reads.length < 4) {
  console.error("FAIL: the sweep stopped early, so this proves nothing. Check the fake creds still pass isGmailConfigured().");
  process.exit(1);
}
if (leaks.length) {
  console.error(`FAIL: ${leaks.length} unscoped quer${leaks.length === 1 ? "y" : "ies"}:`);
  for (const l of leaks) console.error(`  ${l.op} ${JSON.stringify(l.where)}`);
  process.exit(1);
}
console.log("PASS: every interviewTarget query in the sweep is scoped to its own title.");
