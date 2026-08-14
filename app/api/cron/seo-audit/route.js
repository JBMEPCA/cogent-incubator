import { runSeoAudit, isSeoAgentConfigured } from "@/lib/seo-agent";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
// 60 killed this route on every single call from 5 August: the audit now reads
// forty posts, runs the brand-link pass and thinks against a 20k ceiling, and
// none of that fits in a minute. Same line, same fault, same fix as the agents
// route: 60 was never a platform limit, and fluid compute is enabled here.
export const maxDuration = 300;

export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  try {
    return Response.json(
      await forEachSite(async ({ site, creds }) => {
        if (!isSeoAgentConfigured(creds.wordpress)) {
          return { skipped: "needs ANTHROPIC_API_KEY and this title's WordPress credentials" };
        }
        return runSeoAudit(site, creds.wordpress);
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
