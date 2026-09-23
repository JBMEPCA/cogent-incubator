/**
 * Turning Search Console rows into the article that would win them.
 *
 * Pure functions over plain rows: no database, no Google client, no site
 * record. That is what lets scripts/cluster-check.mjs print a real title's
 * clusters without standing the Researcher up, and what makes the grouping
 * rules something you can argue with by reading them.
 */

// Clicks a position realistically earns, for sizing a miss. Rough on purpose:
// the shape matters (the cliff between 3 and 11), the decimals do not.
export const ctrAt = (p) => (p <= 3 ? 0.11 : p <= 5 ? 0.07 : p <= 10 ? 0.035 : p <= 20 ? 0.012 : 0.004);

// Words too common to identify anything. "best hgv leasing companies uk 2026"
// and "truck leasing companies" belong together on "leasing", not on "best".
const STOP = new Set(
  ("the a an and or for of to in on at with without best top cheap cheapest good better cost costs price prices " +
   "compare compared comparison vs versus guide review reviews uk gb us usa england britain british " +
   "2023 2024 2025 2026 2027 how what which who when where why is are do does can should my your our near me " +
   "new free list companies company services service provider providers")
    .split(/\s+/)
);

/**
 * The words in a title's own name are useless for grouping its queries.
 *
 * Golf Resort Magazine ranks for "horsehay golf club climate adaptation" and
 * "legacy golf properties": two unrelated news stories that the first version
 * of this grouped together on "golf", because on a golf title every query
 * contains golf. The same trap sits waiting on "airport", "barber", "fleet" and
 * "dental". Stripping the title's own nouns is what makes the remaining shared
 * word mean something.
 */
export function siteStopWords(site) {
  return new Set(
    `${site?.name || ""} ${site?.slug || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 2)
  );
}

const words = (q, stop) =>
  String(q)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !stop.has(w));

/**
 * Near-miss queries, grouped into the article that would actually win them.
 *
 * Fleet is the case this exists for. "hgv leasing" at 14.9, "hgv leasing
 * companies" at 9.8, "truck leasing companies" at 10.2, "daf truck leasing" at
 * 14.3, "lorry leasing companies" at 11.3 and four more: 383 impressions and
 * zero clicks between them, and one article answers all nine. Handed to the
 * model as nine separate forty-impression rows, each looked like nobody's week
 * and it picked wire items instead.
 *
 * Greedy by weight rather than by rarity. Each round takes the word carrying
 * the most impressions across the queries still unassigned, claims every query
 * containing it, and repeats. Grouping on the RAREST shared word (the first
 * attempt) split that Fleet cluster three ways, because "daf" is rarer than
 * "leasing" and pulled its two queries into a corner of their own.
 */
export function clusterNearMisses(rows, { site = null } = {}) {
  const stop = siteStopWords(site);
  const left = new Map(rows.map((r, i) => [i, r]));
  const out = [];

  while (left.size) {
    const weight = new Map();
    for (const [i, r] of left) {
      for (const w of new Set(words(r.query, stop))) {
        if (!weight.has(w)) weight.set(w, { impressions: 0, ids: [] });
        const e = weight.get(w);
        e.impressions += r.impressions;
        e.ids.push(i);
      }
    }
    // A word only forms a cluster if it joins queries. Otherwise every leftover
    // row leaves on its own, which is right: it is a standalone article.
    let best = null;
    for (const [w, e] of weight) {
      if (e.ids.length < 2) continue;
      if (!best || e.impressions > best.e.impressions) best = { w, e };
    }
    const [key, ids] = best
      ? [best.w, best.e.ids]
      : [words([...left.values()][0].query, stop)[0] || [...left.values()][0].query, [[...left.keys()][0]]];

    const qs = ids.map((i) => left.get(i)).filter(Boolean);
    for (const i of ids) left.delete(i);
    if (!qs.length) continue;

    const impressions = qs.reduce((a, r) => a + r.impressions, 0);
    const clicks = qs.reduce((a, r) => a + r.clicks, 0);
    // Impression-weighted, the way Search Console itself averages position.
    const position = qs.reduce((a, r) => a + r.position * r.impressions, 0) / (impressions || 1);
    out.push({
      key,
      impressions,
      clicks,
      position,
      // What the group would earn at position 3 that it does not earn now. This
      // is what the lane is ranked on: a 383-impression cluster stuck on page
      // two beats a 40-impression query that is already eighth.
      upside: Math.round(impressions * Math.max(0, 0.11 - ctrAt(position))),
      queries: qs.sort((a, b) => b.impressions - a.impressions),
    });
  }

  return out.sort((a, b) => b.upside - a.upside);
}

/**
 * Drop queries whose demand has already been and gone.
 *
 * Smart SME's single biggest query is "broadstairs restaurant shuts down":
 * 3,220 impressions at position 7, of which 3,131 landed on 4 and 5 September
 * when the restaurant closed. By the 17th it was getting one a day. On the
 * ninety-day totals it dwarfs everything the title has, and commissioning
 * against it would be commissioning against a corpse.
 *
 * `recent` is the same query dimension over a short trailing window, 14 days.
 * Twenty-eight was not enough: the Broadstairs spike was 4 and 5 September and
 * a 28-day window read on the 23rd still contained all of it. A query that
 * earned almost nothing lately is a spent news cycle whatever its quarter looks
 * like. Absent recent data means no filtering, because an empty list is the
 * shape of a failed call as well as of a dead term.
 */
export function dropSpentSpikes(rows, recent, { minShare = 0.04 } = {}) {
  if (!recent?.length) return rows;
  const lately = new Map(recent.map((r) => [r.query, r.impressions]));
  return rows.filter((r) => {
    // Fourteen of ninety days is about 15% of the window, so a live term clears
    // 4% comfortably and a spent one sits near zero.
    const share = (lately.get(r.query) || 0) / (r.impressions || 1);
    return share >= minShare;
  });
}

/** One line per cluster for the prompt, with its queries nested underneath. */
export function describeClusters(clusters) {
  return clusters
    .map((c) => {
      const head =
        c.queries.length > 1
          ? `- CLUSTER "${c.key}", ${c.queries.length} searches one article can answer: ${c.impressions} impressions, ${c.clicks} clicks, average position ${c.position.toFixed(1)}. Worth roughly ${c.upside} clicks a quarter if it reached the top three.`
          : `- SINGLE: ${c.impressions} impressions, ${c.clicks} clicks, position ${c.position.toFixed(1)}. Worth roughly ${c.upside} clicks a quarter in the top three.`;
      const kids = c.queries
        .slice(0, 8)
        .map((r) => `    · "${r.query}" pos ${r.position.toFixed(1)}, ${r.impressions} impr, ${r.clicks} clicks`)
        .join("\n");
      return `${head}\n${kids}`;
    })
    .join("\n");
}
