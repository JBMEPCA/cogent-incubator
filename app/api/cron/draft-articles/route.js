import { prisma } from "@/lib/prisma";
import { draftArticle, isDraftingConfigured } from "@/lib/drafting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Drafts ONE queued article per invocation (Vercel Hobby 60s cap). Articles in
// status "drafting" are the queue; the GitHub Action calls this a few times
// per run. No-ops cleanly until ANTHROPIC_API_KEY exists.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isDraftingConfigured()) {
    return Response.json({ skipped: "ANTHROPIC_API_KEY not set" });
  }

  const next = await prisma.article.findFirst({
    where: { status: "drafting", body: null },
    orderBy: { createdAt: "asc" },
  });
  if (!next) {
    return Response.json({ drafted: 0, queue: 0 });
  }

  try {
    const result = await draftArticle(next.id);
    const remaining = await prisma.article.count({
      where: { status: "drafting", body: null },
    });
    return Response.json({ drafted: 1, article: result.title, queue: remaining });
  } catch (e) {
    return Response.json({ drafted: 0, error: e.message, articleId: next.id }, { status: 500 });
  }
}
