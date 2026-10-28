import { cronGuard } from "@/lib/cron";
import { refreshDomainRatings } from "@/lib/domain-rating";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Once a day from vercel.json. Domain Rating moves slowly, so daily is plenty.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  try {
    return Response.json(await refreshDomainRatings());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
