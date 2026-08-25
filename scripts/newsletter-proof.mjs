/**
 * Build this week's issue for one or more titles WITHOUT sending it.
 *
 * Runs the real path — the same candidate fetch, the same agent selection, the
 * same link check, the same renderer — and stops short of creating a campaign.
 * Writes the rendered email to assets/newsletter-proofs/<slug>.html.
 *
 * The newsletter toggle is bypassed IN MEMORY, not in the database: the site
 * row is copied with newsletterEnabled true so a proof can be built for a title
 * that is not yet cleared to send. Nothing about the title's real settings
 * changes, and Thursday's cron still obeys the toggle as stored.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/newsletter-proof.mjs <slug> [<slug>...]
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { runNewsletter } from "../lib/newsletter.js";

const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error("usage: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/newsletter-proof.mjs <slug>...");
  process.exit(1);
}

const OUT = path.resolve("assets/newsletter-proofs");
fs.mkdirSync(OUT, { recursive: true });

const prisma = new PrismaClient();
for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.log(`${slug}: no such title`); continue; }

  const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
  const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));

  console.log(`\n=== ${site.name} ===`);
  try {
    const res = await runNewsletter(
      // newsletterEnabled forced on for this in-memory copy only.
      { ...site, newsletterEnabled: true },
      { creds, dryRun: true, force: true }
    );

    if (res?.skipped) { console.log(`  SKIPPED: ${res.skipped}`); continue; }
    const out = res?.result ?? res;
    if (!out?.html) { console.log(`  no proof produced: ${JSON.stringify(out).slice(0, 300)}`); continue; }

    const file = path.join(OUT, `${slug}.html`);
    fs.writeFileSync(file, out.html);
    console.log(`  subject : ${out.subject}`);
    console.log(`  from    : ${out.fromName}`);
    console.log(`  selection: ${out.summary}`);
    if (out.leadReason) console.log(`  lead why : ${String(out.leadReason).slice(0, 200)}`);
    out.stories.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. [${s.category}] ${s.title.slice(0, 68)}`));
    console.log(`  written : ${file}`);
  } catch (e) {
    console.log(`  FAILED: ${e.message.slice(0, 300)}`);
  }
}
await prisma.$disconnect();
