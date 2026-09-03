import { forEachSite, cronGuard } from "@/lib/cron";
import {
  publishPost,
  authFor,
  isLinkedInConfigured,
  dueFilter,
  DRAFT_EXPIRY_DAYS,
  withinPostingHours,
  postingHoursLabel,
  MAX_ATTEMPTS,
} from "@/lib/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Publishes due posts, one per title per run - enough against an hourly cron,
// and a bad token cannot burn the whole queue in one go. Since 25 Aug 2026
// drafts post THEMSELVES after a two-hour override window (JB: nothing waits
// for a human); the dashboard approve button just skips the window, and
// anything older than DRAFT_EXPIRY_DAYS expires unposted instead of going out
// stale.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  // Belt and braces: slots are booked inside posting hours anyway, but a
  // backlog must not empty itself into the small hours after an outage.
  if (!withinPostingHours()) {
    return Response.json({ skipped: `outside posting hours (${postingHoursLabel()})` });
  }

  return Response.json(
    await forEachSite(async ({ site, db }) => {
      // News that sat unposted for days is not news. Expired, with the reason.
      // BEFORE the connected check: no title is connected yet, so below it the
      // drafts this exists to clear were exactly the ones it could never reach.
      // Stale means its SLOT went by unposted, not that it has a birthday.
      //
      // This measured age from createdAt, so a post written on Friday for
      // Thursday's 09:00 slot was killed the moment that slot arrived - doing
      // exactly what it was booked to do. 47 posts died that way, including
      // four due at 09:00 on 3 September, and it was invisible because no title
      // is connected yet so nothing could post regardless.
      //
      // A post with no slot at all still ages out on when it was written:
      // nothing is going to come and give it a time.
      const cutoff = new Date(Date.now() - DRAFT_EXPIRY_DAYS * 864e5);
      const stale = await db.linkedInPost.updateMany({
        where: {
          status: { in: ["draft", "approved"] },
          postedAt: null,
          OR: [
            { scheduledFor: { lt: cutoff } },
            { scheduledFor: null, createdAt: { lt: cutoff } },
          ],
        },
        data: { status: "expired", publishError: `slot passed unposted more than ${DRAFT_EXPIRY_DAYS} days ago; expired rather than posted stale` },
      });

      if (!isLinkedInConfigured(await authFor(site)))
        return { skipped: "LinkedIn not connected for this title", expired: stale.count };

      const post = await db.linkedInPost.findFirst({
        where: dueFilter(),
        orderBy: { scheduledFor: "asc" },
      });
      if (!post) return { posted: 0 };

      // Claim the attempt before the call, so a function timeout mid-publish
      // cannot leave a post retrying for ever, and three failures park it.
      await db.linkedInPost.update({
        where: { id: post.id },
        data: { attempts: { increment: 1 } },
      });

      try {
        const result = await publishPost(site, post);
        // No URN, no post. LinkedIn returns an identifier for anything it
        // actually published, so a result without one means the call went
        // through the motions and put nothing on the page. Four posts were
        // recorded as published on 2 September with no URN against them - the
        // record claimed publications that never happened, which is worse than
        // a visible failure because nobody goes looking for it.
        if (!result?.urn) {
          throw new Error("LinkedIn returned no post id, so nothing was published");
        }
        await db.linkedInPost.update({
          where: { id: post.id },
          data: { status: "posted", postedAt: new Date(), linkedinUrn: result.urn, publishError: null },
        });
        return { posted: 1, url: result.url };
      } catch (e) {
        await db.linkedInPost.update({
          where: { id: post.id },
          data: { publishError: e.message.slice(0, 500) },
        });
        return {
          posted: 0,
          error: e.message,
          attempts: post.attempts + 1,
          parked: post.attempts + 1 >= MAX_ATTEMPTS,
        };
      }
    })
  );
}
