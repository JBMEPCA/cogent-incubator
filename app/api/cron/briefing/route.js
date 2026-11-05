import { runBriefing } from "@/lib/briefing";
import { isNewsletterConfigured } from "@/lib/newsletter";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Same ceiling as Thursday's route, for the same reason: one attempt a week,
// and a timeout is a missed issue rather than a retry.
export const maxDuration = 300;

/**
 * The Monday briefing, for every title whose newsletter is switched on.
 * Driven by the Cloudflare worker at 14:00 UK on Mondays.
 *
 * ?dry=1 chooses the stories and renders the email without touching Mailchimp.
 * ?site=<slug> limits the run to one title, which is how the worker fans the
 *   fleet out into one request each.
 * ?due=1 lists the titles that would be attempted, and touches nothing.
 * ?test=a@b.com,c@d.com sends a proof to those addresses only, then deletes
 *   the draft. Never reaches the list.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const dryRun = Boolean(url.searchParams.get("dry"));
  const only = url.searchParams.get("site");

  // Same cheap listing as the Thursday route. Monday has not lost a title yet,
  // but it is the same ten titles through the same 300s limit, so it is the
  // same accident waiting for the lists to grow a little more.
  if (url.searchParams.get("due")) {
    const due = [];
    await forEachSite(async ({ site, creds }) => {
      if (site.newsletterEnabled && isNewsletterConfigured(creds.mailchimp)) due.push(site.slug);
      return {};
    });
    return Response.json({ due });
  }
  const testEmails = (url.searchParams.get("test") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));

  try {
    return Response.json(
      await forEachSite(async ({ site, creds }) => {
        if (only && site.slug !== only) return { skipped: "not selected" };
        if (!isNewsletterConfigured(creds.mailchimp)) return { skipped: "newsletter not configured" };
        return runBriefing(site, { creds, dryRun, testEmails: testEmails.length ? testEmails : null });
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
