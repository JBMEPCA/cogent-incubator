import { runOutreachSends, isSendConfigured, outreachSetupHint } from "@/lib/outreach";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sending only. Finding mentions, chasing replies and checking for the link all
// belong to the Backlink Manager now, so they happen once, in one place, with
// an audit trail. This endpoint exists separately because an email JB has just
// approved should leave within the tick rather than waiting for the agent's
// turn, and because sending must keep working outside office hours.
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
        return runOutreachSends(site, creds);
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
