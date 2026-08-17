/**
 * The daily spend cap, per title.
 *
 * `Site.dailySpendCapUsd` was a column and a settings input that no code read,
 * which meant a title could be "capped" at $5 and spend $50 with nothing to
 * stop it. That was survivable at one title. At a fleet it is not: the
 * Anthropic key is shared across every title, so an unbounded Director on
 * title #3 spends title #1's budget too, and the first sign of trouble is the
 * whole fleet stopping on "credit balance too low" — which is exactly what
 * happened on 17 August 2026.
 *
 * The cap is enforced in runAgent(), the one choke point every agent turn goes
 * through, so no agent can opt out of it and a new agent added later inherits
 * it for free.
 *
 * SCOPE, stated plainly: this counts AgentRun.costUsd, which is every model
 * call made inside an agent turn — drafting, images, QA, SEO and outreach all
 * report into the turn's meter and are folded into that number. Model calls
 * made outside a turn (the picture re-check in publish-due) are neither metered
 * nor capped today. They are a rounding error at one to three articles a day,
 * but the cap is a budget for the agents, not a hard ceiling on the API key.
 */

import { prisma, forSite } from "./prisma";
import { ukDayStart } from "./schedule";

/** What this title has spent on agent runs since midnight, UK time. */
export async function spendToday(siteId, since = ukDayStart()) {
  const db = forSite(siteId);
  const agg = await db.agentRun.aggregate({
    _sum: { costUsd: true },
    where: { startedAt: { gte: since } },
  });
  return agg._sum.costUsd || 0;
}

/**
 * Where this title stands against its cap.
 *
 * The cap is read from the database rather than taken off the `site` object the
 * caller happens to be holding. Agents are handed a site ROW, and a caller that
 * selected a narrower set of columns would otherwise silently disable the cap —
 * a spending control that fails open on a typo is not a control.
 */
export async function spendStatus(siteId) {
  const [row, spent] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { dailySpendCapUsd: true } }),
    spendToday(siteId),
  ]);

  const cap = row?.dailySpendCapUsd;
  // Null, zero and anything non-finite all mean "uncapped", matching the
  // settings field, which stores null when the box is left empty.
  const capped = typeof cap === "number" && Number.isFinite(cap) && cap > 0;

  return {
    cap: capped ? cap : null,
    spent,
    capped,
    over: capped && spent >= cap,
    remaining: capped ? Math.max(0, cap - spent) : null,
  };
}

/** The sentence shown on the agent and in the run result when a turn is skipped. */
export function capReachedNote({ spent, cap }) {
  return (
    `Daily spend cap reached: $${spent.toFixed(2)} of $${cap.toFixed(2)} since midnight UK. ` +
    `Runs resume tomorrow, or raise the cap in Settings.`
  );
}
