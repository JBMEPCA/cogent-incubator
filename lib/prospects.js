/**
 * The subscriber drip: move the Apollo list into each title's audience, at a
 * rate that title is allowed.
 *
 * Two things decide how fast a list grows, and they are deliberately separate.
 * The SCHEDULE (cloudflare/worker.js) offers every title a run on Tuesday and
 * on Friday. The ALLOWANCE (drip.weeklyTarget, per title, in EngineSetting)
 * decides how many of those runs actually do anything: Smart SME takes two
 * thousand a week and uses both, everyone else takes a thousand and is finished
 * by Tuesday lunchtime.
 *
 * Verification used to sit in front of all this and no longer does. It is kept
 * below, unscheduled, because the wrapper is written and the credits might one
 * day be bought again — but the import does not wait on it, and an address
 * nobody has checked is now simply an address. Apollo's own "not catch-all"
 * flag was wrong for 11% of the first tranche, so its data decides ranking
 * order and nothing else; Mailchimp removing hard bounces itself is the safety
 * net that costs nothing.
 */

import { prisma, forSite } from "./prisma";
import { mc, lastIssueHealth } from "./newsletter";
import { industryFromSic } from "./sic";

// The audience is the title's own — see lib/newsletter.js. MillionVerifier and
// the Mailchimp key itself are fleet-wide.
const VERIFY_BATCH = Number(process.env.DRIP_VERIFY_BATCH || 200);
const VERIFY_CONCURRENCY = 12;

/**
 * A ceiling on one invocation, not a target. The weekly allowance below decides
 * how many a title takes across the week; this is how many it may take at once.
 *
 * A thousand, because that is what fits. Measured on live audiences 11 Sep
 * 2026: Fleet's thousand took 184s and Smart SME's took 113s and 155s, so
 * Mailchimp's batch endpoint runs at roughly 90s per 500 members. Two thousand
 * in one go is about six minutes against a 300s limit, and the run would be
 * killed part way every time.
 *
 * So a title wanting two thousand a week needs two runs, which is exactly what
 * the Tuesday and Friday schedule is for.
 */
const MAX_PER_RUN = Number(process.env.DRIP_MAX_PER_RUN || 1000);

// ---- how fast each title is allowed to grow ----

/**
 * The weekly allowance, per title, in subscribers.
 *
 * JB, 11 September: two thousand a week on Smart SME, a thousand on the rest.
 * The schedule alone cannot express that, because it fires the same days for
 * every title, so the rate lives with the title in EngineSetting and the
 * schedule simply offers each title two chances a week to use it.
 *
 * A calendar week, not a rolling seven days. Rolling would let Tuesday's
 * thousand still count against the following Tuesday and silently halve the
 * rate; a Monday boundary means Tuesday and Friday always share one allowance.
 */
const WEEKLY_TARGET_KEY = "drip.weeklyTarget";
export const DEFAULT_WEEKLY_TARGET = Number(process.env.DRIP_WEEKLY_TARGET || 1000);

export async function getWeeklyTarget(siteId) {
  const row = await forSite(siteId).engineSetting.findUnique({ where: { key: WEEKLY_TARGET_KEY } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_WEEKLY_TARGET;
}

export async function setWeeklyTarget(siteId, target) {
  const value = String(Math.max(0, Math.round(Number(target))));
  return forSite(siteId).engineSetting.upsert({
    where: { key: WEEKLY_TARGET_KEY },
    create: { key: WEEKLY_TARGET_KEY, value },
    update: { value },
  });
}

/**
 * The instant UK wall clock last called Monday 00:00.
 *
 * Every other clock in the engine is UK wall clock (lib/agents/hours.js, the
 * worker's own gate), and a quota rolling over at UTC midnight would drift an
 * hour under BST relative to the 09:00 runs it governs.
 */
export function ukWeekStart(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );

  const DAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const sinceMonday = DAYS[parts.weekday] ?? 0;
  // en-GB with hour12:false reports midnight as "24" in some runtimes.
  const elapsed =
    ((Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;

  // getMilliseconds() too, because the parts above only go down to the second
  // and the remainder would otherwise ride along into the boundary.
  return new Date(now.getTime() - now.getMilliseconds() - elapsed - sinceMonday * 86400000);
}

export async function importedThisWeek(siteId, now = new Date()) {
  return forSite(siteId).newsletterProspect.count({
    where: { importedAt: { gte: ukWeekStart(now) } },
  });
}

/**
 * Who is still eligible to go up. One definition, used by the import, the
 * stats and the due-list, because three copies of it is how the stats come to
 * disagree with what the import actually does.
 *
 * The Apollo list IS the list. JB, 10 September: "take the verifier out of the
 * automation, just use the data list. We don't need and can't afford it."
 * Anything a verifier already condemned still stays out, because that judgement
 * is paid for and worth keeping, but an unchecked address is now simply an
 * address.
 */
const IMPORTABLE = {
  suppressed: false,
  importedAt: null,
  OR: [{ verifyStatus: null }, { verifyStatus: { notIn: ["bad", "invalid"] } }],
  email: { contains: "@" },
};

export async function countImportable(siteId) {
  return forSite(siteId).newsletterProspect.count({ where: IMPORTABLE });
}

export function isDripConfigured(mailchimp) {
  // The verifier is no longer part of this. Requiring its key here switched the
  // whole drip off for every title the moment the credits ran out.
  return Boolean(process.env.MAILCHIMP_API_KEY && mailchimp?.audienceId);
}

export function isDripEnabled() {
  return process.env.DRIP_ENABLED !== "false";
}

// ---- verification ----

// A value pasted into a dashboard often arrives wrapped in quotes or with a
// stray newline, and MillionVerifier just rejects it with no useful message.
function mvKey() {
  return (process.env.MILLIONVERIFIER_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}

/**
 * One address, checked against MillionVerifier. Exported because backlink
 * outreach needs exactly this and was doing without: the credits are already
 * bought and the wrapper already written, and every hard bounce in the inbox on
 * 17 August was an address this call would have rejected before sending.
 */
export async function verifyEmail(email) {
  return verifyOne(email);
}

async function verifyOne(email) {
  const url = `https://api.millionverifier.com/api/v3/?api=${mvKey()}&email=${encodeURIComponent(email)}&timeout=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  if (!d.quality) throw new Error(`no quality in response: ${JSON.stringify(d).slice(0, 120)}`);
  return { quality: d.quality, result: d.result };
}

export async function creditsRemaining() {
  const res = await fetch(`https://api.millionverifier.com/api/v3/credits?api=${mvKey()}`);
  const d = await res.json().catch(() => ({}));
  // Surface the reason rather than a bare null, or a bad key looks like "no credits".
  if (d.credits === undefined) throw new Error(`credits check failed: ${JSON.stringify(d).slice(0, 160)}`);
  return d.credits;
}

/**
 * Verify the next slice of the ranked list. Anything not "good" is suppressed
 * on the spot so it is never looked at again.
 */
export async function verifyProspects(site, limit = VERIFY_BATCH) {
  const db = forSite(site.id);
  let credits;
  try {
    credits = await creditsRemaining();
  } catch (e) {
    // Never burn a run's worth of addresses against a broken key.
    return { skipped: `MillionVerifier unreachable: ${e.message}` };
  }
  if (credits < limit) {
    return { skipped: `only ${credits} verification credits left, need ${limit}`, credits };
  }

  const due = await db.newsletterProspect.findMany({
    where: { suppressed: false, verifyStatus: null },
    orderBy: { rank: "asc" },
    take: limit,
    select: { id: true, email: true },
  });
  if (!due.length) return { done: true, verified: 0, message: "nothing left to verify" };

  const counts = { good: 0, risky: 0, bad: 0, failed: 0 };
  const failures = [];
  const queue = [...due];

  await Promise.all(
    Array.from({ length: VERIFY_CONCURRENCY }, async () => {
      while (queue.length) {
        const p = queue.pop();
        try {
          const { quality, result } = await verifyOne(p.email);
          counts[quality] = (counts[quality] ?? 0) + 1;
          await db.newsletterProspect.update({
            where: { id: p.id },
            data: {
              verifyStatus: quality,
              verifyResult: result,
              verifiedAt: new Date(),
              // Only proven-deliverable addresses stay in play. A catch-all
              // domain accepts at SMTP and bounces later, which is the worst
              // kind: you find out after the send.
              suppressed: quality !== "good",
              suppressReason: quality !== "good" ? `verify:${result}` : null,
            },
          });
        } catch (e) {
          counts.failed++; // left unverified, picked up on the next run
          if (failures.length < 3) failures.push(`${p.email}: ${e.message}`);
        }
      }
    })
  );

  return {
    verified: due.length,
    ...counts,
    creditsBefore: credits,
    ...(failures.length ? { failures } : {}),
  };
}

// ---- import ----

/**
 * The subscriber fields we carry into Mailchimp beyond a name.
 *
 * We hold a job title and a company for every single prospect, and a country
 * for 99% of them, but the import was sending only FNAME and LNAME and throwing
 * the rest away at the door. That data is the difference between a newsletter
 * and a mailing list: it is what lets an issue open "as an owner in retail"
 * rather than "hello", and what lets a segment be built at all. SIC is worth
 * carrying for the same reason, since it is the only machine-readable handle on
 * what a subscriber's business actually does.
 *
 * Tags are capped at 10 characters by Mailchimp.
 */
const MERGE_FIELDS = [
  { tag: "COMPANY", name: "Company", type: "text", from: (p) => p.company },
  { tag: "TITLE", name: "Job Title", type: "text", from: (p) => p.title },
  { tag: "COUNTRY", name: "Country", type: "text", from: (p) => p.companyCountry },
  { tag: "SIC", name: "SIC Code", type: "text", from: (p) => p.sic },
  // The readable half of SIC. A segment can be built on "Golf Courses" by
  // anyone; "7992" needs a lookup table nobody opening Mailchimp has.
  { tag: "INDUSTRY", name: "Industry", type: "text", from: (p) => industryFromSic(p.sic) },
  // The company's own domain, which the email address only implies — a
  // contact on a group mailbox or a personal domain still names their employer
  // here, and it is the join key against AdvertiserProspect.
  { tag: "WEBSITE", name: "Company Domain", type: "text", from: (p) => p.domain },
];

/**
 * Create any missing merge field on the audience. Idempotent: Mailchimp rejects
 * a duplicate tag with a 400, which is the success case on every run after the
 * first, so it is swallowed rather than treated as a failure. Called before an
 * import because a merge_fields value for a tag that does not exist is silently
 * dropped, not rejected, which would look like it worked.
 */
async function ensureMergeFields(audienceId) {
  let existing = new Set();
  try {
    const d = await mc(`/lists/${audienceId}/merge-fields?count=100`);
    existing = new Set((d.merge_fields ?? []).map((f) => f.tag));
  } catch {
    return { created: 0, error: "could not read merge fields" };
  }

  let created = 0;
  for (const f of MERGE_FIELDS) {
    if (existing.has(f.tag)) continue;
    try {
      await mc(`/lists/${audienceId}/merge-fields`, {
        method: "POST",
        body: JSON.stringify({ tag: f.tag, name: f.name, type: f.type, required: false, public: false }),
      });
      created += 1;
    } catch {
      // Already exists, or the account refused it. Either way the import below
      // still runs; a missing field costs that column, not the subscriber.
    }
  }
  return { created };
}

// Mailchimp silently truncates, but trimming here keeps what is stored equal to
// what we think is stored.
const mergeValuesFor = (p) =>
  Object.fromEntries(MERGE_FIELDS.map((f) => [f.tag, String(f.from(p) ?? "").slice(0, 255)]));

/**
 * Push the next batch of prospects into Mailchimp, up to this title's weekly
 * allowance.
 * Refuses if the previous issue bounced or drew complaints, so a deliverability
 * problem stops the ramp instead of being compounded by another thousand.
 */
export async function runDrip(site, { mailchimp, size, force = false } = {}) {
  const db = forSite(site.id);
  if (!isDripEnabled()) return { skipped: "DRIP_ENABLED=false" };
  if (!isDripConfigured(mailchimp)) {
    return { skipped: "needs MAILCHIMP_API_KEY and this title's audience id" };
  }
  const audienceId = mailchimp.audienceId;

  if (!force) {
    const health = await lastIssueHealth(audienceId);
    if (!health.ok) return { skipped: `previous issue unhealthy: ${health.reasons.join(", ")}`, health };
  }

  // What this title is allowed this week, less what it has already had. The
  // schedule offers two runs a week; a title on a thousand uses one of them and
  // finds nothing left to do on the other, which is the intended shape rather
  // than a fault.
  //
  // A run takes whatever is left of the allowance, up to MAX_PER_RUN. Those two
  // numbers together are the rate: Smart SME's two thousand is two runs of a
  // thousand, and the schedule has to offer it two, which is why Tuesday and
  // Friday is not optional decoration.
  const weeklyTarget = await getWeeklyTarget(site.id);
  const already = await importedThisWeek(site.id);
  const allowance = Math.max(0, weeklyTarget - already);
  if (!allowance) {
    return {
      imported: 0,
      message: `weekly allowance used: ${already} of ${weeklyTarget} since Monday`,
      weeklyTarget,
      importedThisWeek: already,
    };
  }
  const take = Math.min(size ?? allowance, allowance, MAX_PER_RUN);

  // The Apollo list IS the list. JB, 10 September: "take the verifier out of
  // the automation, just use the data list. We don't need and can't afford it."
  //
  // MillionVerifier had run to MINUS eleven credits, so verification stopped,
  // so nothing new ever became import-ready, so the drip quietly starved: Smart
  // SME's last import was 4 August with 4,014 already-verified people sitting
  // unimported behind a gate that could no longer open.
  //
  // Anything previously marked bad still stays out - that judgement is already
  // paid for and there is no sense throwing it away - but an unchecked address
  // is now simply an address. Mailchimp removes hard bounces by itself, which
  // is the safety net that actually costs nothing.
  const batch = await db.newsletterProspect.findMany({
    where: IMPORTABLE,
    orderBy: [{ verifyStatus: "asc" }, { rank: "asc" }],
    take,
  });
  if (!batch.length) {
    const waiting = await db.newsletterProspect.count({ where: { suppressed: false, importedAt: null } });
    return { imported: 0, message: waiting ? `nothing importable, ${waiting} left unimported` : "list exhausted" };
  }

  // Before the members go up, not after: a value sent for a tag that does not
  // exist yet is dropped without an error.
  await ensureMergeFields(audienceId);

  const tranche = (await db.newsletterProspect.aggregate({ _max: { tranche: true } }))._max.tranche ?? 0;
  const next = tranche + 1;
  const tag = `tranche-${String(next).padStart(3, "0")}`;

  let created = 0, updated = 0, imported = 0;
  const errors = [];
  for (let i = 0; i < batch.length; i += 500) {
    const slice = batch.slice(i, i + 500);
    const res = await mc(`/lists/${audienceId}`, {
      method: "POST",
      body: JSON.stringify({
        update_existing: true,
        members: slice.map((p) => ({
          email_address: p.email,
          email_type: "html",
          status: "subscribed",
          merge_fields: {
            FNAME: p.firstName ?? "",
            LNAME: p.lastName ?? "",
            ...mergeValuesFor(p),
          },
          tags: ["apollo", tag],
        })),
      }),
    });
    created += res.total_created ?? 0;
    updated += res.total_updated ?? 0;
    (res.errors ?? []).forEach((e) => errors.push(`${e.email_address}: ${e.error}`));

    // Write each slice back before the next one goes up, not all of them at the
    // end. The single write at the end is how 994 Smart SME contacts came to be
    // subscribed in Mailchimp under tranche-003 while the database still had
    // them queued: the upload landed, the function hit its time limit, and the
    // one statement that recorded it never ran. Those people were then re-sent
    // on every subsequent run and the drip made no progress at all. A slice at
    // a time means a run that dies half way keeps whatever it actually did.
    await db.newsletterProspect.updateMany({
      where: { id: { in: slice.map((p) => p.id) } },
      data: { importedAt: new Date(), tranche: next },
    });
    imported += slice.length;
  }

  return {
    imported,
    created,
    updated,
    tranche: next,
    tag,
    weeklyTarget,
    importedThisWeek: already + imported,
    errors: errors.slice(0, 10),
  };
}

// ---- reporting ----

export async function prospectStats(siteId) {
  const db = forSite(siteId);
  const [total, suppressed, imported, readyToImport, thisWeek, weeklyTarget, byResult] = await Promise.all([
    db.newsletterProspect.count(),
    db.newsletterProspect.count({ where: { suppressed: true } }),
    db.newsletterProspect.count({ where: { importedAt: { not: null } } }),
    countImportable(siteId),
    importedThisWeek(siteId),
    getWeeklyTarget(siteId),
    db.newsletterProspect.groupBy({ by: ["verifyResult"], _count: true }),
  ]);

  return {
    total,
    imported,
    suppressed,
    readyToImport,
    weeklyTarget,
    importedThisWeek: thisWeek,
    remainingThisWeek: Math.max(0, weeklyTarget - thisWeek),
    // At the rate this title is actually allowed to grow, not at the batch size.
    // Those two stopped being the same number when the allowance became per
    // title: Smart SME drains its queue twice as fast as anyone else.
    weeksRemaining: weeklyTarget > 0 ? Math.ceil(readyToImport / weeklyTarget) : null,
    byResult: Object.fromEntries(byResult.map((r) => [r.verifyResult ?? "unchecked", r._count])),
  };
}
