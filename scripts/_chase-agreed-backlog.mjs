/**
 * One-off, 23 Sep 2026: chase the people who said yes and then went quiet.
 *
 * JB asked whether every outstanding interview had had its second email. Most
 * had. These had not, because the sweep's chase excluded anyone with agreedAt
 * set, so the warmest leads in the queue were the only ones never chased. Two
 * had been silent for three weeks after saying yes.
 *
 * The sweep now chases them itself (buildAgreedChase), but four of these six
 * already have followUpSentAt set from an earlier silence nudge, so the sweep
 * would never reach them. Hence this one off.
 *
 * Sends at most one mail per person, to their existing address, and stamps
 * followUpSentAt so nothing chases them twice.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_chase-agreed-backlog.mjs [--send]
 */
import { siteCredentials } from "../lib/site.js";
import { buildAgreedChase, followUpSubject, htmlise, nextSendableTime } from "../lib/interviews.js";
import { sendGmail } from "../lib/gmail.js";
import { siteUrl } from "../lib/voice.js";
import { stripEmDashes } from "../lib/drafting.js";

const SEND = process.argv.includes("--send");
// Anyone who agreed, has not answered, and has been quiet for a week. The row
// created yesterday (NDNA) is deliberately out of range.
const MIN_DAYS = 7;

const { prisma, forSite } = await import("../lib/prisma.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = new Date();
let sent = 0;

for (const site of await prisma.site.findMany({ select: { id: true, slug: true, name: true } })) {
  const db = forSite(site.id);
  const rows = (await db.interviewTarget.findMany({ where: { status: "questioned", agreedAt: { not: null }, answeredAt: null } }))
    .filter((r) => r.questionsSentAt && (now - r.questionsSentAt) / 86400000 >= MIN_DAYS && r.email);
  if (!rows.length) continue;

  const { creds } = await siteCredentials(site.id);
  const full = await prisma.site.findUnique({ where: { id: site.id } });
  const senderName = creds?.outreach?.fromName || "James Burke";

  for (const t of rows) {
    const body = buildAgreedChase({
      personName: t.personName,
      company: t.company,
      questions: t.questions,
      titleName: site.name,
      senderName,
      siteUrl: siteUrl(full),
    });
    const subject = stripEmDashes(`Re: ${followUpSubject(t.company)}`);
    const quiet = Math.floor((now - t.questionsSentAt) / 86400000);
    console.log(`\n--- ${site.slug}: ${t.personName}, ${t.company} -> ${t.email} (quiet ${quiet} days, last chased ${t.followUpSentAt?.toISOString().slice(0, 10) || "never"})`);
    console.log(`SUBJECT: ${subject}\n${body}`);
    if (!SEND) continue;
    if (nextSendableTime(now) > now) { console.log("outside sending hours, stopping"); process.exit(0); }
    try {
      const res = await sendGmail({ outreach: creds.outreach, to: t.email, toName: t.personName, subject, text: body, html: htmlise(body) });
      await db.interviewTarget.update({ where: { id: t.id }, data: { followUpSentAt: now, error: null } });
      console.log(`SENT id=${res.id}`);
      sent++;
      await wait((45 + Math.floor(Math.random() * 45)) * 1000);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
}

console.log(`\n${SEND ? `sent ${sent}` : "DRY RUN, nothing sent"}`);
await prisma.$disconnect();
