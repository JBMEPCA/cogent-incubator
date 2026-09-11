import { verifyProspects, runDrip, prospectStats, isDripConfigured, isDripEnabled } from "@/lib/prospects";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * Five titles, each uploading up to a thousand members in two Mailchimp calls,
 * inside ONE invocation. At 60s this route could not finish the fleet: on
 * 8 September it completed Airport's 609 and the clock ran out before it
 * reached the four titles behind it, which is the real reason three lists had
 * not grown since August. 300s is what the agent routes already run to.
 *
 * Cloudflare stops waiting at about 100s and reports 524 while the work carries
 * on and finishes, so this path is named in the worker's LONG_RUNNING list.
 */
export const maxDuration = 300;

/**
 * Two jobs behind one route, because they run on different clocks. Both fan out
 * across the fleet — each title has its own prospect list and its own audience.
 *
 *   ?mode=verify   retired, checks the next slice against MillionVerifier
 *   ?mode=import   Tuesday and Friday, pushes contacts into Mailchimp up to
 *                  each title's weekly allowance
 *   ?mode=stats    read-only, safe to hit by hand
 *
 * ?site=<slug> narrows any mode to one title, which is how a single title gets
 * re-run by hand without giving the other four an unplanned extra import.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "stats";
  if (!["stats", "verify", "import"].includes(mode)) {
    return Response.json({ error: `unknown mode "${mode}"` }, { status: 400 });
  }

  const only = url.searchParams.get("site");
  const limit = Number(url.searchParams.get("limit")) || undefined;
  const size = Number(url.searchParams.get("size")) || undefined;
  const force = url.searchParams.get("force") === "1";

  try {
    const out = await forEachSite(async ({ site, creds }) => {
      if (only && site.slug !== only) return { notThisTitle: true };
      if (mode === "stats") return { stats: await prospectStats(site.id) };

      if (!isDripConfigured(creds.mailchimp)) {
        return {
          skipped: "drip needs MAILCHIMP_API_KEY and an audience id",
          stats: await prospectStats(site.id),
        };
      }

      // Retired 10 September 2026, not deleted: a bare call still works if
      // anyone ever tops the credits up, but nothing schedules it and the
      // import no longer waits on it.
      if (mode === "verify") {
        if (!isDripEnabled()) return { skipped: "DRIP_ENABLED=false" };
        return { ...(await verifyProspects(site, limit)), stats: await prospectStats(site.id) };
      }

      // Once, after the work. Calling it before as well doubled the query count
      // on a route whose whole problem was running out of time.
      return {
        ...(await runDrip(site, { mailchimp: creds.mailchimp, size, force })),
        stats: await prospectStats(site.id),
      };
    });

    if (only) {
      const hit = out.results.filter((r) => !r.notThisTitle);
      // A slug that matches nothing would otherwise read as five clean skips,
      // which is exactly what a successful run of a quiet title looks like.
      if (!hit.length) {
        return Response.json({ error: `no active title with slug "${only}"` }, { status: 404 });
      }
      return Response.json({ sites: hit.length, ran: hit.filter((r) => r.ok).length, results: hit });
    }
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
