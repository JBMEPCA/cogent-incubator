/**
 * Import one title's next tranche into Mailchimp, from this machine.
 *
 * The cron route does the same job across the whole fleet. This exists because
 * a launch import wants to be deliberate about one title at a time — and
 * because running it locally uses the working tree's merge-field definitions
 * rather than whatever is currently deployed to Vercel.
 *
 * Everything that matters still happens inside runDrip(): the bounce-rate gate,
 * the merge fields, the tranche tag and the importedAt stamp. This only chooses
 * the site and the size.
 *
 * Run: node --env-file=.env scripts/import-tranche.mjs <slug> [size]
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { runDrip, prospectStats } from "../lib/prospects.js";

const [slug, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg) || 1000;
if (!slug) {
  console.error("usage: node --env-file=.env scripts/import-tranche.mjs <slug> [size]");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }

const row = await prisma.siteCredential.findFirst({ where: { siteId: site.id, kind: "mailchimp" } });
if (!row) { console.error(`${slug} has no mailchimp credential.`); process.exit(1); }
const mailchimp = decryptJson(row.payloadEnc);

const before = await prospectStats(site.id);
console.log(`${site.name}: ${before.readyToImport} ready, importing up to ${size} into audience ${mailchimp.audienceId}`);

const result = await runDrip(site, { mailchimp, size });
console.log(JSON.stringify(result, null, 2));

const after = await prospectStats(site.id);
console.log(`remaining ready to import: ${after.readyToImport}`);
await prisma.$disconnect();
