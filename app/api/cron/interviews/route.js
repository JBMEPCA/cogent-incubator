import Anthropic from "@anthropic-ai/sdk";
import { runInterviewSweep, draftInterviewArticle } from "@/lib/interviews";
import { siteCredentials } from "@/lib/site";
import { forSite } from "@/lib/prisma";
import { siteUrl, houseStyle } from "@/lib/voice";
import { publishToWordPress } from "@/lib/wordpress";
import { cronGuard, forEachSite } from "@/lib/cron";
import { runInboxLabels } from "@/lib/inbox-labels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The interview franchise, once an hour.
 *
 * Until now nothing watched this queue at all: a row sat on "asked" whether the
 * person had ignored us or written back the same afternoon, and the first three
 * replies were only found because somebody went looking by hand. Two of those
 * three came from an address we had never written to, one after a shared inbox
 * forwarded it internally and one from the subject's PR agency, so the sweep
 * reads by subject rather than by sender.
 *
 * It sends nothing that is not a templated mail to someone who already opted
 * in, and it never publishes.
 */
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;
  if (!anthropic) return Response.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  try {
    const sweep = await forEachSite(async ({ site }) => {
        const { creds } = await siteCredentials(site.id);
        const db = forSite(site.id);
        return runInterviewSweep(site, {
          db,
          creds,
          anthropic,
          siteUrl: siteUrl(site),
          // Drafting is injected rather than imported inside the sweep, so the
          // sweep stays testable without a WordPress account and a model key.
          draft: creds?.wordpress
            ? (target, ctx) =>
                draftInterviewArticle(site, target, {
                  db,
                  anthropic,
                  wp: creds.wordpress,
                  franchise: ctx.franchise,
                  siteUrl: siteUrl(site),
                  houseStyle: houseStyle(site),
                  publish: publishToWordPress,
                  makeArticle: (data) => db.article.create({ data }),
                })
            : null,
        });
    });

    // The hub inbox rides along here rather than on a cron trigger of its own.
    // It is mail work on an hourly route that already exists, and adding a
    // trigger would mean a wrangler deploy, which has previous for wiping the
    // worker's dashboard-set variables and taking the whole fleet's ticks with
    // it. Fleet-wide, so it runs once after the per-title loop, not inside it.
    //
    // Isolated deliberately: labelling is a convenience for JB, the interview
    // sweep is the franchise. A Gmail hiccup must not turn a good sweep into a
    // 500 that Cloudflare records as a failed tick.
    let inbox;
    try {
      inbox = await runInboxLabels();
    } catch (e) {
      inbox = { available: false, reason: e.message?.slice(0, 200) };
    }

    return Response.json({ ...sweep, inbox });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
