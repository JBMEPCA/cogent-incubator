import { askForHeadshots, swapInHeadshots } from "@/lib/headshots";
import { siteCredentials } from "@/lib/site";
import { forSite } from "@/lib/prisma";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly: ask companies for a photo of anyone whose story went out under a
 * name card, and put the photo on the story when they send one. See
 * lib/headshots.js. The swap runs first, so a reply is never kept waiting
 * behind the contact hunt.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const result = await forEachSite(async ({ site }) => {
    const { creds } = await siteCredentials(site.id);
    const db = forSite(site.id);
    const swap = await swapInHeadshots(site, { db, creds });
    const ask = await askForHeadshots(site, { db, creds });
    return { swapped: swap.swapped, asked: ask.asked, notes: [...(swap.notes || []), ...(ask.notes || [])] };
  });
  return Response.json(result);
}
