// Standing news searches, ingested exactly like a company news hub.
//
// A company press page is a thin source: one firm posts a handful of times a year
// and what it posts is marketing about itself. A news search publishes constantly
// and has already been filtered for newsworthiness by whoever broke the story,
// which makes these the highest-yield free feeds available to us. Twelve of them
// out-produce all 213 working company feeds combined.
//
// Each entry becomes a PrBrand row whose feedUrl is a news-search RSS query, so
// lib/feeds.js ingests it with no special handling at all.
//
// CAVEAT: Google does not publish this as a supported API. It is stable and very
// widely used, but treat it as one leg of the supply and never the only one. If
// these start returning nothing, feedStatus goes to "none" and the company hubs
// carry on regardless.

const ENDPOINT = "https://news.google.com/rss/search";

// Google News is edition-scoped, not global. `gl=GB` does not mean "prefer UK
// sources", it means the GB edition, and the GB edition simply does not carry
// most US trade press. Both titles so far were UK-only so a single hardcoded
// locale was invisibly correct; title #3 is global, and 42% of the world's golf
// courses are in a country the GB edition barely indexes.
//
// So the locale is per-search now, defaulting to GB. Existing sets pass nothing
// and are byte-for-byte unchanged.
export const LOCALES = {
  GB: "hl=en-GB&gl=GB&ceid=GB:en",
  US: "hl=en-US&gl=US&ceid=US:en",
  AU: "hl=en-AU&gl=AU&ceid=AU:en",
  IE: "hl=en-IE&gl=IE&ceid=IE:en",
};
const DEFAULT_LOCALE = "GB";

function localeParams(locale) {
  const p = LOCALES[locale || DEFAULT_LOCALE];
  // An unknown code would otherwise produce `...&undefined` and a feed that
  // returns nothing, which reads exactly like a quiet news week.
  if (!p) throw new Error(`Unknown news locale "${locale}". Known: ${Object.keys(LOCALES).join(", ")}`);
  return p;
}

/** RSS URL for a query. `when:7d` keeps the window tight so the wire stays fresh. */
export function searchFeedUrl(query, locale) {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&${localeParams(locale)}`;
}

/** Human-facing search page for the same query, used as the newsHubUrl. */
export function searchHubUrl(query, locale) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&${localeParams(locale)}`;
}

// Beats chosen to feed the homepage sections that exist, not to be exhaustive.
// `category` is a hint for the Researcher, which still assigns the real section.
export const NEWS_SEARCHES = [
  {
    name: "Wire: UK SME funding rounds",
    category: "Finance",
    query: '("small business" OR SME) UK ("funding round" OR "raises" OR "investment") when:7d',
  },
  {
    name: "Wire: UK appointments and promotions",
    category: "News",
    query: 'UK (appoints OR appointed OR promotes) ("chief executive" OR "managing director" OR "finance director" OR "operations director") when:7d',
  },
  {
    name: "Wire: UK small business acquisitions",
    category: "News",
    query: 'UK ("small business" OR SME) (acquires OR acquisition OR "acquired by" OR merger) when:7d',
  },
  {
    name: "Wire: UK SME product launches",
    category: "News",
    query: 'UK ("small business" OR SME) (launches OR "has launched" OR unveils) when:7d',
  },
  {
    name: "Wire: tax, HMRC and business rates",
    category: "Finance",
    query: 'UK "small business" (HMRC OR tax OR "business rates" OR VAT) when:7d',
  },
  {
    name: "Wire: hiring and employment law",
    category: "Operations",
    query: 'UK "small business" ("employment law" OR hiring OR "national insurance" OR "minimum wage") when:7d',
  },
  {
    name: "Wire: AI and automation adoption",
    category: "AI & Automation",
    query: 'UK "small business" (AI OR automation OR "artificial intelligence") when:7d',
  },
  {
    name: "Wire: insolvency and closures",
    category: "News",
    query: 'UK "small business" (insolvency OR "ceased trading" OR closures OR administration) when:7d',
  },
  {
    name: "Wire: business awards and recognition",
    category: "Case Studies",
    query: 'UK "business awards" ("small business" OR SME) (winner OR shortlist OR finalists) when:7d',
  },
  {
    name: "Wire: expansion and job creation",
    category: "Case Studies",
    query: 'UK ("small business" OR SME) (expansion OR "new jobs" OR "new office" OR relocates) when:7d',
  },
  {
    name: "Wire: ecommerce and retail",
    category: "Marketing",
    query: 'UK "small business" (ecommerce OR "online sales" OR retail OR marketplace) when:7d',
  },
  {
    name: "Wire: energy and operating costs",
    category: "Operations",
    query: 'UK "small business" ("energy costs" OR "cost of doing business" OR "rising costs") when:7d',
  },
];

/**
 * The same idea for the fleet title.
 *
 * NEWS_SEARCHES above is Smart SME's wire and nothing else — the queries all
 * hardcode "small business" OR SME, so seeding a fleet title from them would
 * fill its newswire with the wrong sector entirely. These are chosen against
 * the demand clusters in the title #2 business case, weighted toward the three
 * that dominate search (tax and BiK, EV transition, salary sacrifice) and
 * toward appointments, which is the cheapest brand news that exists and the
 * one every named company reshares.
 *
 * `category` must match a commissionable section on the site, or the
 * Researcher's validation drops the hint.
 */
export const FLEET_NEWS_SEARCHES = [
  {
    name: "Wire: company car tax and BiK",
    category: "Tax & Legislation",
    query: 'UK ("company car tax" OR "benefit in kind" OR BiK OR P11D) (fleet OR "company car") when:7d',
  },
  {
    name: "Wire: salary sacrifice car schemes",
    category: "Tax & Legislation",
    query: 'UK "salary sacrifice" (car OR EV OR "electric vehicle") scheme when:7d',
  },
  {
    name: "Wire: fleet electrification and ZEV mandate",
    category: "Electric & Charging",
    query: 'UK fleet ("ZEV mandate" OR electrification OR "electric fleet" OR "EV transition") when:7d',
  },
  {
    name: "Wire: charging infrastructure for fleets",
    category: "Electric & Charging",
    query: 'UK ("charging network" OR "depot charging" OR "workplace charging") fleet when:7d',
  },
  {
    name: "Wire: vans and LCV",
    category: "Vans & LCV",
    query: 'UK (van OR LCV OR "light commercial vehicle") fleet (launch OR order OR deal OR registrations) when:7d',
  },
  {
    name: "Wire: leasing, contract hire and funding",
    category: "Leasing & Funding",
    query: 'UK (BVRLA OR "contract hire" OR "vehicle leasing" OR "lease fleet") when:7d',
  },
  {
    name: "Wire: telematics and fleet technology",
    category: "Telematics & Technology",
    query: 'UK fleet (telematics OR "vehicle tracking" OR "fleet management software" OR dashcam) when:7d',
  },
  {
    name: "Wire: compliance, O-licence and DVSA",
    category: "Compliance & Safety",
    query: 'UK ("operator licence" OR DVSA OR "earned recognition" OR "traffic commissioner") when:7d',
  },
  {
    name: "Wire: fleet safety and duty of care",
    category: "Compliance & Safety",
    query: 'UK fleet ("driver safety" OR "duty of care" OR "grey fleet" OR "driver training") when:7d',
  },
  {
    name: "Wire: fuel, fuel cards and running costs",
    category: "Costs & Efficiency",
    query: 'UK fleet ("fuel card" OR "fuel prices" OR "running costs" OR "advisory fuel rates") when:7d',
  },
  {
    name: "Wire: remarketing and residual values",
    category: "Costs & Efficiency",
    query: 'UK ("used car values" OR remarketing OR "residual values" OR "ex-fleet") when:7d',
  },
  {
    // The Movers column. Named people at named companies, and both reshare it.
    name: "Wire: fleet industry appointments",
    category: "News",
    query: 'UK fleet (appointed OR appointment OR "joins as" OR "named as") (director OR manager OR "head of") when:7d',
  },
];

/**
 * Golf Resort Magazine — global.
 *
 * Two things make this set different from the two above, and both come straight
 * out of the title #3 brief (docs/vertical-brief-golf-resorts.md).
 *
 * 1. LOCALE. Every entry names one. The other two titles are UK-only; this one
 *    is not, and the US alone holds 42% of the world's golf courses. Beats are
 *    pointed at the edition where that beat's news actually breaks.
 *
 * 2. THE BUYER RULE. Golf is the first vertical where the consumer twin is the
 *    whole category, and it is defended by domains 100x stronger than ours
 *    (Golf Digest 17,994 on Tranco against a trade press at 458k-2.5m). Pulling
 *    the bare query `golf resort` returns roughly half travel and tournament
 *    content: bucket-list trips, luxury destination guides, Cape Cod in autumn.
 *    Seeded with that, the Researcher drifts consumer and we lose to The Sun.
 *
 *    So: NEVER add a bare `golf resort` or `golf course` query here. Every
 *    entry below pins itself to a commercial verb (sold, acquires, breaks
 *    ground, appoints, revenue) or a trade noun (superintendent, tee sheet,
 *    tour operator), and the tournament circuit is excluded by hand. If a query
 *    would return something a golfer on holiday wants to read, it is wrong.
 *
 * `category` must match a section on the site, or the Researcher drops the hint.
 */
// Two exclusion blocks. Sampling the live feed for the "operations and revenue"
// query returned roughly 45% noise before these were added: charity scrambles,
// "14 bucket list courses", a Majorca package holiday.
//
// They help, but DO NOT TRUST THEM. Google News negative operators are
// unreliable on multi-word phrases — the same Majorca package survived a
// -"golf trip" exclusion in testing on 18 Aug 2026. Treat this as a coarse
// first pass that thins the noise, never as a filter that removes it.
//
// The buyer rule in the editorial standard is the actual guard. The Researcher
// is the last thing standing between this wire and a travel blog.
const NO_TOUR = '-"PGA Tour" -"DP World Tour" -leaderboard -"final round" -tournament';
const NO_LEISURE =
  '-"bucket list" -"golf trip" -"golf break" -"golf holiday" -"golf classic" -"golf day" -"charity golf" -"best courses" -"top 10"';
const NO_NOISE = `${NO_TOUR} ${NO_LEISURE}`;

export const GOLF_NEWS_SEARCHES = [
  {
    name: "Wire: course and resort transactions (US)",
    category: "Investment & Ownership",
    locale: "US",
    query: `golf (resort OR course OR club) ("has been sold" OR acquires OR acquisition OR "portfolio of") ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: course and resort transactions (Europe)",
    category: "Investment & Ownership",
    locale: "GB",
    query: `golf (resort OR club) (sold OR acquired OR "takeover" OR "investment") (million OR billion) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: management contracts and operators",
    category: "Investment & Ownership",
    locale: "US",
    query: `golf (Troon OR "Arcis Golf" OR "Invited Clubs" OR "Heritage Golf" OR "management company") (manage OR portfolio OR adds OR partnership OR expands) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: development and construction (Americas)",
    category: "Development & Design",
    locale: "US",
    query: `golf course ("breaks ground" OR "under construction" OR "will open" OR "new 18-hole") (resort OR development) when:7d`,
  },
  {
    name: "Wire: development and construction (EMEA)",
    category: "Development & Design",
    locale: "GB",
    query: `golf course (development OR "planning permission" OR "breaks ground" OR "to open") (resort OR Saudi OR Portugal OR Spain OR Ireland OR Scotland) when:7d`,
  },
  {
    name: "Wire: development and construction (Asia-Pacific)",
    category: "Development & Design",
    locale: "AU",
    query: `golf course (development OR "under construction" OR "to open") (Vietnam OR Thailand OR Japan OR China OR Australia OR resort) when:7d`,
  },
  {
    name: "Wire: architects and course design",
    category: "Development & Design",
    locale: "US",
    query: `golf course (architect OR "course design" OR redesign OR "restoration project") (appointed OR unveils OR completes) when:7d`,
  },
  {
    name: "Wire: resort operations and revenue",
    category: "Operations & Revenue",
    locale: "US",
    query: `golf (resort OR club) ("rounds played" OR "green fees" OR "membership sales" OR "revenue per" OR occupancy) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: course closures and reopenings",
    category: "News",
    locale: "GB",
    query: `golf course (closure OR "to close" OR "has closed" OR reopens OR "reopening") (club OR resort) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: agronomy, turf and course management",
    category: "Course & Grounds",
    locale: "GB",
    query: `golf course (superintendent OR greenkeeper OR "course manager" OR agronomy OR turf) (appointed OR renovation OR project OR trial) when:7d`,
  },
  {
    name: "Wire: water, irrigation and sustainability",
    category: "Sustainability & Water",
    locale: "GB",
    query: `golf course (water OR irrigation OR drought OR "reclaimed water" OR sustainability) (restriction OR regulation OR ban OR investment OR certification) when:7d`,
  },
  {
    name: "Wire: golf travel trade",
    category: "Golf Travel Trade",
    locale: "GB",
    query: `("golf tourism" OR "golf travel" OR "golf holidays" OR IAGTO) ("tour operator" OR destination OR bookings OR "visitor numbers") when:7d`,
  },
  {
    name: "Wire: resort and club technology",
    category: "Technology",
    locale: "US",
    query: `golf (course OR club OR resort) ("tee sheet" OR "management software" OR "booking platform" OR "point of sale" OR launches) (partnership OR deal OR rollout) when:7d`,
  },
  {
    // The Movers column, same logic as fleet: named people at named companies,
    // and both sides reshare it. Cheapest brand news that exists.
    name: "Wire: appointments (global)",
    category: "News",
    locale: "US",
    query: `golf (resort OR club OR "golf group") (appoints OR appointed OR "named as" OR "joins as") ("general manager" OR "director of golf" OR president OR superintendent) when:7d`,
  },
  {
    name: "Wire: hotel and resort investment crossover",
    category: "Investment & Ownership",
    locale: "GB",
    query: `(hotel OR resort) golf (refurbishment OR renovation OR investment OR "spa and golf") (million OR "multi-million") when:7d`,
  },
];
