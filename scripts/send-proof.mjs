/**
 * Email a proof of this week's issue to named people.
 *
 * Goes through Mailchimp's own test-send, so what lands is what subscribers
 * would get: their template pipeline, their merge tags resolved, in a real mail
 * client rather than a browser. The draft campaign is deleted immediately after,
 * and nothing is sent to any audience.
 *
 * The newsletter toggle is bypassed IN MEMORY only, so a title that is not yet
 * cleared to send can still be proofed. Thursday's cron still obeys the toggle
 * as stored.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/send-proof.mjs <email,email> <slug> [<slug>...]
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { runNewsletter } from "../lib/newsletter.js";
import { wordmarkFor } from "../lib/brand/wordmarks.js";
import { LOGO_PNG } from "../lib/brand/logo.js";

const [emailArg, ...slugs] = process.argv.slice(2);
if (!emailArg || !slugs.length) {
  console.error("usage: scripts/send-proof.mjs <email,email> <slug> [<slug>...]");
  process.exit(1);
}
const testEmails = emailArg.split(",").map((e) => e.trim()).filter(Boolean);
console.log(`proofs go to: ${testEmails.join(", ")}\n`);

const prisma = new PrismaClient();
for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.log(`${slug}: no such title`); continue; }

  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
  const mark = wordmarkFor(site.slug)?.png ?? LOGO_PNG;

  console.log(`=== ${site.name} ===`);
  try {
    const res = await runNewsletter(
      { ...site, newsletterEnabled: true },
      { creds, testEmails, force: true, logoBase64: mark.toString("base64") }
    );
    if (res?.skipped) { console.log(`  SKIPPED: ${res.skipped}`); continue; }
    const out = res?.result ?? res;
    if (out?.proofSentTo) {
      console.log(`  SENT to ${out.proofSentTo.join(", ")}`);
      console.log(`  lead: ${out.stories[0].title}${out.leadPinned ? "  (pinned)" : ""}`);
    } else {
      console.log(`  unexpected: ${JSON.stringify(out).slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`  FAILED: ${e.message.slice(0, 300)}`);
  }
}
await prisma.$disconnect();
