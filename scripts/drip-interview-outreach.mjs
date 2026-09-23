/**
 * Send a few queued interview approaches per title, once a day.
 *
 * Built 23 Sep 2026 with the weekly sourcing run: JB wants roughly 30 approaches
 * per title per month, and thirty landing on one morning is a mailshot. This
 * takes the oldest queued candidates, up to a handful per title, and sends them
 * spread out.
 *
 * The queue is InterviewTarget rows at status "pending", written by
 * scripts/send-interview-batch.mjs --queue. Each already carries its seven
 * questions, its news hook and, usually, the published address a researcher
 * read off the company's own site. Anything with no address goes to the contact
 * hunter, and if that finds nothing the row is marked exhausted for a human.
 *
 * Safe to run twice: rows leave "pending" as soon as they are sent.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/drip-interview-outreach.mjs [--per-title=3] [--send] [--pace=45]
 */
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const SEND = process.argv.includes("--send");
const PER_TITLE = Number(arg("per-title", 3));
const PACE = Number(arg("pace", 45));

const { prisma, forSite } = await import("../lib/prisma.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });

const totals = { sent: 0, noAddress: 0, failed: 0, queueLeft: 0 };
for (const site of sites) {
  const db = forSite(site.id);
  const franchise = (await db.engineSetting.findUnique({ where: { key: "interview_franchise" } }))?.value;
  const queue = await db.interviewTarget.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
  if (!queue.length) continue;
  if (!franchise) { console.log(`${site.slug}: ${queue.length} queued but no interview_franchise set, left alone`); continue; }

  const { creds } = await siteCredentials(site.id);
  const full = await prisma.site.findUnique({ where: { id: site.id } });
  const opts = {
    outreach: creds?.outreach,
    titleName: site.name,
    titleDescriptor: (await db.engineSetting.findUnique({ where: { key: "interview_title_descriptor" } }))?.value || null,
    siteUrl: siteUrl(full),
    senderName: creds?.outreach?.fromName || "James Burke",
    hunt: huntContact,
  };

  const todays = queue.slice(0, PER_TITLE);
  console.log(`\n### ${site.name}: ${queue.length} queued, taking ${todays.length}`);
  for (const row of todays) {
    if (!SEND) { console.log(`  would send: ${row.personName}, ${row.company} (${row.email || "address to hunt"})`); continue; }
    const res = await sendQuestionsUpFront(db, { ...row, genericEmail: row.email }, opts);
    if (res.sent) {
      console.log(`  sent -> ${res.email} ${row.personName}, ${row.company}`);
      totals.sent++;
      if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
    } else if (res.reason === "exhausted") {
      console.log(`  no published address, left for a human: ${row.personName}, ${row.company}`);
      totals.noAddress++;
    } else {
      console.log(`  FAILED (${res.reason}) ${row.personName}: ${res.error || ""}`);
      totals.failed++;
    }
  }
  totals.queueLeft += Math.max(0, queue.length - todays.length);
}

console.log(`\n${SEND ? "SENT" : "DRY RUN"}:`, JSON.stringify(totals));
await prisma.$disconnect();
