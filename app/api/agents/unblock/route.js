import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { setState } from "@/lib/agents/runtime";
import { AGENTS } from "@/lib/agents/registry";
import { getSiteContext } from "@/lib/site";

export const dynamic = "force-dynamic";

// Put a blocked agent back on duty by hand, from Needs you on the engine hub.
//
// It does not re-run anything: the agent picks up its next job on its own
// schedule, exactly as it would after the automatic recovery in
// recoverBlocked(). This is for the case that recovery deliberately leaves
// alone, an agent that has failed several runs in a row, once someone has
// looked at why.
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!(await canEdit())) return new Response("Read-only account", { status: 403 });

  const params = new URL(request.url).searchParams;
  const key = params.get("agent");
  const slug = params.get("site");
  if (!AGENTS[key]) return Response.json({ error: "unknown agent" }, { status: 400 });
  if (!slug) return Response.json({ error: "site query parameter is required" }, { status: 400 });

  const ctx = await getSiteContext(slug);
  if (!ctx) return Response.json({ error: "unknown site" }, { status: 404 });

  const who = session.user?.name || session.user?.email || "hand";
  await setState(ctx.site.id, key, "idle", null, `Unblocked by ${who}`);
  return Response.json({ ok: true });
}
