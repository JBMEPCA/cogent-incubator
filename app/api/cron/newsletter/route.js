import { LOGO_PNG } from "@/lib/brand/logo";
import { runNewsletter, isNewsletterConfigured, isNewsletterEnabled, lastIssueHealth } from "@/lib/newsletter";

export const dynamic = "force-dynamic";
// Measured at 31.7s before Mailchimp is touched at all (19.5s of that is the
// deliverability check scanning 200 reports, 11.3s the selection call), then
// five more API calls on top. That is far too close to 60 for something that
// gets one attempt a week, and a timeout here is a missed issue, not a retry.
export const maxDuration = 300;

/**
 * Weekly issue. Driven by .github/workflows/newsletter.yml because Vercel Hobby
 * only allows daily crons.
 *
 * ?dry=1 picks the stories and validates the render without creating anything
 * in Mailchimp. Safe to hit by hand.
 * ?health=1 reports how the previous issue landed and sends nothing.
 */
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);

  if (url.searchParams.get("health")) {
    if (!isNewsletterConfigured()) return Response.json({ skipped: "not configured" });
    try {
      return Response.json(await lastIssueHealth());
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  if (!isNewsletterEnabled()) {
    return Response.json({ skipped: "NEWSLETTER_ENABLED=false" });
  }
  if (!isNewsletterConfigured()) {
    return Response.json({ skipped: "newsletter needs MAILCHIMP_API_KEY + ANTHROPIC_API_KEY" });
  }

  try {
    const result = await runNewsletter({
      dryRun: Boolean(url.searchParams.get("dry")),
      logoBase64: LOGO_PNG.toString("base64"),
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
