/**
 * Turn a title's weekly newsletter on or off.
 *
 * This is the switch that decides whether Thursday's cron sends a real issue to
 * a real audience, so it prints what it is about to do — the audience name and
 * its live subscriber count — rather than flipping a boolean silently.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/set-newsletter-enabled.mjs <slug> on|off
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { mc, sendingDomainReady } from "../lib/newsletter.js";

const [slug, state] = process.argv.slice(2);
if (!slug || !["on", "off"].includes(state)) {
  console.error("usage: scripts/set-newsletter-enabled.mjs <slug> on|off");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
if (!site) { console.error(`No title with slug "${slug}".`); process.exit(1); }

const row = await prisma.siteCredential.findFirst({ where: { siteId: site.id, kind: "mailchimp" } });
const mailchimp = row ? decryptJson(row.payloadEnc) : null;

if (state === "on") {
  // Refuse to arm a send that would fail or misfire on Thursday morning.
  if (!mailchimp?.audienceId) { console.error(`  ${slug}: no mailchimp credential — refusing`); process.exit(1); }
  const domain = await sendingDomainReady(mailchimp.fromEmail);
  if (!domain.ok) { console.error(`  ${slug}: ${domain.why} — refusing`); process.exit(1); }
  const list = await mc(`/lists/${mailchimp.audienceId}?fields=name,stats.member_count`);
  console.log(`  audience : ${list.name} (${list.stats.member_count} subscribers)`);
  console.log(`  from     : ${mailchimp.fromEmail} (verified and authenticated)`);
}

const updated = await prisma.site.update({
  where: { id: site.id },
  data: { newsletterEnabled: state === "on" },
  select: { name: true, newsletterEnabled: true },
});
console.log(`  ${updated.name}: newsletterEnabled = ${updated.newsletterEnabled}`);
await prisma.$disconnect();
