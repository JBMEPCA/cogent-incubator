import { runAdvertiserHunt, huntProgress } from "@/lib/advertiser-hunt";
import { cronGuard } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Finds a published contact on each advertiser's own website, tier A first,
 * about 300 brands a run. See lib/advertiser-hunt.js.
 *
 * Last in the worker's hourly and half-past lists, so a sweep never holds up
 * publishing. Its own budget is 80s, inside Cloudflare's ~100s patience, so
 * it answers rather than 524s.
 *
 *   (default)   run a sweep
 *   ?mode=stats read-only progress, safe to hit by hand
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const mode = new URL(request.url).searchParams.get("mode");
  try {
    if (mode === "stats") return Response.json(await huntProgress());
    return Response.json(await runAdvertiserHunt());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
