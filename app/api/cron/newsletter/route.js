import { LOGO_PNG } from "@/lib/brand/logo";
import { wordmarkFor } from "@/lib/brand/wordmarks";
import { runNewsletter, isNewsletterConfigured, lastIssueHealth } from "@/lib/newsletter";
import { cronGuard, forEachSite } from "@/lib/cron";

export const dynamic = "force-dynamic";
// Measured at 31.7s before Mailchimp is touched at all (19.5s of that is the
// deliverability check scanning 200 reports, 11.3s the selection call), then
// five more API calls on top. That is far too close to 60 for something that
// gets one attempt a week, and a timeout here is a missed issue, not a retry.
export const maxDuration = 300;

/**
 * Weekly issue, for every title whose newsletter is switched on. Driven by
 * .github/workflows/newsletter.yml because Vercel Hobby only allows daily crons.
 *
 * ?dry=1 picks the stories and validates the render without creating anything
 * in Mailchimp. Safe to hit by hand.
 * ?health=1 reports how the previous issue landed and sends nothing.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const health = Boolean(url.searchParams.get("health"));
  const dryRun = Boolean(url.searchParams.get("dry"));

  try {
    return Response.json(
      await forEachSite(async ({ site, creds }) => {
        if (!isNewsletterConfigured(creds.mailchimp)) return { skipped: "newsletter not configured" };
        if (health) return { health: await lastIssueHealth(creds.mailchimp.audienceId) };
        // The title's OWN wordmark. LOGO_PNG is Smart SME's, so every issue
        // from every other title carried Smart SME's masthead — the same
        // single-title assumption the playbook keeps finding, this time on the
        // one image every subscriber sees first. It stays as the fallback,
        // because a slightly wrong mark beats a broken image in a sent email.
        const mark = wordmarkFor(site.slug)?.png ?? LOGO_PNG;
        return runNewsletter(site, { creds, dryRun, logoBase64: mark.toString("base64") });
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
