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
      // A missed slot has to make the article available again, not strand it.
      // An article usually misses its slot waiting for a picture, and once the
      // time passes it fell outside both branches below: publish-due would not
      // run it, and this query could not re-slot it. Ten of the fourteen
      // finished articles on the fleet were stuck that way on 30 August, the
      // oldest since the 22nd, every one of them written, checked and paid for.
      //
      // Anything older than the lock window is fair game again. Inside the
      // window it is left alone, because it may be publishing right now.
      OR: [
        { scheduledFor: null },
        { scheduledFor: { gt: lockUntil } },
        // A missed slot only goes back in the pot if the article STILL cannot
        // publish. One that has since got its picture is due right now, and
        // publish-due will take it on the very next tick.
        //
        // Re-slotting it instead was costing whole days. On 11 September Golf,
        // Barbering and Airport each missed the 10:30 round by minutes waiting
        // on an image, got that image by 14:36, and were promptly booked for
        // SATURDAY - so three of five titles published nothing at all while
        // holding six finished articles apiece. The piece was ready at 11:00
        // and the next tick was at 11:05.
        //
        // Late is better than tomorrow. A trade reader does not know what time
        // the slot was.
        { scheduledFor: { lt: new Date(Date.now() - LOCK_MINUTES * 60000) }, imageUrl: null },
      ],
    },
    select: { id: true, type: true, seoScore: true, scheduledFor: true, createdAt: true, imageUrl: true },
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

  // AN ARTICLE WITH NO PICTURE CANNOT PUBLISH, so it must not take a slot ahead
  // of one that can. publish-due defers it on the bare-post guard, which means
  // the slot goes to nobody at all.
  //
  // Ranked purely on score it did not merely take a slot, it took the EARLIEST
  // one, and the ageing term above is why: an article waiting on a picture is
  // by definition the one that has waited longest, so it collects the full
  // twenty-point bonus and wins the front of the queue on every rebalance. Then
  // it defers, publishes nothing, and wins the next slot half an hour later
  // while every ready article behind it is pushed back one place. At three
  // slots a day against a rebalance every thirty minutes the queue never
  // advances at all.
  //
  // That is what closed two titles down. Between 8 and 11 September 2026 Golf
  // and Airport published NOTHING - six finished, checked, imaged articles
  // banked on each - and Barbering thinned to one a day, while Smart SME and
  // The Fleet, the only two titles with no imageless article, ran normally
  // throughout. One stuck picture per title was the whole difference.
  //
  // They keep a slot rather than losing one, just the LAST slot going. The
  // picture desk in lib/agents/team.js orders its queue by scheduledFor so it
  // can tell an article due tomorrow from one due on Friday, and clearing the
  // times would flatten that back to newest-first.
  const ready = {};
  const pending = {};
  for (const a of waiting) ((a.imageUrl ? ready : pending)[a.type] ||= []).push(a);
  for (const group of [ready, pending]) {
    for (const type of Object.keys(group)) group[type].sort(byScore);
  }

  // The slot's type is a preference, not a lock. On 5 August two news slots
  // stood empty while nine finished SEO guides waited for somewhere to go, and
  // the day published one article against a floor of four. An empty slot earns
  // nothing and teaches the crawler nothing, so when the preferred type has
  // nothing ready the slot takes the best-scoring article that is.
  //
  // Preference still shapes the week: the right type always wins its own slot,
  // and a substitution only happens where the alternative is publishing nothing.
  // `substituted` is reported so the mix drifting is visible rather than silent.
  const takeFrom = (pool, type) => {
    if (pool[type]?.length) return { article: pool[type].shift(), swapped: false };
    const best = Object.keys(pool)
      .filter((t) => pool[t].length)
      .map((t) => ({ t, a: pool[t][0] }))
      .sort((x, y) => byScore(x.a, y.a))[0];
    if (!best) return null;
    return { article: pool[best.t].shift(), swapped: true };
  };

  // Everything publishable first, whatever its type, before anything waiting on
  // a picture is offered a slot at all. Type preference still decides the order
  // WITHIN each of those two groups, so the weekly mix is unchanged on any day
  // the pictures are in place - which is every day this has worked properly.
  const takeBest = (type) => takeFrom(ready, type) || takeFrom(pending, type);

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
  // Both groups, or the release stops covering half the queue. An article
  // waiting on a picture is the likeliest thing to be left over now that it is
  // offered a slot last, and it is also the likeliest to be holding an old one.
  let released = 0;
  for (const group of [ready, pending]) {
    for (const type of Object.keys(group)) {
      for (const a of group[type]) {
        if (!a.scheduledFor) continue;
        await db.article.update({ where: { id: a.id }, data: { scheduledFor: null } });
        released++;
      }
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
