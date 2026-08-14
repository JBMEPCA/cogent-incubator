import { verifyProspects, runDrip, prospectStats, isDripConfigured, isDripEnabled } from "@/lib/prospects";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Two jobs behind one route, because they run on different clocks. Both fan out
 * across the fleet — each title has its own prospect list and its own audience.
 *
 *   ?mode=verify   daily, checks the next slice against MillionVerifier
 *   ?mode=import   weekly, pushes verified-good contacts into Mailchimp
 *   ?mode=stats    read-only, safe to hit by hand
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "stats";
  if (!["stats", "verify", "import"].includes(mode)) {
    return Response.json({ error: `unknown mode "${mode}"` }, { status: 400 });
  }

  const limit = Number(url.searchParams.get("limit")) || undefined;
  const size = Number(url.searchParams.get("size")) || undefined;
  const force = url.searchParams.get("force") === "1";

  try {
    return Response.json(
      await forEachSite(async ({ site, creds }) => {
        const stats = await prospectStats(site.id);
        if (mode === "stats") return { stats };

        if (!isDripConfigured(creds.mailchimp)) {
          return { skipped: "drip needs MAILCHIMP_API_KEY, MILLIONVERIFIER_API_KEY and an audience id", stats };
        }

        if (mode === "verify") {
          if (!isDripEnabled()) return { skipped: "DRIP_ENABLED=false", stats };
          return { ...(await verifyProspects(site, limit)), stats: await prospectStats(site.id) };
        }

        return {
          ...(await runDrip(site, { mailchimp: creds.mailchimp, size, force })),
          stats: await prospectStats(site.id),
        };
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
