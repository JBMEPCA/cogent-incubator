import { runBacklinkCheck, dueToRun } from "@/lib/outreach";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    // Once a day. A news page that has not been updated in the last hour will
    // not have been updated in the last fifteen minutes either.
    if (!(await dueToRun("backlink_last_check", 24))) {
      return Response.json({ skipped: "throttled" });
    }
    return Response.json(await runBacklinkCheck());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
