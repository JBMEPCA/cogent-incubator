import { prisma, fleetRead } from "./prisma";

// Where an article came from, for the source chip on Rising Articles rows.
//
// A Rising row is a Search Console page: an address and nothing else. The
// article behind it is found in our own database by its slug, which WordPress
// cut from the headline at publish time (or from the search term, for pieces
// commissioned from a trend since 6 Oct 2026). Matched on shared words rather
// than exact text, because WordPress turns an apostrophe into a hyphen
// ("sainsbury-s") and the SEO agent can retitle a post after its slug is set.
// No WordPress call: listing every post on ten sites to read their addresses
// trips the host's bot protection (see fetchPostsPage in lib/wordpress.js).

export const SOURCES = {
  trending: { label: "From Trending", chip: "chip-content" },
  interview: { label: "Interview", chip: "chip-audience" },
  pr: { label: "Emailed PR", chip: "chip-brand" },
  smallfirm: { label: "Small firm story", chip: "chip-audience" },
  evergreen: { label: "Evergreen", chip: "chip-monetise" },
  wire: { label: "News wire", chip: "chip-general" },
};

// Words of a slug or headline, lower case, without one-letter fragments (the
// "s" WordPress leaves from an apostrophe) or URL-encoded junk.
const words = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/%[0-9a-f]{2}/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);

function sourceOf(a, trendIds) {
  if (trendIds.has(a.id)) return "trending";
  if (a.interviewTargets?.length) return "interview";
  if (String(a.sourceItem?.link || "").startsWith("gmail:")) return "pr";
  if (a.type === "case_study") return "smallfirm";
  if (a.type === "seo_original") return "evergreen";
  return "wire";
}

/**
 * Source per row url, for the rows being shown. Rows with no confident match
 * (a post made by hand in WordPress, say) get none, so no chip rather than a
 * wrong one.
 */
export async function sourcesForRows(rows) {
  const out = {};
  if (!rows?.length) return out;
  const siteIds = [...new Set(rows.map((r) => r.siteId))];
  const [articles, trends] = await Promise.all([
    fleetRead().article.findMany({
      where: { siteId: { in: siteIds }, status: "published" },
      select: {
        id: true, siteId: true, title: true, type: true,
        sourceItem: { select: { link: true } },
        interviewTargets: { select: { id: true }, take: 1 },
      },
    }),
    prisma.trendingTopic.findMany({ where: { status: "commissioned", articleId: { not: null } }, select: { articleId: true, term: true } }),
  ]);
  const trendIds = new Set(trends.map((t) => t.articleId));
  const termOf = new Map(trends.map((t) => [t.articleId, t.term]));

  const bySite = new Map();
  for (const a of articles) {
    const keys = [words(a.title)];
    if (termOf.has(a.id)) keys.push(words(termOf.get(a.id)));
    const entry = { a, keys: keys.map((k) => new Set(k)) };
    if (!bySite.has(a.siteId)) bySite.set(a.siteId, []);
    bySite.get(a.siteId).push(entry);
  }

  for (const r of rows) {
    const slug = words(String(r.path || "").replace(/\/+$/, "").split("/").pop());
    if (slug.length < 2) continue;
    // Coverage (share of the slug found in the headline) decides a match; on
    // a tie the closer overall fit wins, so a trending piece whose slug IS its
    // search term beats a longer guide headline that merely contains it
    // ("gen-z-workplace-pension-opt-out" against "Gen Z workplace pension
    // opt-out climbs: what to do", 28 Oct 2026).
    let best = null;
    let bestScore = 0;
    let bestFit = 0;
    for (const { a, keys } of bySite.get(r.siteId) || []) {
      for (const k of keys) {
        let hit = 0;
        for (const w of slug) if (k.has(w)) hit++;
        const score = hit / slug.length;
        const fit = hit / Math.max(slug.length, k.size);
        if (score > bestScore || (score === bestScore && fit > bestFit)) {
          bestScore = score;
          bestFit = fit;
          best = a;
        }
      }
    }
    // Most of the slug's words in one headline (or search term) on the same
    // title. Below that it is a guess, and a wrong chip is worse than none.
    if (best && bestScore >= 0.75) out[r.url] = SOURCES[sourceOf(best, trendIds)];
  }
  return out;
}
