// Ask every PR agency on a title's source list to add us to its distribution.
//
// The single biggest lever in every alignment sheet: fresh press material is
// what turns a title that rewrites competitors into one that publishes first,
// and Smart SME's own editorial standard records that we appear on no UK SME
// media list at all. The agencies are PrBrand rows in category "PR agency"
// (seeded by scripts/apply-alignment.mjs from the sheets).
//
// Dry run by default: prints every mail it would send and sends nothing.
// --send sends from the title's own outreach mailbox, one note per agency,
// paced, and records the ask on the row so it is never sent twice.
//
//   node --env-file=.env scripts/request-press-lists.mjs [--site=<slug>] [--send] [--pace=45]

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendGmail, isGmailConfigured } from "../lib/gmail.js";
import { siteUrl } from "../lib/voice.js";
import { resolveContact } from "../lib/outreach.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const PACE = Number((process.argv.find((a) => a.startsWith("--pace=")) || "").split("=")[1] || 45);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MARK = "Press-list request sent";

function body({ agency, titleName, descriptor, url, senderName, senderEmail }) {
  return `Hello ${agency} team,

I edit ${titleName}, ${descriptor}. We publish daily at ${url} and a weekly email to readers in the sector.

Could you add ${senderEmail} to your distribution lists for any client news that fits? Launches, appointments, results, contract wins, research and case studies all get covered, and we link to the company and the original announcement on every piece.

If you prefer a named contact per client, I am happy to be that. Thanks in advance.

${senderName}
${titleName}
${url}`;
}

const sites = await prisma.site.findMany({ where: ONLY ? { slug: ONLY } : { status: { in: ["live", "cold_start"] } } });
let would = 0, sent = 0;
for (const site of sites) {
  const agencies = await prisma.prBrand.findMany({ where: { siteId: site.id, category: "PR agency" } });
  if (!agencies.length) continue;
  const settings = await prisma.engineSetting.findMany({ where: { siteId: site.id, key: "interview_title_descriptor" } });
  const descriptor = settings[0]?.value || `the trade title for ${site.audience?.split(",")[0]?.toLowerCase() || "its sector"}`;
  // An id, and a bundle back: see the same note in seed-alignment-interviews.
  const { creds } = SEND ? await siteCredentials(site.id) : { creds: null };
  const senderName = creds?.outreach?.fromName || site.authorName || "James Burke";
  const senderEmail = creds?.outreach?.fromEmail || site.authorEmail || "(outreach mailbox)";
  console.log(`\n#### ${site.name}: ${agencies.length} agencies`);
  if (SEND && !isGmailConfigured(creds?.outreach)) { console.log("  gmail not configured for this title, skipping"); continue; }

  for (const a of agencies) {
    if (a.notes?.includes(MARK)) { console.log(`  already asked: ${a.name}`); continue; }
    // The agency's own contact address, found on its site by the same resolver
    // backlink outreach uses. A guessed address is never used: the resolver
    // says so, and this script respects it.
    let contact = { email: a.prContactEmail, confidence: a.contactConfidence };
    if (!contact.email) {
      try { contact = await resolveContact(site, a.website); } catch (e) { contact = { email: null, confidence: null, error: e.message }; }
    }
    if (!contact?.email || contact.confidence === "guessed") {
      console.log(`  ${a.name.padEnd(28)} -> no published address found${contact?.error ? ` (${contact.error})` : ""}; needs a human`);
      continue;
    }
    const text = body({ agency: a.name, titleName: site.name, descriptor, url: siteUrl(site), senderName, senderEmail });
    if (!SEND) {
      would++;
      console.log(`  ${a.name.padEnd(28)} -> would send to ${contact.email} [${contact.confidence || "found"}]`);
      continue;
    }
    await sendGmail({ outreach: creds.outreach, to: contact.email, toName: a.name, subject: `Adding ${site.name} to your distribution list`, text });
    await prisma.prBrand.update({ where: { id: a.id }, data: { notes: `${a.notes ? a.notes + "\n" : ""}${MARK} ${new Date().toISOString().slice(0, 10)} to ${contact.email}.`, prContactEmail: contact.email, contactConfidence: contact.confidence || "found" } });
    sent++;
    console.log(`  ${a.name.padEnd(28)} -> sent to ${contact.email}`);
    await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
  }
}
console.log(SEND ? `\nsent ${sent}` : `\ndry run: ${would} would be sent. Nothing sent.`);
await prisma.$disconnect();
