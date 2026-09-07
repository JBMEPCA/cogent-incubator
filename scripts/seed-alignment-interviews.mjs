// Seed a title's interview franchise from the people named in its alignment
// sheet (and the award-list research that followed).
//
// One script for every title, reading scripts/alignment/<slug>.interviews.json,
// because the fleet-2 script it copies had the shape right and there was no
// reason to write it a fourth time. Same rules as that script:
//
//   - a person another title already holds is skipped, so two magazines never
//     write to the same inbox
//   - dry run by default: rows are created as "pending" and the address the
//     send would use is printed, and NOTHING is sent
//   - --send sends the questions-up-front mail, paced at 30-60s apart
//
// A "pending" row is inert. The hourly interview sweep only reads "asked" and
// "questioned" rows (lib/interviews.js runInterviewSweep), so seeding is not
// sending: the pre-asks go only when someone runs this with --send.
//
//   node --env-file=.env scripts/seed-alignment-interviews.mjs <slug> [--send] [--pace=30]

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendQuestionsUpFront, resolveAddress } from "../lib/interviews.js";
import { huntContact } from "../lib/contact-hunt.js";
import { siteUrl } from "../lib/voice.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const SLUG = process.argv[2];
if (!SLUG || SLUG.startsWith("--")) {
  console.error("usage: node --env-file=.env scripts/seed-alignment-interviews.mjs <slug> [--send] [--pace=30]");
  process.exit(1);
}
const file = path.resolve("scripts/alignment", `${SLUG}.interviews.json`);
if (!fs.existsSync(file)) { console.error(`No ${file}`); process.exit(1); }
const PEOPLE = JSON.parse(fs.readFileSync(file, "utf8"));

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.error(`No title with slug "${SLUG}"`); process.exit(1); }
const settings = await prisma.engineSetting.findMany({ where: { siteId: site.id, key: { in: ["interview_franchise", "interview_title_descriptor"] } } });
const franchise = settings.find((s) => s.key === "interview_franchise")?.value || "Interview";
const titleDescriptor = settings.find((s) => s.key === "interview_title_descriptor")?.value || "";
// siteCredentials takes an id and returns a bundle, not a credentials object.
// Getting either half wrong leaves creds undefined, which only shows up in
// --send: the dry run never touches it, and the first real send would go out
// with no mailbox configured and mark every row failed.
const { creds } = SEND ? await siteCredentials(site.id) : { creds: null };

const elsewhere = await prisma.interviewTarget.findMany({ where: { siteId: { not: site.id } }, select: { personName: true, companyDomain: true } });
const takenNames = new Set(elsewhere.map((r) => r.personName.toLowerCase()));
const takenDomains = new Set(elsewhere.map((r) => (r.companyDomain || "").toLowerCase()).filter(Boolean));

console.log(`Site      : ${site.name}\nFranchise : ${franchise}\nMode      : ${SEND ? "SEND" : "dry run (rows created as pending, nothing sent)"}\nPeople    : ${PEOPLE.length}\n`);

const opts = {
  outreach: creds?.outreach,
  titleName: site.name,
  titleDescriptor,
  siteUrl: siteUrl(site),
  senderName: creds?.outreach?.fromName || "James Burke",
  hunt: huntContact,
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE = Number((process.argv.find((a) => a.startsWith("--pace=")) || "").split("=")[1] || 30);
// How long one person gets before the batch gives up on them and moves on.
const PERSON_TIMEOUT = Number((process.argv.find((a) => a.startsWith("--timeout=")) || "").split("=")[1] || 60);

let sent = 0, failed = 0, skipped = 0, queued = 0;
for (const p of PEOPLE) {
  const domain = p.companyDomain && p.companyDomain !== "none" ? p.companyDomain : null;
  const generic = p.genericEmail && p.genericEmail !== "none" ? p.genericEmail : null;
  if (takenNames.has(p.personName.toLowerCase()) || (domain && takenDomains.has(domain.toLowerCase()))) {
    console.log(`SKIP (another title has them): ${p.personName}`); skipped++; continue;
  }
  const existing = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, personName: p.personName } });
  if (existing && existing.status !== "pending") { console.log(`skip (${existing.status}): ${p.personName}`); continue; }

  const row = existing || (await prisma.interviewTarget.create({
    data: {
      siteId: site.id, personName: p.personName, personRole: p.personRole, company: p.company,
      companyDomain: domain, newsHook: p.newsHook, hookUrl: p.hookUrl,
      questions: p.questions.join("\n"), status: "pending",
    },
  }));
  queued++;
  const withAddresses = { ...row, genericEmail: generic };

  if (!SEND) {
    let pick = null;
    try { pick = await resolveAddress(withAddresses, { hunt: huntContact }); } catch (e) { pick = { email: null, source: `error: ${e.message}` }; }
    console.log(`would send -> ${(pick?.email || "(nowhere)").padEnd(36)} [${pick?.source || "none"}]  ${p.personName}`);
    continue;
  }
  // Bounded, because one person must never be able to stop the batch. The
  // address resolver fetches the subject's own website, and on 7 Sep a shop
  // site that never answered left the Barbering run hanging on one name with
  // six people behind it still unsent. A timeout here leaves that row pending
  // and moves on, so the next run picks it up rather than the whole thing
  // needing to be killed and restarted.
  const res = await Promise.race([
    sendQuestionsUpFront(prisma, withAddresses, opts),
    new Promise((r) => setTimeout(() => r({ sent: false, reason: "timeout", error: `no answer in ${PERSON_TIMEOUT}s, left pending` }), PERSON_TIMEOUT * 1000)),
  ]);
  if (res.sent) { sent++; console.log(`sent -> ${res.email.padEnd(36)} [${res.source}]  ${p.personName}`); }
  else { failed++; console.log(`FAILED (${res.reason}) ${p.personName}: ${res.error || ""}`); }
  if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}
console.log(`\ndone. ${SEND ? `sent=${sent}` : `queued=${queued}`} skipped=${skipped} failed=${failed}`);
await prisma.$disconnect();
