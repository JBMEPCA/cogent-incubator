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

export async function refreshTrendsNow() {
  await requireEditor();
  const res = await refreshTrending();
  revalidatePath("/trending");
  return res;
}
