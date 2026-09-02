// The fleet's memory of which search terms it is trying to own.
//
// Nothing recorded what the engine had TARGETED, only what it had published.
// ResearchTopic.query held the term that justified each article and no code
// ever read it back, so a weekly sweep re-proposed the same queries for ever,
// and Smart SME commissioned against two terms The Fleet Magazine was already
// chasing. Two titles in the same results page is a self-inflicted wound: the
// fleet was bidding against itself for free.
//
// Bing's role here is deliberately narrow. It measures demand, it does not
// choose. Live testing across all five titles showed why: seeded with beat
// language it returns consumer search ("airport parking" at 74,923 for the
// airport title, "resorts near me" for golf), and seeded with real trade
// language it returns nothing at all ("airport ground handling", three
// impressions). Discovery therefore stays with Search Console near-misses and
// autocomplete, which are pre-filtered to people who already found a trade
// title, and Bing answers only the two questions it can actually answer: is
// there any measurable demand for this, and which way is it moving.

import { forSite, fleetRead } from "./prisma";
import { keywordHistory, trendRatio, localeFor, isBingConfigured } from "./keywords";

/**
 * Lowercased, whitespace-collapsed, stripped of surrounding punctuation.
 *
 * Matching on the raw string would let "Fleet Management " and "fleet
 * management" both be claimed, which is precisely the duplication the registry
 * exists to prevent. Interior punctuation is kept: "director's" and "directors"
 * are different queries and Google treats them as such.
 */
export function normaliseTerm(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

/** The market a term should be measured and claimed in for this title. */
export function marketFor(site) {
  return (site?.markets?.[0] || "GB").toUpperCase();
}

/**
 * Other titles already chasing this term in the same market.
 *
 * Same market is the test, not same term. Golf Resort and Airport Business both
 * run ["US","GB"], and a term owned by one title in GB is not a conflict with
 * another owning it in the US: different results page, different competition.
 *
 * Reads across every site, so it goes through fleetRead() rather than the
 * tenanted client, which would silently scope the query to one title and report
 * every term as free.
 */
export async function claimants(term, { market, excludeSiteId } = {}) {
  const normalised = normaliseTerm(term);
  if (!normalised) return [];

  const rows = await fleetRead().keywordTarget.findMany({
    where: {
      term: normalised,
      market,
      status: { in: ["claimed", "published", "won"] },
      ...(excludeSiteId ? { siteId: { not: excludeSiteId } } : {}),
    },
    select: { siteId: true, status: true, articleId: true, site: { select: { name: true } } },
  });

  return rows.map((r) => ({
    siteId: r.siteId,
    siteName: r.site?.name || r.siteId,
    status: r.status,
    articleId: r.articleId,
  }));
}

/**
 * Current Bing demand for one term: latest weekly impressions and direction.
 *
 * One HTTP call per term, which is why this is only ever run over a shortlist.
 * GetKeywordStats carries both figures, so validating a candidate does not cost
 * two round trips.
 *
 * A term with no Bing data returns zeros with a null trend, and that is a real
 * answer rather than an error: most genuine trade language has no measurable
 * Bing volume, and treating that as a failed lookup would retry it for ever.
 */
export async function demandFor(term, market = "GB") {
  if (!isBingConfigured()) return null;
  const locale = localeFor(market);
  try {
    const series = await keywordHistory(term, locale);
    const latest = series.at(-1);
    return {
      impressions: latest?.impressions ?? 0,
      broad: latest?.broadImpressions ?? 0,
      trend: trendRatio(series),
      weeks: series.length,
    };
  } catch {
    // A rate limit or a Bing outage must not take a Researcher run down. No
    // demand reading is worse than a fresh one and better than a failed sweep.
    return null;
  }
}

/**
 * Put discovered terms into the registry as candidates, without claiming them.
 *
 * Upsert rather than create: the same query surfaces in Search Console week
 * after week, and a second sighting should refresh its position rather than
 * collide with the unique index. Terms already claimed keep their status, so a
 * re-sighting can never quietly un-claim an article's target.
 */
export async function recordCandidates(site, rows = []) {
  const db = forSite(site.id);
  const market = marketFor(site);
  let recorded = 0;

  for (const row of rows) {
    const term = normaliseTerm(row?.term);
    if (!term) continue;

    await db.keywordTarget.upsert({
      where: { siteId_term: { siteId: site.id, term } },
      create: {
        term,
        market,
        source: row.source || "gap",
        gscImpressions: row.gscImpressions ?? null,
        gscPosition: row.gscPosition ?? null,
      },
      update: {
        // Status is deliberately absent: an upsert must never reset a claim.
        gscImpressions: row.gscImpressions ?? undefined,
        gscPosition: row.gscPosition ?? undefined,
      },
    });
    recorded++;
  }
  return recorded;
}

/**
 * Attach Bing demand to the candidates that most need it.
 *
 * Oldest-checked first, capped, because the keyword endpoints have no published
 * rate limit and the way to discover one is to hit it. Terms measured within
 * the last week are skipped: the underlying series is weekly, so re-reading it
 * daily buys nothing but calls.
 */
export async function validateCandidates(site, { limit = 20, staleDays = 7 } = {}) {
  if (!isBingConfigured()) return { checked: 0, skipped: "bing not configured" };
  const db = forSite(site.id);
  const market = marketFor(site);
  const stale = new Date(Date.now() - staleDays * 864e5);

  const due = await db.keywordTarget.findMany({
    where: {
      status: "candidate",
      OR: [{ bingCheckedAt: null }, { bingCheckedAt: { lt: stale } }],
    },
    orderBy: [{ bingCheckedAt: { sort: "asc", nulls: "first" } }, { gscImpressions: "desc" }],
    take: limit,
  });

  let checked = 0;
  for (const row of due) {
    const demand = await demandFor(row.term, market);
    if (!demand) break; // Bing is unhappy; stop rather than grind through the rest.
    await db.keywordTarget.update({
      where: { id: row.id },
      data: {
        bingImpressions: demand.impressions,
        bingBroad: demand.broad,
        bingTrend: demand.trend,
        bingCheckedAt: new Date(),
      },
    });
    checked++;
  }
  return { checked, considered: due.length };
}

/**
 * Claim a term for a commissioned topic, refusing if another title holds it.
 *
 * Returns { ok, reason }. The caller decides what to do with a refusal: the
 * Researcher drops the pick and moves on rather than raising, because losing
 * one candidate to a sibling title is normal operation, not an error.
 */
export async function claimTerm(site, term, { topicId, articleId, source } = {}) {
  const normalised = normaliseTerm(term);
  if (!normalised) return { ok: false, reason: "empty term" };

  const market = marketFor(site);
  const held = await claimants(normalised, { market, excludeSiteId: site.id });
  if (held.length) {
    return {
      ok: false,
      reason: `already targeted by ${held.map((h) => h.siteName).join(", ")}`,
      claimants: held,
    };
  }

  const db = forSite(site.id);
  await db.keywordTarget.upsert({
    where: { siteId_term: { siteId: site.id, term: normalised } },
    create: {
      term: normalised,
      market,
      source: source || "gap",
      status: "claimed",
      topicId: topicId ?? null,
      articleId: articleId ?? null,
      claimedAt: new Date(),
    },
    update: {
      status: "claimed",
      topicId: topicId ?? undefined,
      articleId: articleId ?? undefined,
      claimedAt: new Date(),
    },
  });
  return { ok: true, term: normalised };
}

/**
 * Terms this title should stop proposing: its own claims, plus everything a
 * sibling title has taken in the same market.
 *
 * Handed to the Researcher's prompt so the model never proposes them in the
 * first place. Filtering after the fact would work, but it wastes the pick: the
 * model returns six topics and silently dropping two leaves four.
 */
export async function spokenFor(site) {
  const market = marketFor(site);
  const rows = await fleetRead().keywordTarget.findMany({
    where: { market, status: { in: ["claimed", "published", "won"] } },
    select: { term: true, siteId: true, site: { select: { name: true } } },
    take: 500,
  });

  return rows.map((r) => ({
    term: r.term,
    mine: r.siteId === site.id,
    siteName: r.site?.name || "",
  }));
}

/**
 * Bind a claimed term to the article that was actually commissioned for it.
 *
 * Without this the registry knows a term was spoken for but not what came of
 * it, and "which article is chasing this keyword" has no answer. The only other
 * link was the raw query text copied onto Article.keywords, which is neither
 * normalised nor indexed and cannot be joined on safely.
 *
 * Returns false rather than raising when the term was never registered: a topic
 * can be commissioned from a source that never went through the registry, and
 * that is not a failure worth stopping a Director run for.
 */
export async function linkArticle(site, term, articleId) {
  const normalised = normaliseTerm(term);
  if (!normalised || !articleId) return false;

  const db = forSite(site.id);
  const existing = await db.keywordTarget.findFirst({ where: { term: normalised } });
  if (!existing) return false;

  await db.keywordTarget.update({
    where: { id: existing.id },
    data: {
      articleId,
      // A term reaching this point is being written about, so a row still
      // sitting at "candidate" is promoted. Anything further along its life
      // (published, won) keeps the status it earned.
      status: existing.status === "candidate" ? "claimed" : existing.status,
      claimedAt: existing.claimedAt ?? new Date(),
    },
  });
  return true;
}
