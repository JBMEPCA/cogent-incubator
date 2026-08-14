import { auth } from "@/lib/auth";
import { ensureAgents } from "@/lib/agents/runtime";
import { runResearcher } from "@/lib/agents/researcher";
import { runLinkedIn } from "@/lib/agents/linkedin";
import { runBacklink } from "@/lib/agents/backlink";
import { runDirector, runEditor, runDesigner, runSeo, runFinance } from "@/lib/agents/team";
import { getSiteContext } from "@/lib/site";

export const dynamic = "force-dynamic";
// Was 60 while the cron route had 300, which meant waking the Editor by hand
// was very often killed mid-draft (a draft takes 35-60s+) and then reaped as a
// failure — the one path you would use to watch an agent work was the one most
// likely to fail. Matched to the tick.
export const maxDuration = 300;

// backlink was missing from this map, so the Backlink Manager could not be woken
// from the office at all. Newsletter is still absent, deliberately: it is not on
// the tick's ladder either and sending a real issue on demand is a different
// class of action from drafting one.
const AGENTS = {
  director: runDirector,
  researcher: runResearcher,
  editor: runEditor,
  designer: runDesigner,
  seo: runSeo,
  finance: runFinance,
  linkedin: runLinkedIn,
  backlink: runBacklink,
};

// Manual wake from the office view, so you can watch an agent work on demand
// rather than waiting for the next tick. Works outside office hours by design:
// you are never locked out of your own team.
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no ANTHROPIC_API_KEY" }, { status: 400 });
  }

  const params = new URL(request.url).searchParams;
  const key = params.get("agent");
  const slug = params.get("site");

  if (!AGENTS[key]) return Response.json({ error: "unknown agent" }, { status: 400 });
  if (!slug) return Response.json({ error: "site query parameter is required" }, { status: 400 });

  const ctx = await getSiteContext(slug);
  if (!ctx) return Response.json({ error: "unknown site" }, { status: 404 });

  await ensureAgents(ctx.site.id);
  const result = await AGENTS[key](ctx.site, "manual");
  return Response.json(result);
}
