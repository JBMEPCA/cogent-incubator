import { prisma } from "./prisma";
import { getSiteContext, engineCanRun, withinOfficeHours } from "./site";

// Shared plumbing for the scheduled jobs.
//
// Every cron route used to do one title's work because there was only one. They
// now fan out across the fleet, and the fan-out is here rather than copied into
// nine route files where it would drift.
//
// This is the SIMPLE version: iterate the enabled titles in sequence and do each
// one's work. It is correct, and it is the right shape while the fleet is small.
// It is NOT the work queue described in docs/game-plan.md §3.3 — at twenty-five
// titles a sequential loop inside one serverless invocation will exceed the
// function limit long before it reaches the last title, and there is no
// fairness, so a title whose work is slow starves the ones behind it. Swap this
// for AgentJob + SELECT ... FOR UPDATE SKIP LOCKED before the fleet grows.

/** Reject an unauthenticated cron call. Fails CLOSED in production. */
export function cronGuard(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    // Previously `if (secret && auth !== ...)`, which meant an unset variable
    // left every cron endpoint wide open — and /api/cron/agents spends money.
    if (process.env.NODE_ENV === "production") {
      return new Response("CRON_SECRET is not set", { status: 500 });
    }
    return null; // local development
  }
  if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return null;
}

/**
 * Titles the scheduler should touch this tick.
 *
 * `respectHours` skips a title outside its own working window rather than the
 * fleet's, because office hours are per title and a fleet spanning timezones
 * has no single shift.
 */
export async function activeSites({ respectHours = false } = {}) {
  const sites = await prisma.site.findMany({
    where: { engineEnabled: true, status: { in: ["live", "cold_start"] } },
    select: { slug: true },
    orderBy: { createdAt: "asc" },
  });

  const out = [];
  for (const { slug } of sites) {
    const ctx = await getSiteContext(slug);
    if (!ctx) continue;
    if (!engineCanRun(ctx.site).ok) continue;
    if (respectHours && !withinOfficeHours(ctx.site)) continue;
    out.push(ctx);
  }
  return out;
}

/**
 * Run one job for every active title and collect the results.
 *
 * A failure on one title is recorded and the loop continues: one broken
 * WordPress connection must never stop the other twenty-four titles publishing.
 */
export async function forEachSite(job, opts = {}) {
  const sites = await activeSites(opts);
  const results = [];

  for (const ctx of sites) {
    try {
      const value = await job(ctx);
      results.push({ site: ctx.site.slug, ok: true, ...value });
    } catch (err) {
      results.push({ site: ctx.site.slug, ok: false, error: err?.message?.slice(0, 300) });
    }
  }

  return {
    sites: results.length,
    ran: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
