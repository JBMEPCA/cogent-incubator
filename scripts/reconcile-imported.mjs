/**
 * Make the database agree with the audience about who is already subscribed.
 *
 *   node --import ./scripts/_register.mjs scripts/reconcile-imported.mjs
 *   node --import ./scripts/_register.mjs scripts/reconcile-imported.mjs --write
 *
 * Found 11 September 2026: Mailchimp held 994 Smart SME members tagged
 * tranche-003 that the database still had queued. runDrip uploaded them, then
 * hit its 60s limit before the single statement at the end that recorded it.
 * Because the queue is ordered by rank, the same 994 were then picked, re-sent
 * and re-tagged on every run afterwards, so the drip burned a batch a week and
 * added nobody.
 *
 * runDrip now writes each slice back as it goes, so the gap should not reopen.
 * This stays because the repair is worth having and because it is the only
 * honest way to answer "how many people are actually on this list".
 *
 * Reads the audience, not our own records, and only ever fills IN a missing
 * importedAt. It never marks anyone unimported: someone who unsubscribed has
 * left the audience but was still genuinely imported, and re-sending them would
 * be the one thing worse than the bug.
 */

import "./_env.mjs";
import { prisma, forSite } from "../lib/prisma.js";
import { mc } from "../lib/newsletter.js";
import { activeSites } from "../lib/cron.js";

const WRITE = process.argv.includes("--write");

/**
 * Every member of an audience, with their tranche tag and the date they were
 * actually subscribed, a page at a time.
 *
 * The date matters. Backdating to what Mailchimp recorded is not tidiness: the
 * weekly allowance counts importedAt since Monday, so stamping a repair with
 * today's date would charge 994 people imported in August against this week's
 * two thousand and halve the rate on the very week the fix ships.
 */
async function audienceMembers(audienceId) {
  const out = new Map();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const d = await mc(
      `/lists/${audienceId}/members?count=${PAGE}&offset=${offset}` +
        `&fields=total_items,members.email_address,members.timestamp_opt,members.tags.name`
    );
    const members = d.members ?? [];
    for (const m of members) {
      const tag = (m.tags ?? []).map((t) => t.name).find((n) => /^tranche-\d+$/.test(n));
      const at = m.timestamp_opt ? new Date(m.timestamp_opt) : null;
      out.set(m.email_address.toLowerCase(), {
        tranche: tag ? Number(tag.slice("tranche-".length)) : null,
        at: at && !Number.isNaN(at.getTime()) ? at : null,
      });
    }
    if (members.length < PAGE) break;
  }
  return out;
}

console.log(WRITE ? "Reconciling (writing).\n" : "Dry run. Pass --write to apply.\n");

for (const { site, creds } of await activeSites()) {
  const audienceId = creds?.mailchimp?.audienceId;
  if (!audienceId) {
    console.log(`${site.slug}: no Mailchimp audience, skipped`);
    continue;
  }

  const db = forSite(site.id);
  const onList = await audienceMembers(audienceId);

  // Only the queued ones matter. Anyone already marked imported agrees with the
  // audience by definition, and pulling the whole table back to compare would
  // be 24,678 rows for Smart SME alone.
  const queued = await db.newsletterProspect.findMany({
    where: { importedAt: null },
    select: { id: true, email: true },
  });

  const drifted = queued.filter((p) => onList.has(p.email.toLowerCase()));
  const maxTranche = (await db.newsletterProspect.aggregate({ _max: { tranche: true } }))._max.tranche ?? 0;

  console.log(
    `${site.slug.padEnd(26)} audience ${String(onList.size).padStart(6)}   queued ${String(queued.length).padStart(6)}` +
      `   already subscribed but still queued ${String(drifted.length).padStart(5)}`
  );

  if (!drifted.length || !WRITE) continue;

  // Group by the tranche and date Mailchimp holds, so a repaired row carries
  // the same tranche number as the tag on the member and the date the member
  // actually joined.
  const groups = new Map();
  for (const p of drifted) {
    const m = onList.get(p.email.toLowerCase());
    const tranche = m?.tranche ?? maxTranche;
    const at = m?.at ?? new Date(0);
    const key = `${tranche}|${at.toISOString().slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, { tranche, at, ids: [] });
    groups.get(key).ids.push(p.id);
  }

  for (const { tranche, at, ids } of groups.values()) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.newsletterProspect.updateMany({
        where: { id: { in: ids.slice(i, i + 500) } },
        data: { importedAt: at, tranche },
      });
    }
    console.log(`  marked ${ids.length} imported, tranche ${tranche}, dated ${at.toISOString().slice(0, 10)}`);
  }
}

await prisma.$disconnect();
