/**
 * Store the wave-7 titles' WordPress credentials.
 *
 * The credentials are READ FROM A FILE OUTSIDE THE REPO, deliberately. An
 * application password hardcoded in a script is an application password in
 * git history for ever, and this codebase already has 24,470 people's contact
 * details pushed to a GitHub repo because that lesson was learned late.
 *
 * The file is a JSON object of { "<slug>": { url, user, appPassword } }, or
 * the { sites: { ... } } wrapper the launch scratchpad uses. Keep it in a
 * scratchpad or somewhere else git never sees, and delete it afterwards: the
 * encrypted row in the database is the system of record once this has run.
 *
 * Run: node --env-file=.env scripts/seed-wave7-wordpress-credentials.mjs <path-to-creds.json>
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { encryptJson } from "../lib/crypto.js";
import { probeCredential } from "../lib/probe.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: node --env-file=.env scripts/seed-wave7-wordpress-credentials.mjs <path-to-creds.json>");
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const entries = Object.entries(raw.sites ?? raw).filter(([k]) => !k.startsWith("_"));

const prisma = new PrismaClient();
let stored = 0, green = 0;
for (const [slug, c] of entries) {
  const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!site) { console.log(`${slug.padEnd(26)} NO SUCH TITLE, skipped`); continue; }

  const payload = { url: c.url, username: c.user ?? c.username, appPassword: c.appPassword };
  await prisma.siteCredential.upsert({
    where: { siteId_kind: { siteId: site.id, kind: "wordpress" } },
    create: { siteId: site.id, kind: "wordpress", payloadEnc: encryptJson(payload) },
    update: { payloadEnc: encryptJson(payload), healthy: null, lastError: null, checkedAt: null },
  });
  stored++;

  const result = await probeCredential("wordpress", payload);
  await prisma.siteCredential.update({
    where: { siteId_kind: { siteId: site.id, kind: "wordpress" } },
    data: { healthy: result.ok, lastError: result.ok ? null : String(result.error).slice(0, 300), checkedAt: new Date() },
  });
  if (result.ok) green++;
  // Never print the payload. The probe's own message is safe: it reports the
  // user and role it found, not the secret it used to find them.
  console.log(`${slug.padEnd(26)} stored, probe ${result.ok ? "GREEN" : "RED: " + result.error}`);
}
console.log(`\n${stored} stored, ${green} probing green.`);
await prisma.$disconnect();
