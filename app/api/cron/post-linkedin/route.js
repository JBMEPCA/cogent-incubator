import { forEachSite, cronGuard } from "@/lib/cron";
import {
  publishPost,
  isLinkedInConfigured,
  dueFilter,
  withinPostingHours,
  postingHoursLabel,
  MAX_ATTEMPTS,
} from "@/lib/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Publishes approved posts whose slot has arrived. Only ever touches posts a
// human already approved: nothing the agent drafted can reach LinkedIn on its
// own. One per title per run, which is plenty against an hourly cron and a
// two-a-day target, and keeps a bad token from burning the whole queue in one go.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  // Belt and braces: slots are booked inside posting hours anyway, but a
  // backlog must not empty itself into the small hours after an outage.
  if (!withinPostingHours()) {
    return Response.json({ skipped: `outside posting hours (${postingHoursLabel()})` });
  }

  return Response.json(
    await forEachSite(async ({ site, db, creds }) => {
      if (!isLinkedInConfigured(creds.linkedin)) return { skipped: "LinkedIn not connected for this title" };

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
