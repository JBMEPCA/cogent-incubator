// Store one title's outreach sending identity in SiteCredential, then prove
// it against Google — the same row shape migrate-credential.mjs stores for
// Smart SME. There is nothing secret in the payload (a from address, a
// display name, a postal address); it is encrypted because every
// SiteCredential row is.
//
//   node --env-file=.env scripts/seed-outreach-credential.mjs <slug> <fromEmail> [fromName] [postalAddress]
//
// replyTo is set to fromEmail: replies belong in the mailbox that sent.
// Idempotent — re-running overwrites the same row and re-probes.
import { PrismaClient } from "@prisma/client";
import { encryptJson } from "../lib/crypto.js";
import { probeCredential } from "../lib/probe.js";

const [slug, fromEmail, fromName = "James Burke", postalAddress = "Cogent Multimedia Ltd, 5 Jubilee Way, Faversham, Kent"] =
  process.argv.slice(2);

if (!slug || !fromEmail) {
  console.error("usage: node --env-file=.env scripts/seed-outreach-credential.mjs <slug> <fromEmail> [fromName] [postalAddress]");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) {
  console.error(`No title with slug "${slug}".`);
  process.exit(1);
}

const payload = { fromEmail, fromName, replyTo: fromEmail, postalAddress };

await prisma.siteCredential.upsert({
  where: { siteId_kind: { siteId: site.id, kind: "outreach" } },
  create: { siteId: site.id, kind: "outreach", payloadEnc: encryptJson(payload) },
  update: { payloadEnc: encryptJson(payload), healthy: null, lastError: null, checkedAt: null },
});

const result = await probeCredential("outreach", payload);
await prisma.siteCredential.update({
  where: { siteId_kind: { siteId: site.id, kind: "outreach" } },
  data: {
    healthy: result.ok,
    lastError: result.ok ? result.warning || null : String(result.error).slice(0, 500),
    checkedAt: new Date(),
  },
});

console.log(`${site.name}: outreach ${result.ok ? "OK" : "FAIL"} ${result.ok ? result.detail || "" : result.error}`);
if (result.ok && result.warning) console.log(`  note: ${result.warning}`);
await prisma.$disconnect();
process.exit(result.ok ? 0 : 2);
