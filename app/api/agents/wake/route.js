import { auth } from "@/lib/auth";
import { ensureAgents } from "@/lib/agents/runtime";
import { runResearcher } from "@/lib/agents/researcher";
import { runLinkedIn } from "@/lib/agents/linkedin";
import { runDirector, runEditor, runDesigner, runSeo, runFinance } from "@/lib/agents/team";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AGENTS = {
  director: runDirector,
  researcher: runResearcher,
  editor: runEditor,
  designer: runDesigner,
  seo: runSeo,
  finance: runFinance,
  linkedin: runLinkedIn,
};

// Manual wake from the office view, so you can watch an agent work on demand
// rather than waiting for the next tick.
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no ANTHROPIC_API_KEY" }, { status: 400 });

  const key = new URL(request.url).searchParams.get("agent");
  if (!AGENTS[key]) return Response.json({ error: "unknown agent" }, { status: 400 });

  await ensureAgents();
  const result = await AGENTS[key]("manual");
  return Response.json(result);
}
