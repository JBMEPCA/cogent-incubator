// One chase for everyone who was pre-asked and has not answered.
//
// The 31 pre-asks sent on 26 Aug 2026 produced nothing at all, not even an
// out-of-office, while backlink outreach from the same mailbox in the same
// week was answered by five companies. The mail was the problem, not the
// domain, so this sends the corrected version: subject names the company,
// the price is stated in the opening lines, and the questions come with it so
// that replying is the action.
//
// Paced on purpose. The original 20 went out inside about twenty seconds with
// an identical subject line on every one, which is a bulk fingerprint no
// matter how good the copy is.
//
// Run with --send to send, otherwise it prints what it would do.
// --pace=N overrides the gap between sends in seconds. --limit=N stops early.

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { sendFollowUp, resolveAddress, isGenericAddress } from "../lib/interviews.js";
import { verifyEmail, creditsRemaining } from "../lib/prospects.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const LIMIT = arg("limit", 0);
const PACE = arg("pace", 30);
const SLUG = "smart-sme";

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);

// "asked" only. Anyone who said yes, said no, or already got their chase is
// left alone.
const all = await prisma.interviewTarget.findMany({
  where: { siteId: site.id, status: "asked", followUpSentAt: null },
  orderBy: { askedAt: "asc" },
});
const targets = LIMIT ? all.slice(0, LIMIT) : all;

// Preflight, because running out halfway is worse than not starting. On
// 1 Sep 2026 the credits ran out one person into a 31 person run and the other
// thirty silently went to the shared inbox that had already failed them, each
// spending the one chase they get. Roughly 5 candidate addresses at 3 credits
// each for anyone whose current address is a shared inbox.
const needProbe = targets.filter((t) => isGenericAddress(t.email)).length;
const estimate = needProbe * 15;
let credits = null;
try {
  credits = await creditsRemaining();
} catch (e) {
  console.log(`Could not read MillionVerifier credits: ${e.message}`);
}

console.log(`Site      : ${site.name}`);
console.log(`Sending as: ${creds?.outreach?.fromEmail || "(not configured)"}`);
console.log(`Mode      : ${SEND ? "SEND" : "dry run"}`);
console.log(`To chase  : ${targets.length}${SEND ? `, one every ~${PACE}s` : ""}`);
console.log(`Verifier  : ${credits === null ? "unreadable" : `${credits} credits`}, need about ${estimate} for ${needProbe} probe(s)\n`);

const short = needProbe > 0 && credits !== null && credits < estimate;
if (short) {
  console.log(`STOPPING. ${credits} credits will not cover ${needProbe} people, and a chase spent on the wrong inbox cannot be taken back.`);
  console.log(`Top up MillionVerifier and run again, or pass --limit=${Math.max(0, Math.floor(credits / 15))} to do only what the credits cover.`);
  process.exitCode = 1;
} else if (!targets.length) {
  console.log("Nobody left to chase.");
}

const opts = {
  outreach: creds?.outreach,
  titleName: "Smart SME",
  siteUrl: "smartsme.co.uk",
  senderName: creds?.outreach?.fromName || "James Burke",
  verify: verifyEmail,
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let sent = 0, failed = 0, upgraded = 0;
for (const [i, t] of (short ? [] : targets).entries()) {
  if (!SEND) {
    const fresh = isGenericAddress(t.email) ? await resolveAddress(t, { verify: verifyEmail }) : null;
    const isPersonal = fresh && (fresh.source === "verified" || fresh.source === "published");
    const to = isPersonal ? fresh.email : t.email;
    if (isPersonal) upgraded++;
    console.log(
      `would chase -> ${String(to).padEnd(40)} [${isPersonal ? `${fresh.source}, NEW` : t.emailSource}]  ${t.personName}`
    );
    continue;
  }

  const res = await sendFollowUp(prisma, t, opts);
  if (res.sent) {
    sent++;
    if (res.firstContact) upgraded++;
    console.log(`chased -> ${res.email.padEnd(40)} [${res.source}${res.firstContact ? ", NEW" : ""}]  ${t.personName}`);
  } else {
    failed++;
    console.log(`FAILED (${res.reason}) ${t.personName}: ${res.error || ""}`);
  }

  // Randomised, because a gap that is always identical is itself a pattern.
  if (i < targets.length - 1 && PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}

console.log(`\ndone. ${SEND ? `sent=${sent}` : `would send=${targets.length}`} reachedPersonallyForTheFirstTime=${upgraded} failed=${failed}`);
await prisma.$disconnect();
