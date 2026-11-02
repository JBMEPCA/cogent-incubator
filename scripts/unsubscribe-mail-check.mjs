/**
 * Mailto unsubscribes across every title's outreach mailbox: what has arrived,
 * and what honouring it changes. Dry run by default; --apply writes the same
 * changes the hourly interview sweep now makes (lib/unsubscribe-mail.js).
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/unsubscribe-mail-check.mjs [--apply] [--days=60]
 */
import { siteCredentials } from "../lib/site.js";
const { prisma, forSite } = await import("../lib/prisma.js");
const { processUnsubscribes } = await import("../lib/unsubscribe-mail.js");
const { titleAddresses } = await import("../lib/inbox-labels.js");

const APPLY = process.argv.includes("--apply");
const DAYS = Number((process.argv.find((a) => a.startsWith("--days=")) || "").slice(7)) || 60;

let fleet = [];
try { fleet = [...(await titleAddresses()).keys()]; } catch (e) { console.log("titleAddresses failed:", e.message); }

const sites = await prisma.site.findMany({ orderBy: { slug: "asc" } });
let total = 0;
for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const r = await processUnsubscribes(site, { db: forSite(site.id), outreach: creds?.outreach, foreignAddresses: fleet, dryRun: !APPLY, days: DAYS });
  if (r.skipped) { console.log(`${site.slug}: ${r.skipped}`); continue; }
  console.log(`${site.slug}: ${r.found.length}`);
  for (const f of r.found) {
    total++;
    console.log(`  ${f.at.slice(0, 10)} ${f.from} -> opt-out key ${f.key}${f.alreadyOptedOut ? " (already opted out)" : ""}; declines: ${f.declines.join("; ") || "none open"}`);
  }
}
console.log(`\n${total} unsubscribe(s). ${APPLY ? "APPLIED." : "DRY RUN, nothing written."}`);
await prisma.$disconnect();
