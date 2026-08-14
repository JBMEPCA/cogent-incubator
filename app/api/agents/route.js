import { auth } from "@/lib/auth";
import { officeState } from "@/lib/agents/runtime";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Live state for the office view. Login-gated: this is the private launch app.
export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const [state, topics, pipeline] = await Promise.all([
    officeState(),
    prisma.researchTopic.findMany({
      where: { status: "proposed" },
      orderBy: [{ score: "desc" }],
      take: 8,
      select: { id: true, title: true, source: true, score: true, impressions: true, position: true, rationale: true },
    }),
    prisma.article.groupBy({ by: ["status"], _count: true }),
  ]);

  return Response.json({
    ...state,
    topics,
    pipeline: Object.fromEntries(pipeline.map((p) => [p.status, p._count])),
  });
}
