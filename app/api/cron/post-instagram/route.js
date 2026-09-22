import { runInstagram } from "@/lib/instagram";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The daily Instagram post, for every title that has switched Instagram on in
 * its social_bridge setting. Called by the Cloudflare worker at 12:00 UK.
 *
 * ?dry=1 chooses the article and writes the caption without sending anything.
 * ?site=<slug> limits the run to one title.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const dryRun = Boolean(url.searchParams.get("dry"));
  const only = url.searchParams.get("site");
  return Response.json(
    await forEachSite(async ({ site, creds }) => {
      if (only && site.slug !== only) return { skipped: "not selected" };
      return runInstagram(site, { creds, dryRun });
    })
  );
}
