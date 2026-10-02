import { cronGuard } from "@/lib/cron";
import { refreshTrending } from "@/lib/trending";

export const dynamic = "force-dynamic";
// The first run in a market classifies ~190 terms; later runs only the new ones.
export const maxDuration = 300;

// Twice an hour from the Cloudflare worker. Google's "Trending now" feed turns
// over within the hour, and the whole value of the Trending Topics tab is being
// early, so this rides both the hourly and the half-past triggers. A run where
// nothing is new costs one fetch per market and no model call.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  try {
    return Response.json(await refreshTrending());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
