import { forEachSite, cronGuard } from "@/lib/cron";
import { draftArticle, isDraftingConfigured } from "@/lib/drafting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Drafts ONE queued article per title per invocation. Articles in status
// "drafting" are the queue.
//
// The one-per-invocation limit was set by the 60s function cap when there was a
// single title. With a fleet it is a per-title limit inside a loop, which is
// worse: twenty-five titles each drafting one article in sequence will exceed
// the cap long before the last one is reached. This is exactly what the AgentJob
// queue in docs/game-plan.md §3.3 exists to fix — until then, keep the enabled
// title count small or accept that later titles get skipped.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;

  const out = await forEachSite(
    async ({ site, db }) => {
      if (!isDraftingConfigured()) return { skipped: "ANTHROPIC_API_KEY not set" };

      const next = await db.article.findFirst({
        where: { status: "drafting", body: null },
        orderBy: { createdAt: "asc" },
      });
      if (!next) return { drafted: 0, queue: 0 };

      // A failure is returned rather than thrown so one title's bad draft does
      // not abort the titles queued behind it.
      try {
        const result = await draftArticle(site, next.id);
        const remaining = await db.article.count({ where: { status: "drafting", body: null } });
        return { drafted: 1, article: result.title, queue: remaining };
      } catch (e) {
        return { drafted: 0, error: e.message, articleId: next.id };
      }
    },
    // Drafting is the most expensive thing the engine does, so it respects each
    // title's own working hours rather than running through the night.
    { respectHours: true }
  );

  return Response.json(out);
}
