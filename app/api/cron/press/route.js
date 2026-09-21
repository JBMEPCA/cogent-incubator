import { cronGuard } from "@/lib/cron";
import { runPressIntake } from "@/lib/press-intake";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The press desk, every fifteen minutes, around the clock.
 *
 * JB's rule, 21 Sep 2026: a release sent to press@ is live within the hour, so
 * we are early rather than one of fifty. The engine's own clock ticks only at
 * :05 and :35 inside UK office hours, which would leave an evening release
 * until morning, so this has a Cloudflare trigger of its own and nothing else
 * runs on it. A tick with no new mail costs one Gmail query per title.
 *
 * ?dry=1 is not offered on purpose: sorting is where the money is saved, and a
 * dry run that sorts spends it anyway. Test by sending a real release.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const result = await runPressIntake();
  return Response.json(result);
}
