import { auth } from "@/lib/auth";
import { officeState } from "@/lib/agents/runtime";
import { getSiteContext } from "@/lib/site";

export const dynamic = "force-dynamic";

// Live state for the office view, for ONE title.
//
// The header's status light polls this on every page inside a title, so it
// takes ?site=<slug>. Without one there is no sensible answer any more: the
// old version returned "the" agents, and there is no longer a the.
export async function GET(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const slug = new URL(request.url).searchParams.get("site");
  if (!slug) return Response.json({ error: "site query parameter is required" }, { status: 400 });

  const ctx = await getSiteContext(slug);
  if (!ctx) return Response.json({ error: "unknown site" }, { status: 404 });
  const { site, db } = ctx;

  const [state, topics, pipeline] = await Promise.all([
    officeState(site.id),
    db.researchTopic.findMany({
      where: { status: "proposed" },
      orderBy: [{ score: "desc" }],
      take: 8,
      select: { id: true, title: true, source: true, score: true, impressions: true, position: true, rationale: true },
    }),
    db.article.groupBy({ by: ["status"], _count: true }),
  ]);

  return Response.json({
    ...state,
    site: { slug: site.slug, name: site.name },
    topics,
    pipeline: Object.fromEntries(pipeline.map((p) => [p.status, p._count])),
  });
}
