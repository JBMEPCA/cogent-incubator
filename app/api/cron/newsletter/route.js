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
        // The title's OWN masthead, and no fallback to another title's, ever.
        //
        // This used to fall back to LOGO_PNG, which is Smart SME's. Barbering
        // and Airport had no entry in wordmarks.js, so their issues went out
        // under Smart SME's masthead: Airport's 1,500 subscribers on 3 September
        // and 1,576 on the 10th. A missing image is a gap; a rival masthead is
        // a mistake the reader notices and remembers. If a new title is added
        // without a mark it sends with its name as text and the run says so.
        const mark = wordmarkFor(site.slug);
        const logo = mark?.masthead || mark?.png || null;

        // The masthead rides along in every reply, health and dry run included.
        // Every pre-send check used to answer a question about a number and not
        // one said what the reader would see at the top of the page, which is
        // how Airport's issues went out branded as another publication.
        const masthead = logo
          ? `${site.slug}, ${mark.mastheadWidth || mark.width}x${mark.mastheadHeight || mark.height}`
          : "NONE - this title has no masthead and will send its name as text";
        if (health) {
          return { masthead, health: await lastIssueHealth(creds.mailchimp.audienceId) };
        }
        if (!logo) {
          console.error(`newsletter: no masthead for ${site.slug}; sending with the name as text. Add it to scripts/build-brand-wordmarks.mjs.`);
        }
        const result = await runNewsletter(site, { creds, dryRun, logoBase64: logo ? logo.toString("base64") : null });
        return { masthead, ...result };
      })
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
