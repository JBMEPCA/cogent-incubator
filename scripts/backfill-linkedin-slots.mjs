/**
 * Give every unposted LinkedIn draft a 09:00 / 13:00 UK slot.
 *
 * Slots became mandatory on 2 Sep 2026: dueFilter() now ignores anything with
 * scheduledFor = null, because a slotless post would go out at whatever hour
 * the cron happened to tick, which is what fixed slots exist to prevent. Every
 * draft written before that change has no slot and would sit until it expired.
 *
 * Idempotent: rows that already carry a slot are left alone, so it is safe to
 * rerun. Ordered oldest first, so the queue goes out in the order it was
 * written rather than shuffled.
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *     scripts/backfill-linkedin-slots.mjs [--commit]
 *
 * Without --commit it prints the plan and writes nothing.
 */
import { PrismaClient } from "@prisma/client";
import { nextPostingSlots } from "../lib/linkedin.js";

const commit = process.argv.includes("--commit");
const prisma = new PrismaClient();

const uk = (d) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });

for (const site of sites) {
  const pending = await prisma.linkedInPost.findMany({
    where: { siteId: site.id, status: { in: ["draft", "approved"] }, postedAt: null, scheduledFor: null },
    orderBy: { createdAt: "asc" },
  });
  if (!pending.length) {
    console.log(`${site.slug}: nothing to slot`);
    continue;
  }

  console.log(`\n${site.slug}: ${pending.length} unslotted`);
  // One call for the whole run. Asking per post would hand back the same slot
  // every time on a dry run, because nothing has been written for the next call
  // to see.
  const slots = await nextPostingSlots(site, pending.length);
  for (const [i, post] of pending.entries()) {
    const slot = slots[i];
    console.log(`  ${uk(post.createdAt)} draft -> ${uk(slot)}  ${post.text.slice(0, 46).replace(/\s+/g, " ")}...`);
    if (commit) {
      await prisma.linkedInPost.update({ where: { id: post.id }, data: { scheduledFor: slot } });
    }
  }
}

console.log(commit ? "\ncommitted" : "\ndry run, nothing written. Rerun with --commit");
await prisma.$disconnect();
