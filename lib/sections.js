// Homepage section quotas.
//
// The front page renders a three-card row per category. A category with three
// published articles fills that row exactly once, and then loses it the moment
// the hero or the Latest grid claims one of the three, which is why the site
// could look half-built while holding thirty-odd articles. A section's `target`
// is therefore a buffer, not a shelf count: six published leaves three for the
// section after the rest of the page has taken its share.
//
// The quota steers commissioning. It never authorises writing something that is
// not true, and a section can be marked non-commissionable to put it outside the
// quota entirely.
//
// The six SmartSME categories and the MANUFACTURED map used to be constants
// here. They are per-title data now (Site.sections), because the sections a
// publication runs — and which of them can be written to order — is the most
// title-specific thing in the whole engine.
import { forSite } from "./prisma";
import { categoryCounts } from "./wordpress";

// Was a module constant. The buffer a title needs depends on how its own front
// page is laid out, so it travels with the title.
export const DEFAULT_TARGET = 6;

// A title's sections come from Site.sections as
// [{ name, target, commissionable }]. Two are typically not commissionable:
// News is dated by definition, so writing it to hit a quota means inventing
// events, and a Case Study needs a real, publicly reported company situation.
// Both still count toward the tally so the picture stays honest - they just
// cannot generate a "write three more" instruction.
export function sectionNames(site) {
  return normalise(site).map((s) => s.name);
}

function normalise(site) {
  const list = Array.isArray(site?.sections) ? site.sections : [];
  return list
    .filter((s) => s && s.name)
    .map((s) => ({
      name: String(s.name),
      target: Number.isFinite(s.target) ? s.target : DEFAULT_TARGET,
      commissionable: s.commissionable !== false,
    }));
}

export function canCommission(site, section) {
  const found = normalise(site).find((s) => s.name === section);
  return found ? found.commissionable : false;
}

/**
 * What each homepage section holds and how far it is from TARGET.
 *
 * `published` is the live WordPress count. `pending` is everything already in
 * the pipeline for that section — without it, three research runs in a row all
 * see the same gap and commission for it three times over.
 */
export async function sectionGaps(site, wp) {
  const db = forSite(site.id);
  const sections = normalise(site);
  const [published, pipeline, recent] = await Promise.all([
    categoryCounts(wp),
    db.article.groupBy({
      by: ["category"],
      where: { status: { in: ["idea", "drafting", "review", "approved"] } },
      _count: { _all: true },
    }),
    // The last 30 days of actual output, which is what the SHARE steer below is
    // measured against. `published` above is the all-time WordPress count and
    // cannot see drift: a section can be years ahead on the shelf and have had
    // nothing new written for a month.
    db.article.groupBy({
      by: ["category"],
      where: { status: "published", publishedAt: { gte: new Date(Date.now() - 30 * 864e5) } },
      _count: { _all: true },
    }),
  ]);

  const pending = {};
  for (const row of pipeline) if (row.category) pending[row.category] = row._count._all;
  const recent30 = {};
  for (const row of recent) if (row.category) recent30[row.category] = row._count._all;

  return sections.map(({ name, target, commissionable }) => {
    const live = published[name] ?? 0;
    const inFlight = pending[name] ?? 0;
    return {
      name,
      published: live,
      pending: inFlight,
      recent: recent30[name] ?? 0,
      // Short by what is neither published nor already being written.
      short: Math.max(0, target - live - inFlight),
      commissionable,
    };
  }).sort((a, b) => b.short - a.short);
}

/**
 * The 30-day mix, as a steer for when nothing is short any more.
 *
 * The quota was a FLOOR, and a floor answers one question: is the homepage
 * empty? Once every section passed six it returned null and stopped steering
 * entirely — which is exactly what happened, and the distribution promptly went
 * News 30, Finance 23, Operations 18, AI 14, Marketing 10, Case Studies 4. That
 * is not a full shelf, it is a three-to-one spread nobody chose.
 *
 * So after the floor is met the question becomes: is this publication the shape
 * we said it was? Measured over commissionable sections only, against an even
 * split, because a section that cannot be written to order cannot be asked to
 * catch up.
 */
function shareBriefing(gaps) {
  const commissionable = gaps.filter((g) => g.commissionable);
  if (commissionable.length < 2) return null;

  const total = commissionable.reduce((s, g) => s + g.recent, 0);
  // Under about a fortnight's output the percentages are noise, and telling the
  // Director that a section is "0% of the mix" off three articles would send it
  // chasing a rounding error.
  if (total < 8) return null;

  const evenShare = 100 / commissionable.length;
  const rows = commissionable
    .map((g) => ({ ...g, share: Math.round((g.recent / total) * 100) }))
    .sort((a, b) => a.share - b.share);

  const behind = rows.filter((r) => r.share < evenShare * 0.6);
  if (!behind.length) return null;

  return `SECTION MIX, last 30 days (${total} articles across the sections that can be commissioned)
${rows.map((r) => `- ${r.name}: ${r.recent} published, ${r.share}% of the mix`).join("\n")}

An even spread would be about ${Math.round(evenShare)}% each. These are running
well below it: ${behind.map((r) => `${r.name} (${r.share}%)`).join(", ")}.

Weight your choices toward them WHEN THE MERIT IS CLOSE. This is a tiebreak and
nothing more: a strong topic in an over-represented section still beats a weak
one in a thin section, and you must never invent or stretch a topic to balance a
percentage. If the honest answer is that nothing good is available for a thin
section this week, commission the best topic you have and let the figure sit.`;
}

/**
 * The quota as a prompt block, for the Researcher and the Director.
 *
 * Returns null when nothing commissionable is short, so a healthy site does not
 * carry a paragraph of instruction telling it to do nothing.
 */
export function gapBriefing(gaps, target = DEFAULT_TARGET) {
  const needed = gaps.filter((g) => g.commissionable && g.short > 0);
  // Nothing short is no longer the end of the conversation — see shareBriefing.
  if (!needed.length) return shareBriefing(gaps);

  const table = gaps
    .map((g) => {
      const state = g.short
        ? g.commissionable
          ? `SHORT by ${g.short}`
          : `short by ${g.short}, but do not manufacture these`
        : "full";
      return `- ${g.name}: ${g.published} published${g.pending ? ` + ${g.pending} in progress` : ""}, ${state}`;
    })
    .join("\n");

  return `HOMEPAGE SECTION QUOTAS (target ${target} published per section)
${table}

The front page gives every section a three-card row, and a section below ${target}
loses cards to the hero and the Latest grid, so the site reads as though it has
almost nothing in it. Weight your choices toward the sections marked SHORT:
${needed.map((g) => `${g.name} (${g.short})`).join(", ")}.

This is a steer on WHICH true topics to pick, never a licence to invent one. A
weak article in a short section is worth less than a strong one in a full
section, so do not reach for filler to hit the number. News and Case Studies are
excluded on purpose: News must be genuinely new, and a case study must be a real,
publicly reported company situation. Propose those two only when the wire has
actually supplied the material.`;
}
