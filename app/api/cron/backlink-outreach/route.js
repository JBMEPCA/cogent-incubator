import { runBacklinkOutreach, runOutreachSends, isSendConfigured, outreachSetupHint } from "@/lib/outreach";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Drafting includes model calls and contact-page fetches, so 60s across five
// titles is not enough; fluid compute is on (see the agents route).
export const maxDuration = 300;

// Drafting AND sending, hourly. Drafting used to belong solely to the Backlink
// Manager's 12-hour housekeeping slot, where it competed with six other agents
// for one turn a tick — realistically twice a day, scanning two articles a
// run, against the 14-day lookback after which an article is never chased.
// That did not match the "hourly sweep" everyone believed in, or the
// dashboard's own "within six hours" copy. Scanning here is cheap when there
// is nothing new (the unscanned-articles query returns empty and no model is
// called), so the hourly tick can afford it; reply/bounce/link checks and
// reporting stay with the Backlink Manager, which keeps the audit trail.
//
// Fans out across the fleet: each title sends from its OWN mailbox, so a title
// with no outreach credential is skipped by name rather than stopping the run.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  try {
    return Response.json(
      await forEachSite(async ({ site, creds }) => {
        if (!isSendConfigured(creds)) return { skipped: outreachSetupHint(creds) };
        const drafted = await runBacklinkOutreach(site, creds);
        const sends = await runOutreachSends(site, creds);
        return { drafted, ...sends };
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
