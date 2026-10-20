// News clusters: a story trending inside one trade, found in our own wire.
//
// Google's national Trending now list is mass-market. In its first twenty days
// (1-20 Oct 2026) it matched 0 trends to Dental Business News, 1 to Barbering
// Business and 4 to Nursery Daily, against 223 for Smart SME, because nothing a
// dentist searches for reaches the national top 190. The trade has its own
// spikes all the same: a story several outlets pick up within a day is one the
// trade is talking about, whether or not the nation is.
//
// The wire already brings those outlets in. Each title's standing news searches
// (lib/news-searches.js) and company feeds land in FeedItem every scan, so this
// fetches nothing: it groups what arrived in the last day and a half by
// headline, and a group reported by enough distinct outlets is a trend.
//
// Pure functions only. The refresh that stores and matches them lives in
// lib/trending.js beside the Google Trends lane, so both share the classifier.

// Words that say nothing about which story a headline is.
const STOP = new Set(
  (
    "a an the and or of to in on for with at by from as is are was were be been its it this that these new uk " +
    "after over into up out how what why who will would could can says say said amid more than not has have had " +
    "but about all just now first last year years week day today plans set get gets off back"
  ).split(" ")
);

/** "Story headline - Outlet" -> { head, outlet }. Google News puts the outlet last. */
export function splitHeadline(title) {
  const m = String(title || "").match(/^(.*\S)\s+[-–|]\s+([^-–|]{2,60})$/);
  return m ? { head: m[1].trim(), outlet: m[2].trim() } : { head: String(title || "").trim(), outlet: null };
}

/** Significant words of a headline, lowercased. */
export function headlineTokens(head) {
  return new Set(
    String(head || "")
      .toLowerCase()
      .replace(/[’']s\b/g, "")
      .replace(/[^a-z0-9£$%]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

// An outlet name that is really a reference number: the Environment Agency's
// permit notices arrive as "Notice: ... - EPR/HP3526MP/A001", and counting each
// permit as an outlet made one feed look like twenty-five publishers.
const NOT_AN_OUTLET = /[/\\]|\d{3,}/;

/**
 * Who reported an item. A wire search carries many publishers, so the outlet is
 * the one Google names after the headline; a company feed is its own outlet.
 */
export function outletOf(item) {
  const brand = item.brand?.name || "";
  const { outlet } = splitHeadline(item.title);
  if (!brand.startsWith("Wire:")) return brand.toLowerCase() || outlet?.toLowerCase() || null;
  if (outlet && !NOT_AN_OUTLET.test(outlet)) return outlet.toLowerCase();
  // A wire item Google named no outlet for. The search itself is not a
  // publisher, so it counts only if its link names one.
  const host = hostOf(item.link);
  return host && !host.endsWith("google.com") ? host : null;
}

function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Two headlines are the same story when they share at least this many words and
// this share of the shorter one. Measured on 12-19 Oct 2026: chaining on any
// member at 0.5 let "I've played golf for 40 years" absorb 29 unrelated golf
// pieces, so a headline is compared with the story's first headline only.
const MIN_SHARED = 3;
const MIN_OVERLAP = 0.5;

function sameStory(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= MIN_SHARED && shared / Math.min(a.size, b.size) >= MIN_OVERLAP;
}

/** Headline-token similarity, for matching a stored cluster on a later refresh. */
export function sameHeadline(x, y) {
  return sameStory(headlineTokens(x), headlineTokens(y));
}

/**
 * Group feed items into stories. Items are { title, link, publishedAt, brand }.
 * Returns stories with at least `minOutlets` distinct outlets, most-reported
 * first: { head, items, outlets, firstAt, lastAt }.
 */
export function clusterItems(items, { minOutlets = 3 } = {}) {
  const rows = items
    .filter((i) => i.publishedAt)
    .map((i) => ({ ...i, head: splitHeadline(i.title).head, tokens: headlineTokens(splitHeadline(i.title).head), outlet: outletOf(i) }))
    .filter((r) => r.tokens.size >= MIN_SHARED && r.outlet)
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  const stories = [];
  for (const r of rows) {
    const story = stories.find((s) => sameStory(s.seed, r.tokens));
    if (story) story.items.push(r);
    else stories.push({ seed: r.tokens, items: [r] });
  }

  return stories
    .map((s) => {
      const outlets = [...new Set(s.items.map((i) => i.outlet))];
      return {
        head: s.items[0].head,
        items: s.items,
        outlets,
        firstAt: new Date(s.items[0].publishedAt),
        lastAt: new Date(s.items[s.items.length - 1].publishedAt),
      };
    })
    .filter((s) => s.outlets.length >= minOutlets)
    .sort((a, b) => b.outlets.length - a.outlets.length || b.lastAt - a.lastAt);
}
