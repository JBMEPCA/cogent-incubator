/**
 * The subscriber drip: verify, then import, a thousand a week.
 *
 * Split into two passes on purpose. Verification is slow (MillionVerifier does
 * a live SMTP check per address) and Vercel kills a function at 60 seconds, so
 * a daily pass verifies a couple of hundred and a weekly pass imports whatever
 * has come back clean. Neither can run long enough to be killed mid-batch.
 *
 * Nothing unverified ever reaches Mailchimp. On the first tranche, Apollo's own
 * "not catch-all" flag turned out to be wrong for 11% of contacts, so its data
 * decides ranking order and nothing else.
 */

import { prisma, forSite } from "./prisma";
import { mc, lastIssueHealth } from "./newsletter";

const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || "707a3f613c";
const VERIFY_BATCH = Number(process.env.DRIP_VERIFY_BATCH || 200);
const IMPORT_BATCH = Number(process.env.DRIP_IMPORT_BATCH || 1000);
const VERIFY_CONCURRENCY = 12;

export function isDripConfigured() {
  return Boolean(process.env.MAILCHIMP_API_KEY && process.env.MILLIONVERIFIER_API_KEY);
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
];

/**
 * Create any missing merge field on the audience. Idempotent: Mailchimp rejects
 * a duplicate tag with a 400, which is the success case on every run after the
 * first, so it is swallowed rather than treated as a failure. Called before an
 * import because a merge_fields value for a tag that does not exist is silently
 * dropped, not rejected, which would look like it worked.
 */
async function ensureMergeFields() {
  let existing = new Set();
  try {
    const d = await mc(`/lists/${AUDIENCE_ID}/merge-fields?count=100`);
    existing = new Set((d.merge_fields ?? []).map((f) => f.tag));
  } catch {
    return { created: 0, error: "could not read merge fields" };
  }

  let created = 0;
  for (const f of MERGE_FIELDS) {
    if (existing.has(f.tag)) continue;
    try {
      await mc(`/lists/${AUDIENCE_ID}/merge-fields`, {
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
 * Push the next batch of verified-good prospects into Mailchimp.
 * Refuses if the previous issue bounced or drew complaints, so a deliverability
 * problem stops the ramp instead of being compounded by another thousand.
 */
export async function runDrip(site, { size = IMPORT_BATCH, force = false } = {}) {
  const db = forSite(site.id);
  if (!isDripEnabled()) return { skipped: "DRIP_ENABLED=false" };
  if (!isDripConfigured()) return { skipped: "needs MAILCHIMP_API_KEY and MILLIONVERIFIER_API_KEY" };

  if (!force) {
    const health = await lastIssueHealth();
    if (!health.ok) return { skipped: `previous issue unhealthy: ${health.reasons.join(", ")}`, health };
  }

  const batch = await db.newsletterProspect.findMany({
    where: { suppressed: false, importedAt: null, verifyStatus: "good" },
    orderBy: { rank: "asc" },
    take: size,
  });
  if (!batch.length) {
    const waiting = await db.newsletterProspect.count({ where: { suppressed: false, verifyStatus: null } });
    return { imported: 0, message: waiting ? `nothing verified yet, ${waiting} awaiting verification` : "list exhausted" };
  }

  // Before the members go up, not after: a value sent for a tag that does not
  // exist yet is dropped without an error.
  await ensureMergeFields();

  const tranche = (await db.newsletterProspect.aggregate({ _max: { tranche: true } }))._max.tranche ?? 0;
  const next = tranche + 1;
  const tag = `tranche-${String(next).padStart(3, "0")}`;

  let created = 0, updated = 0;
  const errors = [];
  for (let i = 0; i < batch.length; i += 500) {
    const slice = batch.slice(i, i + 500);
    const res = await mc(`/lists/${AUDIENCE_ID}`, {
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
  }

  await db.newsletterProspect.updateMany({
    where: { id: { in: batch.map((p) => p.id) } },
    data: { importedAt: new Date(), tranche: next },
  });

  return { imported: batch.length, created, updated, tranche: next, tag, errors: errors.slice(0, 10) };
}

// ---- reporting ----

export async function prospectStats(siteId) {
  const db = forSite(siteId);
  const [total, suppressed, imported, verified, unverified, byResult] = await Promise.all([
    db.newsletterProspect.count(),
    db.newsletterProspect.count({ where: { suppressed: true } }),
    db.newsletterProspect.count({ where: { importedAt: { not: null } } }),
    db.newsletterProspect.count({ where: { verifyStatus: "good", suppressed: false } }),
    db.newsletterProspect.count({ where: { verifyStatus: null, suppressed: false } }),
    db.newsletterProspect.groupBy({ by: ["verifyResult"], _count: true }),
  ]);

  const readyToImport = await db.newsletterProspect.count({
    where: { suppressed: false, importedAt: null, verifyStatus: "good" },
  });

  return {
    total,
    imported,
    suppressed,
    verifiedGood: verified,
    awaitingVerification: unverified,
    readyToImport,
    weeksRemaining: Math.ceil((unverified + readyToImport) / IMPORT_BATCH),
    byResult: Object.fromEntries(byResult.map((r) => [r.verifyResult ?? "unchecked", r._count])),
  };
}
