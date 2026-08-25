/**
 * Pin the lead article for a title's next issue.
 *
 * The agent re-ranks from scratch on every run, so telling it "lead with the
 * Stourbridge story" only holds for the run you watched. This records the
 * decision against the title, and both the proof and Thursday's cron honour it.
 * A real send consumes the pin — it leads one issue, not every issue after.
 *
 * Matches on a case-insensitive substring of the headline, and refuses rather
 * than guesses when a phrase matches more than one article.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/pin-lead.mjs <slug> "<headline fragment>"
 *      ... --clear   to remove the pin
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { fetchCandidates, setLeadPin, getLeadPin } from "../lib/newsletter.js";

const [slug, phrase] = process.argv.slice(2);
const clear = process.argv.includes("--clear");
if (!slug || (!phrase && !clear)) {
  console.error('usage: scripts/pin-lead.mjs <slug> "<headline fragment>" | <slug> --clear');
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }

if (clear) {
  await setLeadPin(site, null);
  console.log(`${site.name}: lead pin cleared`);
  await prisma.$disconnect();
  process.exit(0);
}

const wpRow = await prisma.siteCredential.findFirst({ where: { siteId: site.id, kind: "wordpress" } });
const candidates = await fetchCandidates(wpRow ? decryptJson(wpRow.payloadEnc) : null, 40, site);

const needle = phrase.toLowerCase();
const matches = candidates.filter((c) => c.title.toLowerCase().includes(needle));

if (!matches.length) {
  console.error(`No article in ${site.name}'s current window matches "${phrase}".`);
  console.error("Available:");
  candidates.slice(0, 15).forEach((c) => console.error(`   ${c.title.slice(0, 78)}`));
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`"${phrase}" matches ${matches.length} articles — be more specific:`);
  matches.forEach((c) => console.error(`   ${c.title.slice(0, 78)}`));
  process.exit(1);
}

await setLeadPin(site, matches[0].id);
console.log(`${site.name}: lead pinned`);
console.log(`   ${matches[0].title}`);
console.log(`   id ${matches[0].id}, verified stored as ${await getLeadPin(site)}`);
await prisma.$disconnect();
