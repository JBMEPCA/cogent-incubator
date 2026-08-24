import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { ensureAgents } from "@/lib/agents/runtime";
import { runResearcher } from "@/lib/agents/researcher";
import { runLinkedIn } from "@/lib/agents/linkedin";
import { runBacklink } from "@/lib/agents/backlink";
import { runDirector, runEditor, runDesigner, runSeo, runFinance } from "@/lib/agents/team";
import { runNewsletter } from "@/lib/newsletter";
import { LOGO_PNG } from "@/lib/brand/logo";
import { getSiteContext } from "@/lib/site";

export const dynamic = "force-dynamic";
// Was 60 while the cron route had 300, which meant waking the Editor by hand
// was very often killed mid-draft (a draft takes 35-60s+) and then reaped as a
// failure — the one path you would use to watch an agent work was the one most
// likely to fail. Matched to the tick.
export const maxDuration = 300;

// backlink was missing from this map, so the Backlink Manager could not be woken
// from the office at all.
//
// Newsletter is here now, but ALWAYS as a dry run. The original objection was
// right — sending a real issue on demand is a different class of action from
// drafting one — but the answer to that is not leaving the only weekly job in
// the system unreachable from the office. A dry run picks the ten stories,
// renders them and validates every link without creating anything in Mailchimp,
// which is exactly what you want to check before a Thursday. The real send stays
// where it belongs: the scheduled route, on its own clock.
const AGENTS = {
  director: runDirector,
  researcher: runResearcher,
  editor: runEditor,
  designer: runDesigner,
  seo: runSeo,
  finance: runFinance,
  linkedin: runLinkedIn,
  backlink: runBacklink,
  newsletter: (site, trigger, ctx) =>
    runNewsletter(site, { creds: ctx.creds, dryRun: true, logoBase64: LOGO_PNG.toString("base64") }),
};

// Manual wake from the office view, so you can watch an agent work on demand
// rather than waiting for the next tick. Works outside office hours by design:
// you are never locked out of your own team.
export async function POST(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  // Waking an agent by hand drafts articles, posts to LinkedIn and spends
  // tokens. Read-only accounts can watch the office; they cannot start work in
  // it.
  if (!(await canEdit())) return new Response("Read-only account", { status: 403 });
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
  // The third argument is the full site context, which only the newsletter
  // wrapper needs (it wants this title's Mailchimp credential). The eight agents
  // above take a site row and fetch what they need themselves, so they ignore it.
  const result = await AGENTS[key](ctx.site, "manual", ctx);
  return Response.json(result);
}
