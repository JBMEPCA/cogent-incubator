/**
 * Re-push merge fields for contacts already in Mailchimp.
 *
 * runDrip() only ever looks at rows it has not imported, so a change to how a
 * merge field is DERIVED never reaches the contacts already up there — they
 * keep whatever was computed on the day they went in. This backfills them.
 *
 * Used after the INDUSTRY rule was corrected to prefer a title-relevant SIC
 * code over whichever one Apollo happened to list first, which had The Royal
 * and Ancient filed under "Amusement & Recreation Services".
 *
 * Sends only contacts whose values actually differ, so a no-op run costs one
 * read and nothing else. `update_existing` means this can never create a
 * member: a row deleted or unsubscribed in Mailchimp stays that way.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/refresh-merge-fields.mjs <slug> [--dry]
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc } from "../lib/newsletter.js";
import { industryFromSic } from "../lib/sic.js";

const [slug] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
if (!slug) {
  console.error("usage: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/refresh-merge-fields.mjs <slug> [--dry]");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }
const row = await prisma.siteCredential.findFirst({ where: { siteId: site.id, kind: "mailchimp" } });
if (!row) { console.error(`${slug} has no mailchimp credential.`); process.exit(1); }
const { audienceId } = decryptJson(row.payloadEnc);

const imported = await prisma.newsletterProspect.findMany({
  where: { siteId: site.id, importedAt: { not: null } },
  select: { email: true, firstName: true, lastName: true, title: true, company: true, companyCountry: true, domain: true, sic: true },
});

// What Mailchimp holds now, so only genuine differences are sent.
const current = new Map();
let offset = 0;
for (;;) {
  const page = await mc(`/lists/${audienceId}/members?count=1000&offset=${offset}&status=subscribed&fields=members.email_address,members.merge_fields,total_items`);
  for (const m of page.members ?? []) current.set(m.email_address.toLowerCase(), m.merge_fields ?? {});
  offset += 1000;
  if (offset >= (page.total_items ?? 0)) break;
}
console.log(`${site.name}: ${imported.length} imported locally, ${current.size} subscribed in Mailchimp`);

const desired = (p) => ({
  FNAME: p.firstName ?? "",
  LNAME: p.lastName ?? "",
  COMPANY: String(p.company ?? "").slice(0, 255),
  TITLE: String(p.title ?? "").slice(0, 255),
  COUNTRY: String(p.companyCountry ?? "").slice(0, 255),
  SIC: String(p.sic ?? "").slice(0, 255),
  INDUSTRY: String(industryFromSic(p.sic)).slice(0, 255),
  WEBSITE: String(p.domain ?? "").slice(0, 255),
});

const stale = [];
for (const p of imported) {
  const have = current.get(p.email);
  if (!have) continue; // not in the audience — leave it alone
  const want = desired(p);
  if (Object.entries(want).some(([k, v]) => String(have[k] ?? "") !== v)) {
    stale.push({ email: p.email, want });
  }
}
console.log(`${stale.length} contacts need updating`);
if (!stale.length || dry) {
  if (dry) stale.slice(0, 5).forEach((s) => console.log(`   ${s.email} → INDUSTRY="${s.want.INDUSTRY}"`));
  await prisma.$disconnect();
  process.exit(0);
}

let updated = 0;
const errors = [];
for (let i = 0; i < stale.length; i += 500) {
  const res = await mc(`/lists/${audienceId}`, {
    method: "POST",
    body: JSON.stringify({
      update_existing: true,
      members: stale.slice(i, i + 500).map((s) => ({
        email_address: s.email,
        email_type: "html",
        status_if_new: "subscribed",
        merge_fields: s.want,
      })),
    }),
  });
  updated += res.total_updated ?? 0;
  (res.errors ?? []).forEach((e) => errors.push(`${e.email_address}: ${e.error}`));
}
console.log(`updated: ${updated}${errors.length ? `, errors: ${errors.length}` : ""}`);
errors.slice(0, 5).forEach((e) => console.log(`   ${e}`));
await prisma.$disconnect();
