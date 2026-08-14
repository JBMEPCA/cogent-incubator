import { verifyProspects, runDrip, prospectStats, isDripConfigured, isDripEnabled } from "@/lib/prospects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Two jobs behind one route, because they run on different clocks.
 *
 *   ?mode=verify   daily, checks the next slice against MillionVerifier
 *   ?mode=import   weekly, pushes verified-good contacts into Mailchimp
 *   ?mode=stats    read-only, safe to hit by hand
 */
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "stats";

  if (!isDripConfigured()) {
    return Response.json({ skipped: "drip needs MAILCHIMP_API_KEY + MILLIONVERIFIER_API_KEY" });
  }

  try {
    if (mode === "stats") return Response.json(await prospectStats());

    if (mode === "verify") {
      if (!isDripEnabled()) return Response.json({ skipped: "DRIP_ENABLED=false" });
      const limit = Number(url.searchParams.get("limit")) || undefined;
      return Response.json({ ...(await verifyProspects(limit)), stats: await prospectStats() });
    }

    if (mode === "import") {
      const size = Number(url.searchParams.get("size")) || undefined;
      const force = url.searchParams.get("force") === "1";
      return Response.json({ ...(await runDrip({ size, force })), stats: await prospectStats() });
    }

    return Response.json({ error: `unknown mode "${mode}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
