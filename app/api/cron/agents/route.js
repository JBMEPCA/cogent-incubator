import { forEachSite, cronGuard, activeSites } from "@/lib/cron";
import { getSiteContext } from "@/lib/site";
import { ensureAgents, reapStaleRuns } from "@/lib/agents/runtime";
import { runResearcher } from "@/lib/agents/researcher";
import { runLinkedIn } from "@/lib/agents/linkedin";
import { runBacklink } from "@/lib/agents/backlink";
import { runDirector, runEditor, runDesigner, runSeo, runFinance, sweepHeldArticles, imageWorkAvailable } from "@/lib/agents/team";
import { withinOfficeHours } from "@/lib/site";

export const dynamic = "force-dynamic";
// 60 was never a platform limit, it was this line. Fluid compute is enabled on
// the project, which lifts the ceiling well past a minute, and drafting a full
// article does not fit in one: the Editor timed out at exactly 60s even running
// alone. Kept well above the observed 35-60s draft so a slow one still lands.
export const maxDuration = 300;

// Event-driven tick. Only agents with genuine work are woken, because idle
// polling costs far more in tokens than the work itself.
//
// `stage` splits the tick across two HTTP requests. The Director costs 12-27s
// and Editor drafting takes 35-60s+, so a combined tick killed the Editor every
// single time: no article was ever drafted by the schedule in the first two
// days, only by manual wakes, which run one agent alone. Two requests mean two
// full budgets, and the budget itself is now 300s rather than 60:
//
//   ?stage=director  commissioning and rulings only
//   ?stage=worker    the one agent that has something to do
//   (omitted)        both, still used by the Vercel daily backstop
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ skipped: "no ANTHROPIC_API_KEY" });

  const url = new URL(request.url);
  const forced = url.searchParams.get("agent");
  const stage = url.searchParams.get("stage");
  if (stage && stage !== "director" && stage !== "worker") {
    return Response.json({ error: "stage must be director or worker" }, { status: 400 });
  }

  // A manual wake names its title; the scheduled tick runs the whole fleet.
  const onlySlug = url.searchParams.get("site");
  if (forced && !onlySlug) {
    return Response.json({ error: "waking one agent needs ?site=<slug>" }, { status: 400 });
  }

  const contexts = onlySlug
    ? [await getSiteContext(onlySlug)].filter(Boolean)
    : await activeSites();
  if (!contexts.length) return Response.json({ skipped: "no titles with the engine on" });

  // Cloudflare abandons a subrequest at about 100 seconds and calls the sweep
  // failed. maxDuration is 300 and the work does finish — the 09:35 tick on 26
  // August completed every title minutes after the worker had given up and
  // emailed an alarm — but a tick that reports failure whenever the fleet is
  // busy is a tick nobody can act on, and it buries the real faults. So the
  // loop stops STARTING titles at 75s and leaves the rest to the next tick,
  // which is half an hour away and does the same thing.
  //
  // The order rotates by tick, because with a fixed one the titles at the end
  // of the list would be the only ones ever deferred.
  const FLEET_DEADLINE_MS = 75_000;
  const offset = Math.floor(Date.now() / 18e5) % contexts.length;
  const ordered = contexts.slice(offset).concat(contexts.slice(0, offset));

  const started = Date.now();
  const fleet = [];
  const deferred = [];
  for (const ctx of ordered) {
    // The first title always runs: a deadline that can skip everything is an
    // outage with a tidy response body.
    if (fleet.length && Date.now() - started > FLEET_DEADLINE_MS) {
      deferred.push(ctx.site.slug);
      continue;
    }
    fleet.push({ site: ctx.site.slug, ...(await tickOne(ctx, { forced, stage })) });
  }
  return Response.json({
    titles: fleet.length,
    fleet,
    ...(deferred.length
      ? { deferred, deferredReason: "fleet deadline reached; the order rotates each tick, so these move up the queue" }
      : {}),
  });
}

// One title's tick. Everything below is the original logic, now taking the site
// it belongs to rather than assuming there is only one.
async function tickOne(ctx, { forced, stage }) {
  const { site, db } = ctx;
  await ensureAgents(site.id);

  // Office hours. A manual wake from the Engine Room still works out of hours,
  // so you are never locked out of your own team.
  if (!forced && !withinOfficeHours(site)) {
    return { skipped: `outside ${site.officeHoursStart}:00-${site.officeHoursEnd}:00` };
  }

  if (forced) {
    const map = { researcher: runResearcher, editor: runEditor, designer: runDesigner, seo: runSeo, finance: runFinance, director: runDirector, linkedin: runLinkedIn, backlink: runBacklink };
    if (!map[forced]) return { error: "unknown agent" };
    return { forced, result: await map[forced](site, "manual") };
  }

  // Close out anything a previous invocation was killed part way through, so a
  // timed-out run stops reading as a success and its agent stops showing as
  // busy for ever.
  const reaped = await reapStaleRuns(site.id);

  // Put anything QA held back in the queue before the Director looks at the
  // board, so a recovered article can be written on this same tick.
  const held = await sweepHeldArticles(site);

  const ran = [];
  let directorSkipped = null;
  if (stage !== "worker") {
    // The Director used to run on every single tick: 200 runs in seven days,
    // the large majority of them reporting "team on track, nothing to
    // arbitrate". It only ever HAS work in three situations, and all three are
    // one cheap count away, so ask before paying for a turn.
    const [openMessages, jbRequests, inFlightNow, proposedNow] = await Promise.all([
      db.agentMessage.count({ where: { toKey: "director", resolved: false } }),
      db.researchTopic.count({ where: { status: "proposed", source: "jb" } }),
      db.article.count({ where: { status: "drafting" } }),
      db.researchTopic.count({ where: { status: "proposed", source: { not: "jb" } } }),
    ]);
    // The commissioning gate inside runDirector is `inFlight < 2`, so mirror it
    // exactly. Getting these out of step would either wake it for nothing or,
    // worse, never wake it when the queue genuinely runs dry.
    const canCommission = inFlightNow < 2 && proposedNow > 0;

    if (openMessages || jbRequests || canCommission) {
      const director = await runDirector(site, "tick");
      ran.push({ agent: "director", ...director });
    } else {
      directorSkipped = `nothing to do: ${inFlightNow} drafting, ${proposedNow} topics proposed, no open reports`;
    }
  }
  if (stage === "director") {
    return {
      stage,
      reaped,
      held,
      ...(directorSkipped ? { directorSkipped } : {}),
      ran: ran.map((r) => ({ agent: r.agent, ok: r.ok, summary: r.summary })),
      costUsd: Number(ran.reduce((s, r) => s + (r.cost || 0), 0).toFixed(4)),
    };
  }

  // Work out who actually has something to do, in priority order. Finishing
  // started work beats starting new work.
  const [needsImage, drafting, proposed, lastResearch, lastAttempts] =
    await Promise.all([
      // True only when some waiting article still has image attempts left.
      // A bare "no image" count stayed truthy after every candidate was
      // exhausted, and the Designer no-op held the ladder above the Editor
      // and Researcher for a whole afternoon on all three titles.
      imageWorkAvailable(db),
      db.article.count({ where: { status: "drafting" } }),
      db.researchTopic.count({ where: { status: "proposed" } }),
      // findFirst, NOT findUnique. Agent's primary key became (siteId, key) in
      // the multi-tenant split, so `key` alone is not a unique input and Prisma
      // rejects the call outright — which threw inside this Promise.all, took
      // the whole worker stage down with it, and left the Director as the only
      // agent that ever ran. forSite() injects the siteId filter, so findFirst
      // is both correct and scoped.
      db.agent.findFirst({ where: { key: "researcher" }, select: { lastRunAt: true } }),
      // The last ATTEMPT per agent, not the last success. agent.lastRunAt is
      // only written when a run finishes cleanly, so gating on it means a
      // failing agent looks permanently overdue and takes every tick for ever.
      // A failed attempt still counts as a turn taken.
      db.agentRun.groupBy({ by: ["agentKey"], _max: { startedAt: true } }),
    ]);

  const hoursSince = (d) => (d ? (Date.now() - new Date(d).getTime()) / 36e5 : 999);

  // Every agent gated on its OWN clock. The SEO condition used to read the
  // Researcher's timestamp, and since the Researcher runs every 6 to 16 hours
  // the test was effectively never true: the SEO agent had not run once by
  // 4 August while three news pieces went out with no internal links at all.
  //
  // Order is the ordinary cadence, below the agents that finish started work.
  // Internal and brand links are a standing obligation rather than a weekly
  // nicety and an unlinked article earns nothing while it waits, so SEO leads;
  // a mention is worth chasing while an article is still new, so Backlink sits
  // above Finance, which is only ever advisory.
  const attemptOf = (key) =>
    lastAttempts.find((r) => r.agentKey === key)?._max?.startedAt;
  const HOUSEKEEPING = [
    ["seo", runSeo, "link_sweep", 12],
    ["linkedin", runLinkedIn, "daily_queue", 12],
    ["backlink", runBacklink, "daily_sweep", 12],
    ["finance", runFinance, "daily_summary", 24],
  ];
  const overdueBy = (key, every) => hoursSince(attemptOf(key)) / every;
  const due = HOUSEKEEPING.filter(([key, , , every]) => overdueBy(key, every) > 1);

  // A guaranteed turn, because priority inside the chain was not enough. One
  // worker runs per tick and the Director commissions something most hours, so
  // the queue is almost never empty and the Editor took every single tick:
  // Finance went 4.5 days without reporting while the Costs tab quietly served
  // its stale figures, and the LinkedIn Manager 2.8 days. Past double its own
  // interval an agent goes ahead of content for one tick. An article waits an
  // hour; nothing waits days.
  const STARVED_AT = 2;
  const starved = due
    .filter(([key, , , every]) => overdueBy(key, every) > STARVED_AT)
    // Worst relative to its own interval, so a 12h agent two days late still
    // outranks a 24h agent three days late.
    .sort((a, b) => overdueBy(b[0], b[3]) - overdueBy(a[0], a[3]));

  let worker = null;
  if (starved.length) worker = starved[0];
  else if (needsImage) worker = ["designer", runDesigner, "draft_ready"];
  else if (drafting) worker = ["editor", runEditor, "topic_commissioned"];
  // TOPIC SUPPLY MUST MATCH THE TARGET, or the day is capped before it starts.
  //
  // This was a flat < 3 topics and a 6-hour cooldown, which allows two
  // Researcher runs a day and in practice gave one. One run proposes six topics
  // and the Director commissions about four of them, so the ceiling was four
  // articles a day on every title regardless of what its target said. Fleet and
  // Golf are both set to five. On 19 August all three titles ran the Researcher
  // exactly once and Golf published nothing.
  //
  // The floor now follows the title's own target, and the cooldown is three
  // hours rather than six, so a five-a-day title can restock twice in a working
  // day instead of hoping four commissions all survive. The Researcher is on
  // Sonnet at roughly 10p a run, which is cheap against an unfilled slot.
  //
  // Still gated on BOTH: a title with a full topic shelf does not research, so
  // this cannot spin.
  else if (
    proposed < Math.max(3, Math.round(Number(site.articlesPerDayTarget) || 3)) &&
    hoursSince(lastResearch?.lastRunAt) > 3
  )
    worker = ["researcher", runResearcher, "tick"];
  else if (due.length) worker = due[0];

  if (worker) {
    const [key, fn, trigger] = worker;
    ran.push({ agent: key, ...(await fn(site, trigger)) });
  }

  const cost = ran.reduce((s, r) => s + (r.cost || 0), 0);
  return {
    stage: stage || "both",
    reaped,
    held,
    ...(directorSkipped ? { directorSkipped } : {}),
    ran: ran.map((r) => ({ agent: r.agent, ok: r.ok, summary: r.summary })),
    costUsd: Number(cost.toFixed(4)),
  };
}
