/**
 * Store a title's Mailchimp audience id and from-address.
 *
 * Fleet and Golf had audiences and authenticated sending domains but no
 * `mailchimp` credential row, and both the newsletter and the subscriber drip
 * check `mailchimp.audienceId` before doing anything — so their prospects would
 * have sat in the database while the crons skipped them, reporting success.
 *
 * Run: node --env-file=.env scripts/seed-mailchimp-credential.mjs <slug> <audienceId> <fromEmail>
 */

import { PrismaClient } from "@prisma/client";
import { encryptJson } from "../lib/crypto.js";
import { probeCredential } from "../lib/probe.js";

const [slug, audienceId, fromEmail] = process.argv.slice(2);
if (!slug || !audienceId || !fromEmail) {
  console.error("usage: node --env-file=.env scripts/seed-mailchimp-credential.mjs <slug> <audienceId> <fromEmail>");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }

const payload = { audienceId, fromEmail };
await prisma.siteCredential.upsert({
  where: { siteId_kind: { siteId: site.id, kind: "mailchimp" } },
  create: { siteId: site.id, kind: "mailchimp", payloadEnc: encryptJson(payload) },
  update: { payloadEnc: encryptJson(payload), healthy: null, lastError: null, checkedAt: null },
});

const result = await probeCredential("mailchimp", payload);
await prisma.siteCredential.update({
  where: { siteId_kind: { siteId: site.id, kind: "mailchimp" } },
  data: {
    healthy: result.ok,
    lastError: result.ok ? result.warning || null : String(result.error).slice(0, 500),
    checkedAt: new Date(),
  },
});

console.log(`${site.name}: mailchimp credential stored — probe ${result.ok ? "OK" : "FAILED"}${result.ok ? ` (${result.detail ?? ""})` : `: ${result.error}`}`);
await prisma.$disconnect();
