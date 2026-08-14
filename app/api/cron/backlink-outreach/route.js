import { runOutreachSends, isSendConfigured, outreachSetupHint } from "@/lib/outreach";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sending only. Finding mentions, chasing replies and checking for the link all
// belong to the Backlink Manager now, so they happen once, in one place, with
// an audit trail. This endpoint exists separately because an email JB has just
// approved should leave within the tick rather than waiting for the agent's
// turn, and because sending must keep working outside office hours.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isSendConfigured()) {
    return Response.json({ skipped: outreachSetupHint() });
  }
  try {
    return Response.json(await runOutreachSends());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
