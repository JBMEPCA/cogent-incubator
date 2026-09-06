// The second email, to everyone across every title who has not replied.
//
// JB, 6 Sep 2026: everyone contacted should have had two emails, because the
// only three conversions the interview franchise has ever produced all came
// off the second one, never the first.
//
// The copy is buildNudge, not buildFollowUp. buildFollowUp opens by
// apologising for the retired pre-ask ("I wrote to you last week, I suspect it
// read like an advert"), which is true of the 31 sent on 26 Aug and false of
// everybody since: they were sent the questions up front and there is nothing
// to apologise for. Sending it to them would read as though we had lost track
// of our own correspondence.
//
// Who is excluded, and why it matters more than who is included:
//   agreedAt set        - they wrote back to say yes. Chasing them for silence
//                         is the worst mail we could send.
//   followUpSentAt set  - they have had their two. The 31 from 26 Aug were
//                         chased on 1 Sep and must not get a third.
//   status not equal to questioned - declined, answered, bounced, exhausted.
//
// The hourly sweep sends exactly this mail on a 3-4 day timer. This is the
// same send done now rather than waiting, and it writes followUpSentAt, so
// the sweep will not duplicate it on Monday.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
//     scripts/nudge-all-titles.mjs [--send] [--pace=30] [--limit=N]

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { buildNudge, followUpSubject, htmlise } from "../lib/interviews.js";
import { stripEmDashes } from "../lib/drafting.js";
import { sendGmail } from "../lib/gmail.js";
import { siteUrl } from "../lib/site-url.js";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");
const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const PACE = arg("pace", 30);
const LIMIT = arg("limit", 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = await prisma.interviewTarget.findMany({
  where: { status: "questioned", followUpSentAt: null, agreedAt: null, questionsSentAt: { not: null } },
  orderBy: { questionsSentAt: "asc" },
});
const targets = LIMIT ? rows.slice(0, LIMIT) : rows;

console.log(`Mode    : ${SEND ? "SEND" : "dry run"}`);
console.log(`To chase: ${targets.length}${SEND ? `, one every ~${PACE}s` : ""}\n`);
if (!targets.length) {
  console.log("Nobody is waiting on a second email.");
  await prisma.$disconnect();
  process.exit(0);
}

// Credentials are per title and decrypting them is not free, so cache.
const siteCache = new Map();
async function contextFor(siteId) {
  if (siteCache.has(siteId)) return siteCache.get(siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  const { creds } = await siteCredentials(siteId);
  const ctx = {
    site,
    outreach: creds?.outreach,
    titleName: site.name,
    senderName: creds?.outreach?.fromName || "James Burke",
    siteUrl: siteUrl(site),
  };
  siteCache.set(siteId, ctx);
  return ctx;
}

const days = (d) => Math.round((Date.now() - d.getTime()) / 86400000);

let sent = 0, failed = 0;
for (const t of targets) {
  const ctx = await contextFor(t.siteId);
  const line = `${ctx.site.name.padEnd(22)} ${t.personName.padEnd(24)} ${(t.email || "(no address)").padEnd(34)} sent ${days(t.questionsSentAt)}d ago`;

  if (!SEND) {
    console.log(`would chase  ${line}`);
    continue;
  }
  if (!t.email) {
    console.log(`SKIP no address  ${line}`);
    failed++;
    continue;
  }

  const body = buildNudge({
    personName: t.personName,
    company: t.company,
    titleName: ctx.titleName,
    senderName: ctx.senderName,
    siteUrl: ctx.siteUrl,
  });
  try {
    await sendGmail({
      outreach: ctx.outreach,
      to: t.email,
      toName: t.personName,
      subject: stripEmDashes(`Re: ${followUpSubject(t.company)}`),
      text: body,
      html: htmlise(body),
    });
    await prisma.interviewTarget.update({ where: { id: t.id }, data: { followUpSentAt: new Date() } });
    sent++;
    console.log(`chased       ${line}`);
  } catch (e) {
    failed++;
    console.log(`FAILED       ${line}  ${String(e.message).slice(0, 120)}`);
    await prisma.interviewTarget.update({ where: { id: t.id }, data: { error: String(e.message).slice(0, 300) } });
  }
  if (PACE > 0) await wait((PACE + Math.floor(Math.random() * PACE)) * 1000);
}

console.log(`\ndone. ${SEND ? `sent=${sent} failed=${failed}` : `would send ${targets.length}`}`);
await prisma.$disconnect();
