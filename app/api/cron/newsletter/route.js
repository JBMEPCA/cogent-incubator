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
        // No fallback to another title's mark, ever.
        //
        // This was "?? LOGO_PNG", and LOGO_PNG is Smart SME's. Airport had no
        // wordmark, so both of its issues went out under Smart SME's masthead:
        // 1,500 subscribers on 3 September and 1,576 on the 10th, each opening
        // an Airport Business Magazine email branded as another publication.
        // The comment above it even said this was the risk, and rated a
        // slightly wrong mark above a broken image. That trade is wrong. A
        // missing image is a gap; a rival masthead is a mistake the reader
        // notices and remembers.
        //
        // Every title has a wordmark now, so this should never fire. If a new
        // title is added without one, it sends with no logo and the run says
        // so, which is a loud, cheap failure rather than a silent brand error.
        const mark = wordmarkFor(site.slug)?.png ?? null;
        if (!mark) {
          console.error(`newsletter: no wordmark for ${site.slug}; sending without a masthead rather than another title's. Add it to scripts/build-brand-wordmarks.mjs.`);
        }
        return runNewsletter(site, { creds, dryRun, logoBase64: mark ? mark.toString("base64") : null });
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
