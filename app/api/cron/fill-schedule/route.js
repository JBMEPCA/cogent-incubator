import { forEachSite, cronGuard } from "@/lib/cron";
import { upcomingSlots } from "@/lib/schedule";
import { isDraftingConfigured } from "@/lib/drafting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keeps the publishing calendar full: assigns finished articles to open slots,
// then queues new commissions (news picks, SEO topics, case studies) for the
// drafting agent to write into the gaps.
export async function GET(request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  if (!isDraftingConfigured()) return Response.json({ skipped: "no ANTHROPIC_API_KEY" });

  // Every title keeps its own calendar, so this runs once per title against
  // that title's scoped handle. It read a module-level `db` that has not
  // existed since the multi-tenant split, so the route was a 500 on every call
  // and the schedule silently never filled — an article could pass QA, get its
  // image, and then simply never be given a time to go out.
  return Response.json(
    await forEachSite(async ({ site, db }) => {
      const slots = upcomingSlots(site, 7);

  // THE SCHEDULE IS REBALANCED ON EVERY RUN, best score to earliest slot.
  //
  // It used to consider only articles with scheduledFor null, so a slot was
  // claimed first come first served and then held for ever. The ordering by
  // seoScore ranked whatever happened to be ready at that one instant, which is
  // not score priority at all, it is first come first served with a tiebreak.
  // That is how a piece scoring 62 came to publish at 09:30 on 4 August ahead
  // of an 82 at 12:30 the same day: the 62 was the best thing ready when slots
  // were handed out, and the 82 was drafted afterwards and could only take what
  // was left. Now everything still waiting goes back in the pot each run.
  //
  // Deliberately no quality floor here: a low scoring article still publishes,
  // it just cannot get ahead of a better one. Ordering is the instruction, and
  // a floor would quietly stop things going out at all.

  // Anything close enough to publishing is left exactly where it is. publish-due
  // works from scheduledFor <= now, and moving a piece out from under a run in
  // progress risks a double publish or a silent skip.
  const LOCK_MINUTES = 30;
  const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);

  const waiting = await db.article.findMany({
    where: {
      status: { in: ["review", "approved"] },
      qaPassed: true,
      body: { not: null },
      OR: [{ scheduledFor: null }, { scheduledFor: { gt: lockUntil } }],
    },
    select: { id: true, type: true, seoScore: true, scheduledFor: true, createdAt: true },
  });

  // Locked articles keep their slots, so those slots are not up for grabs.
  const held = new Set(
    (
      await db.article.findMany({
        where: { status: { not: "published" }, scheduledFor: { not: null, lte: lockUntil } },
        select: { scheduledFor: true },
      })
    ).map((a) => a.scheduledFor.toISOString())
  );
  const open = slots.filter((s) => !held.has(s.at.toISOString()));

  // Best score first, oldest first to break ties so the order is stable between
  // runs. An unscored article sorts LAST: Postgres puts NULLs first on a DESC
  // sort, so the old query handed the earliest slot going to an article with no
  // score at all, and nine of the fifty-eight articles have none.
  //
  // WITH AN AGEING TERM, because pure best-first has no floor. The pool is
  // rebalanced on every run, so a mid-scoring piece is re-beaten by whatever was
  // drafted this morning, every hour, indefinitely: an article written on
  // 5 August was still queued on the 14th, having been pushed back by nine days
  // of higher scorers. That was survivable at seven slots a day and is not at
  // one to three, where the same backlog is a fortnight and a piece written to a
  // news peg goes stale before its slot arrives.
  //
  // Three points a day, capped at twenty, so a week of waiting is worth roughly
  // the gap between a good article and an excellent one — enough to get its turn,
  // never enough to put a weak piece at the front of the queue.
  const AGE_POINTS_PER_DAY = 3;
  const MAX_AGE_POINTS = 20;
  const effectiveScore = (a) => {
    const days = (Date.now() - new Date(a.createdAt).getTime()) / 864e5;
    return (a.seoScore ?? -1) + Math.min(MAX_AGE_POINTS, days * AGE_POINTS_PER_DAY);
  };
  const byScore = (a, b) =>
    effectiveScore(b) - effectiveScore(a) || new Date(a.createdAt) - new Date(b.createdAt);

  const pool = {};
  for (const a of waiting) (pool[a.type] ||= []).push(a);
  for (const type of Object.keys(pool)) pool[type].sort(byScore);

  // The slot's type is a preference, not a lock. On 5 August two news slots
  // stood empty while nine finished SEO guides waited for somewhere to go, and
  // the day published one article against a floor of four. An empty slot earns
  // nothing and teaches the crawler nothing, so when the preferred type has
  // nothing ready the slot takes the best-scoring article that is.
  //
  // Preference still shapes the week: the right type always wins its own slot,
  // and a substitution only happens where the alternative is publishing nothing.
  // `substituted` is reported so the mix drifting is visible rather than silent.
  const takeBest = (type) => {
    if (pool[type]?.length) return { article: pool[type].shift(), swapped: false };
    const best = Object.keys(pool)
      .filter((t) => pool[t].length)
      .map((t) => ({ t, a: pool[t][0] }))
      .sort((x, y) => byScore(x.a, y.a))[0];
    if (!best) return null;
    return { article: pool[best.t].shift(), swapped: true };
  };

  let assigned = 0;
  let moved = 0;
  let substituted = 0;
  for (const slot of open) {
    const pick = takeBest(slot.type);
    if (!pick) continue;
    const { article: next, swapped } = pick;
    if (swapped) substituted++;
    if (next.scheduledFor && new Date(next.scheduledFor).getTime() === slot.at.getTime()) continue;
    await db.article.update({ where: { id: next.id }, data: { scheduledFor: slot.at } });
    if (next.scheduledFor) moved++;
    else assigned++;
  }

  // Whatever is left did not make the week. Its old slot has to be released:
  // that time may have just been given to a better article, and two articles
  // holding the same instant is how you get a double publish.
  let released = 0;
  for (const type of Object.keys(pool)) {
    for (const a of pool[type]) {
      if (!a.scheduledFor) continue;
      await db.article.update({ where: { id: a.id }, data: { scheduledFor: null } });
      released++;
    }
  }

  // Commissioning used to happen here. It now belongs to the Director agent,
  // which weighs the Researcher's scored topics and caps work in flight. Running
  // both meant the same queue was commissioned and drafted twice.
  const inFlight = await db.article.count({ where: { status: 'drafting' } });

      return {
        openSlots: open.length,
        assigned,
        moved,
        released,
        substituted,
        inFlight,
        commissioning: "director agent",
      };
    })
  );
}
