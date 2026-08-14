import { prisma } from "@/lib/prisma";
import { publishPost, isLinkedInConfigured, dueFilter, MAX_ATTEMPTS } from "@/lib/linkedin";
import { withinOperatingHours, operatingHoursLabel } from "@/lib/agents/hours";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Publishes approved posts whose slot has arrived. Only ever touches posts a
// human already approved: nothing the agent drafted can reach LinkedIn on its
// own. One per run, which is plenty against an hourly cron and a two-a-day
// target, and keeps a bad token from burning the whole queue in one go.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isLinkedInConfigured()) return Response.json({ skipped: "LinkedIn not configured" });
  // Belt and braces: slots are booked inside posting hours anyway, but a
  // backlog must not empty itself into the small hours after an outage.
  if (!withinOperatingHours()) {
    return Response.json({ skipped: `outside operating hours (${operatingHoursLabel()})` });
  }

  const post = await prisma.linkedInPost.findFirst({
    where: dueFilter(),
    orderBy: { scheduledFor: "asc" },
  });
  if (!post) return Response.json({ posted: 0 });

  // Claim the attempt before the call, so a function timeout mid-publish cannot
  // leave a post retrying for ever, and three failures park it for a human.
  await prisma.linkedInPost.update({
    where: { id: post.id },
    data: { attempts: { increment: 1 } },
  });

  try {
    const result = await publishPost(post);
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { status: "posted", postedAt: new Date(), linkedinUrn: result.urn, publishError: null },
    });
    return Response.json({ posted: 1, url: result.url });
  } catch (e) {
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { publishError: e.message.slice(0, 500) },
    });
    return Response.json({
      posted: 0,
      error: e.message,
      attempts: post.attempts + 1,
      parked: post.attempts + 1 >= MAX_ATTEMPTS,
    });
  }
}
