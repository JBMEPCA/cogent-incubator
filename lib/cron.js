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

  // Rotate the starting title by the hour. The list is createdAt ascending, so
  // a fixed order meant the tick's time budget always ran out on the NEWEST
  // titles - the ones in cold start, where a missed tick matters most. The
  // 14 Aug audit put the sequential loop's ceiling at roughly four titles and
  // said to replace it with the AgentJob queue before title #5; title #5 is
  // live, so until that rewrite lands, rotation at least shares the starvation
  // equally: every title leads the loop for one hour in each cycle of
  // out.length. Keyed to the UTC hour so the :05 and :35 ticks of the same
  // hour, and the director and worker stages within them, all see one order.
  if (out.length > 1) {
    const offset = new Date().getUTCHours() % out.length;
    return [...out.slice(offset), ...out.slice(0, offset)];
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

  // `index` and `total` are handed to the job so a job working to a shared
  // wall-clock budget can take its own share of it rather than whatever the
  // titles before it happened to leave. Without them the loop is first come,
  // first served: on 20 Aug 2026 scan-feeds spent its whole 45s on Smart SME
  // and Fleet and gave Golf, the newest and least established title, nothing
  // at all — and reported it as a clean run.
  for (const [index, ctx] of sites.entries()) {
    try {
      const value = await job({ ...ctx, index, total: sites.length });
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
