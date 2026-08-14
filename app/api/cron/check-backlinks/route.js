import { runBacklinkCheck, dueToRun } from "@/lib/outreach";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  try {
    return Response.json(
      await forEachSite(async ({ site }) => {
        // Once a day, per title. A news page that has not been updated in the
        // last hour will not have been updated in the last fifteen minutes
        // either. The throttle is per title because the cursor lives in that
        // title's EngineSetting row.
        if (!(await dueToRun(site, "backlink_last_check", 24))) {
          return { skipped: "throttled" };
        }
        return runBacklinkCheck(site);
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
