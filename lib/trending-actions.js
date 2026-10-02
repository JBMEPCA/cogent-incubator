"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireEditor } from "./permissions";
import { commissionTrend, refreshTrending } from "./trending";

// The Trending Topics tab is fleet-wide, so unlike lib/actions.js nothing here
// is bound to one title. The title a trend is commissioned for is chosen on the
// page and checked against the Site table in commissionTrend; a trend row is
// not tenanted, so there is no cross-title row to forge a reach into.

export async function commissionTrendAction(topicId, siteSlug) {
  await requireEditor();
  const res = await commissionTrend(String(topicId), String(siteSlug || ""));
  revalidatePath("/trending");
  return res;
}

export async function dismissTrend(topicId) {
  await requireEditor();
  await prisma.trendingTopic.updateMany({
    where: { id: String(topicId), status: { in: ["new", "irrelevant"] } },
    data: { status: "dismissed" },
  });
  revalidatePath("/trending");
}

/**
 * Put a QA-held trending piece back where the Editor will take it.
 *
 * A hold leaves the article in review with qaPassed false, and only the
 * Director's sweep moves it back to drafting, so waking the Editor alone would
 * draft a different article. Moved back here, the Editor's own repair path
 * takes it first: body and QA report are kept, only the faults are fixed.
 */
export async function resumeTrend(topicId) {
  await requireEditor();
  const topic = await prisma.trendingTopic.findUnique({ where: { id: String(topicId) } });
  if (!topic?.articleId || !topic.siteId) return;
  const { forSite } = await import("./prisma");
  await forSite(topic.siteId).article.updateMany({
    where: { id: topic.articleId, status: { in: ["review", "approved", "idea"] }, qaPassed: false },
    data: { status: "drafting", scheduledFor: null },
  });
}

/**
 * Publish a finished trending article now rather than on the next tick.
 *
 * Without this a ready piece waits for fill-schedule to time it and then for
 * publish-due to run, which the worker calls in the opposite order, so up to an
 * hour. Here it is timed for now and publish-due runs straight away. That run
 * covers every title, but only ever publishes what is already due, so the rest
 * of the fleet goes out exactly as it would have on the tick.
 */
export async function publishTrendNow(topicId) {
  await requireEditor();
  const topic = await prisma.trendingTopic.findUnique({ where: { id: String(topicId) } });
  if (!topic?.articleId || !topic.siteId) return { ok: false, error: "Not commissioned." };

  const { forSite } = await import("./prisma");
  const db = forSite(topic.siteId);
  const article = await db.article.findUnique({
    where: { id: topic.articleId },
    select: { status: true, qaPassed: true, imageUrl: true, body: true },
  });
  if (!article) return { ok: false, error: "The article no longer exists." };
  if (article.status === "published") return { ok: true, published: true };
  if (!article.body || !article.qaPassed) return { ok: false, error: "Not through QA yet." };
  if (!article.imageUrl) return { ok: false, error: "Still needs a picture." };

  await db.article.update({ where: { id: topic.articleId }, data: { scheduledFor: new Date() } });
  const { GET } = await import("@/app/api/cron/publish-due/route");
  const headers = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  await GET(new Request("http://internal/api/cron/publish-due", { headers }));

  const after = await db.article.findUnique({ where: { id: topic.articleId }, select: { status: true } });
  revalidatePath("/trending");
  return after?.status === "published"
    ? { ok: true, published: true }
    : { ok: false, error: "Timed for now; publish-due deferred it, so the next tick will retry." };
}

export async function refreshTrendsNow() {
  await requireEditor();
  const res = await refreshTrending();
  revalidatePath("/trending");
  return res;
}
