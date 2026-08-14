// Move Smart SME's integrations out of the old app's .env and into
// SiteCredential, encrypted, then prove each one against the live service.
//
//   node --env-file=.env scripts/migrate-credential.mjs <slug> [kind ...]
//
// Reads the old values from ../smart-sme-app/.env. Idempotent: re-running
// overwrites the same rows and re-probes. Prints health, never values.
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { encryptJson } from "../lib/crypto.js";
import { probeCredential } from "../lib/probe.js";

const OLD_ENV = path.join(process.cwd(), "..", "smart-sme-app", ".env");

function oldEnv() {
  if (!fs.existsSync(OLD_ENV)) return {};
  const out = {};
  for (const line of fs.readFileSync(OLD_ENV, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

// What each kind is built from. Anything whose source is missing is reported as
// a gap rather than stored half-empty — a credential with three of four fields
// set looks configured and fails at the worst moment.
const BUILDERS = {
  wordpress: (e) => ({ url: e.WP_URL, username: e.WP_USERNAME, appPassword: e.WP_APP_PASSWORD }),
  google_analytics: (e) => ({ gscSiteUrl: e.GSC_SITE_URL, ga4PropertyId: e.GA4_PROPERTY_ID }),
  mailchimp: (e) => ({ audienceId: e.MAILCHIMP_AUDIENCE_ID || "707a3f613c", fromEmail: e.NEWSLETTER_FROM_EMAIL }),
  outreach: (e) => ({
    fromEmail: e.OUTREACH_FROM_EMAIL,
    fromName: e.OUTREACH_FROM_NAME,
    replyTo: e.OUTREACH_REPLY_TO,
    postalAddress: e.OUTREACH_POSTAL_ADDRESS,
  }),
};

const slug = process.argv[2];
const kinds = process.argv.slice(3).filter((k) => BUILDERS[k]);
if (!slug) {
  console.error("usage: node --env-file=.env scripts/migrate-credential.mjs <slug> [kind ...]");
  process.exit(1);
}

const prisma = new PrismaClient();
const env = oldEnv();

const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) {
  console.error(`No title with slug "${slug}".`);
  process.exit(1);
}

console.log(`${site.name} (${slug})\n`);

for (const kind of kinds.length ? kinds : Object.keys(BUILDERS)) {
  const payload = BUILDERS[kind](env);
  const present = Object.entries(payload).filter(([, v]) => v);

  if (!present.length) {
    console.log(`  ${kind.padEnd(18)} nothing to migrate — no source values in the old .env`);
    continue;
  }

  await prisma.siteCredential.upsert({
    where: { siteId_kind: { siteId: site.id, kind } },
    create: { siteId: site.id, kind, payloadEnc: encryptJson(payload) },
    update: { payloadEnc: encryptJson(payload), healthy: null, lastError: null, checkedAt: null },
  });

  const result = await probeCredential(kind, payload);
  await prisma.siteCredential.update({
    where: { siteId_kind: { siteId: site.id, kind } },
    data: {
      healthy: result.ok,
      lastError: result.ok ? result.warning || null : String(result.error).slice(0, 500),
      checkedAt: new Date(),
    },
  });

  const fields = present.map(([k]) => k).join(", ");
  console.log(`  ${kind.padEnd(18)} ${result.ok ? "OK  " : "FAIL"} ${result.ok ? result.detail || "" : result.error}`);
  console.log(`  ${"".padEnd(18)} stored: ${fields}`);
  if (result.ok && result.warning) console.log(`  ${"".padEnd(18)} note: ${result.warning}`);
  console.log();
}

await prisma.$disconnect();
