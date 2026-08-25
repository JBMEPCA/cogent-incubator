import { cronGuard, forEachSite } from "@/lib/cron";
import { targetBoard } from "@/lib/targets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily: write each title's audience snapshot (cumulative GA4 visitors,
// Mailchimp list size) and stamp any target crossed since yesterday. The
// per-title dashboard does the same on render, so this exists for the days
// nobody opens the page — an achievement date should be the day it happened,
// not the day someone next looked.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  try {
    return Response.json(
      await forEachSite(async (ctx) => {
        const board = await targetBoard(ctx);
        return { done: board.done, total: board.total, newlyAchieved: board.fresh };
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
