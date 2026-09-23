/**
 * Send one interview batch per title from researched candidate packs.
 *
 * Built 23 Sep 2026, when the queue ran dry: every title had zero targets
 * waiting and the sweep had nothing to send, so interviews stalled. The old
 * seed-<title>-interviews.mjs scripts each hardcoded their own people; this one
 * reads a directory of JSON packs, one per title, so a batch for ten titles is
 * one run.
 *
 * Questions go out UP FRONT, not a pre-ask. Thirty one pre-asks in August
 * produced nothing; sending the questions with the first mail is what has
 * worked since.
 *
 * Pack shape (one file per title, named <slug>.json):
 *   { "slug": "smart-sme", "candidates": [ { personName, personRole, company,
 *     companyDomain, genericEmail, hookUrl, newsHook, questions: [7] } ] }
 *
 * Safety rails, because this sends mail to real people:
 * - Dry run by default. --send is required, and prints the address it resolved.
 * - Never two titles to one company: a domain or a person already in ANY
 *   title's queue is skipped, which is the cross-title chase that bit us on
 *   14 Sep.
 * - Addresses are never invented. resolveAddress prefers the published inbox
 *   in the pack, then the contact hunter reads the company's own site. No
 *   address, no mail: the row is marked exhausted and left for a human.
 * - --limit caps each title, and sends are paced.
 *
 * Run:
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/send-interview-batch.mjs --dir=<packs> [--slug=a,b] [--limit=5] [--send] [--pace=30]
 */
import fs from "node:fs";
import path from "node:path";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const SEND = process.argv.includes("--send");
const DIR = arg("dir");
const ONLY = (arg("slug", "") || "").split(",").filter(Boolean);
const LIMIT = Number(arg("limit", 5));
const PACE = Number(arg("pace", 30));
if (!DIR) throw new Error("--dir=<directory of <slug>.json packs> is required");

const { prisma, forSite } = await import("../lib/prisma.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const packs = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".json") && !["titles.json"].includes(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")))
  .filter((p) => p?.slug && Array.isArray(p.candidates))
  .filter((p) => !ONLY.length || ONLY.includes(p.slug));

// Everyone any title has ever written to, so no company hears from two of our
// mastheads and no person is asked twice.
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });
const takenDomains = new Set();
const takenNames = new Set();
for (const s of sites) {
  for (const r of await forSite(s.id).interviewTarget.findMany()) {
    // Only people we have actually written to. A row still at "pending" was
    // seeded and never sent (a dry run leaves them behind), and counting those
    // as contacts made the first run of this script skip all 48 of its own
    // candidates.
    if (r.status === "pending" && !r.askedAt) continue;
    if (r.companyDomain) takenDomains.add(r.companyDomain.toLowerCase().replace(/^www\./, ""));
    if (r.company) takenDomains.add(r.company.toLowerCase());
    if (r.personName) takenNames.add(r.personName.toLowerCase());
  }
}

const totals = { queued: 0, sent: 0, noAddress: 0, duplicate: 0, failed: 0, invalid: 0 };
for (const pack of packs) {
  const site = sites.find((s) => s.slug === pack.slug);
  if (!site) { console.log(`\n### ${pack.slug}: no such site, skipped`); continue; }
  const db = forSite(site.id);
  const { creds } = await siteCredentials(site.id);
  const franchise = (await db.engineSetting.findUnique({ where: { key: "interview_franchise" } }))?.value;
  const descriptor = (await db.engineSetting.findUnique({ where: { key: "interview_title_descriptor" } }))?.value || null;
  if (!franchise) { console.log(`\n### ${pack.slug}: no interview_franchise set, skipped so nothing goes out under another title's series name`); continue; }
  const full = await prisma.site.findUnique({ where: { id: site.id } });

  console.log(`\n### ${site.name} (${franchise}) as ${creds?.outreach?.fromEmail}`);
  const opts = {
    outreach: creds?.outreach,
    titleName: site.name,
    titleDescriptor: descriptor,
    siteUrl: siteUrl(full),
    senderName: creds?.outreach?.fromName || "James Burke",
    hunt: huntContact,
  };

  let done = 0;
  for (const c of pack.candidates) {
    if (done >= LIMIT) break;
    const bad = !c.personName || !c.companyDomain || !Array.isArray(c.questions) || c.questions.length < 5 || !c.newsHook;
    if (bad) { console.log(`  invalid pack entry, skipped: ${c.personName || "(no name)"}`); totals.invalid++; continue; }
    if (/[—–]/.test([c.newsHook, ...c.questions].join(" "))) { console.log(`  dash in copy, skipped: ${c.personName}`); totals.invalid++; continue; }
    const domain = c.companyDomain.toLowerCase().replace(/^www\./, "");
    if (takenDomains.has(domain) || takenDomains.has((c.company || "").toLowerCase()) || takenNames.has(c.personName.toLowerCase())) {
      console.log(`  already in the queue somewhere, skipped: ${c.personName}, ${c.company}`);
      totals.duplicate++;
      continue;
    }

    if (!SEND) {
      const pick = await resolveAddress({ ...c, triedEmails: null }, { hunt: huntContact });
      console.log(`  would send -> ${(pick?.email || "(nowhere)").padEnd(36)} [${pick?.source || "none"}] ${c.personName}, ${c.company}`);
      if (pick?.email) { totals.queued++; done++; } else totals.noAddress++;
      continue;
    }

    const existing = await db.interviewTarget.findFirst({ where: { personName: c.personName } });
    const row = existing || (await db.interviewTarget.create({
      data: {
        siteId: site.id,
        personName: c.personName,
        personRole: c.personRole || null,
        company: c.company,
        companyDomain: domain,
        newsHook: c.newsHook,
        hookUrl: c.hookUrl || null,
        questions: c.questions.join("\n"),
        status: "pending",
      },
    }));
    const target = { ...row, genericEmail: c.genericEmail || null };

    const res = await sendQuestionsUpFront(db, target, opts);
    if (res.sent) {
      console.log(`  sent -> ${res.email.padEnd(36)} [${res.source}] ${c.personName}, ${c.company}`);
      totals.sent++;
      done++;
      takenDomains.add(domain);
      takenNames.add(c.personName.toLowerCase());
      if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
    } else if (res.reason === "exhausted") {
      console.log(`  no published address, left for a human: ${c.personName}, ${c.company}`);
      totals.noAddress++;
    } else {
      console.log(`  FAILED (${res.reason}) ${c.personName}: ${res.error || ""}`);
      totals.failed++;
    }
  }
}

console.log(`\n${SEND ? "SENT" : "DRY RUN"}:`, JSON.stringify(totals));
await prisma.$disconnect();
