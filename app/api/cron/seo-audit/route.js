import { runSeoAudit, isSeoAgentConfigured } from "@/lib/seo-agent";

export const dynamic = "force-dynamic";
// 60 killed this route on every single call from 5 August: the audit now reads
// forty posts, runs the brand-link pass and thinks against a 20k ceiling, and
// none of that fits in a minute. Same line, same fault, same fix as the agents
// route: 60 was never a platform limit, and fluid compute is enabled here.
export const maxDuration = 300;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isSeoAgentConfigured()) {
    return Response.json({ skipped: "SEO agent needs ANTHROPIC_API_KEY + WordPress" });
  }
  try {
    const result = await runSeoAudit();
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
