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

/**
 * Barbering Business — UK.
 *
 * The worst consumer twin of any title (docs/vertical-brief-barbering.md §4):
 * single style terms pull six-figure monthly volumes ("low taper fade" 550k,
 * "modern mullet" 450k) and "barber near me" outruns branded search in most UK
 * cities. Golf's rule carries over word for word: NEVER a bare `barber` or
 * `haircut` query, and never a style term at all. Every entry pins itself to a
 * commercial verb (opens, acquires, appoints, launches) or a trade noun
 * (barbershop, NHBF, apprenticeship). If a query would return something a man
 * wanting a haircut would read, it is wrong.
 *
 * Deliberate absence: no wire query feeds "Trends & Services". Trend content is
 * tier-1 evergreen written owner-first from the content plan, per the
 * owner-frame rule in docs/editorial-standard.md — a trend wire query cannot be
 * phrased that stays on the business side of the line.
 *
 * `category` must match a section on the site. The section list is defined by
 * the content plan (scripts/batch-plan-barbering-business.json) and these must
 * stay in lockstep.
 */
// Exclusions thin the consumer noise; they do not remove it (Google negative
// operators leak — see the golf block above). The owner-frame rule is the
// actual guard, and the Researcher enforces it.
const NO_HAIRCUT =
  '-"near me" -hairstyle -hairstyles -"haircut ideas" -"best haircuts" -"taper fade" -mullet -"how to cut"';

export const BARBERING_NEWS_SEARCHES = [
  {
    name: "Wire: barbershop openings and expansion",
    category: "News",
    query: `UK (barbershop OR "barber shop" OR barbers) (opens OR opening OR expands OR "new site" OR "second site") ${NO_HAIRCUT} when:7d`,
  },
  {
    // The crime-coverage rule in the editorial standard applies to every item
    // this returns: policy and enforcement statistics, never a named shop or an
    // owner's nationality outside a concluded prosecution.
    name: "Wire: enforcement and sector policy",
    category: "News",
    query: `UK (barbershop OR "barber shops" OR "hair and beauty") (NCA OR "money laundering" OR "Operation Machinize" OR crackdown OR enforcement) when:7d`,
  },
  {
    name: "Wire: VAT, tax and employment status",
    category: "Business & Money",
    query: `UK ("hair and beauty" OR hairdressing OR barbershop) (VAT OR HMRC OR "business rates" OR "national insurance" OR "minimum wage" OR "employment status" OR "rent a chair") when:7d`,
  },
  {
    name: "Wire: NHBF and sector bodies",
    category: "Business & Money",
    query: `(NHBF OR "National Hair and Beauty Federation" OR "British Beauty Council" OR "Hair and Barber Council") when:7d`,
  },
  {
    name: "Wire: chains, investment and acquisitions",
    category: "Business & Money",
    query: `UK (barbershop OR "grooming brand" OR "barber chain" OR "men's grooming") (acquires OR acquisition OR investment OR funding OR "private equity" OR expansion) when:7d`,
  },
  {
    name: "Wire: high street openings and closures data",
    category: "Business & Money",
    query: `UK "high street" (barbers OR barbershops OR "hair and beauty") (openings OR closures OR footfall OR "fastest growing" OR vacancy) when:7d`,
  },
  {
    name: "Wire: grooming product and brand launches",
    category: "Products & Tools",
    query: `("men's grooming" OR barbering OR barbershop) (launches OR unveils OR "new range" OR "limited edition") (brand OR range OR product) ${NO_HAIRCUT} when:7d`,
  },
  {
    name: "Wire: clipper and tool brands",
    category: "Products & Tools",
    query: `(Wahl OR Andis OR BaByliss OR StyleCraft OR "Gamma+" OR JRL) (launches OR launch OR partnership OR sponsors OR appoints OR unveils) when:7d`,
  },
  {
    name: "Wire: booking software and payments",
    category: "Tech & Booking",
    query: `(Booksy OR Fresha OR Squire OR Vagaro OR Phorest OR "booking app" OR "booking platform") (barber OR barbershop OR salon) (funding OR launches OR partnership OR acquires OR rollout) when:7d`,
  },
  {
    name: "Wire: apprenticeships, academies and skills",
    category: "People & Training",
    query: `UK (barbering OR hairdressing) (apprenticeship OR apprenticeships OR academy OR "training provider" OR "skills shortage" OR NVQ OR VTCT) when:7d`,
  },
  {
    name: "Wire: awards and competitions",
    category: "News",
    query: `UK (barber OR barbering OR barbershop) (awards OR "of the year" OR shortlist OR winner OR finalists) ${NO_HAIRCUT} when:7d`,
  },
  {
    // The Movers column, same logic as fleet and golf: named people at named
    // companies, and both sides reshare it.
    name: "Wire: industry appointments",
    category: "News",
    query: `UK ("men's grooming" OR barbering OR "hair and beauty") (appoints OR appointed OR "joins as" OR "named as") (director OR "brand manager" OR ambassador OR "head of" OR educator) when:7d`,
  },
];

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

/**
 * Airport Business Magazine — global.
 *
 * Title #5 (docs/vertical-brief-airports.md). Everything golf learned carries
 * over, with one inversion worth knowing: the contamination here lives in the
 * GENERIC queries, not the core beat. Measured 24 Aug 2026 (brief §5): the raw
 * `airport` feed is 15-20% usable and `airport terminal` ~30%, but scoped
 * infrastructure queries run 75-85% usable. So NEVER seed the bare queries
 * `airport`, `airport terminal` or `airport parking` — every entry below pins
 * itself to a commercial verb (awarded, tenders, expands, appoints) or a trade
 * noun (concession, AODB, masterplan), and the passenger layer is excluded by
 * hand.
 *
 * LOCALES. Per beat, like golf. The US edition carries a largely
 * NON-OVERLAPPING stream (regional-airport capex, FAA grants) that roughly
 * doubles the usable pool, so the construction/technology beats run both
 * editions rather than one.
 *
 * THE BUYER RULE (airport edition, in docs/editorial-standard.md): if the
 * natural reader is a passenger, the query is wrong. The consumer opposition
 * (Simple Flying 12.9k, The Points Guy 16.1k on Tranco) is stronger than any
 * trade incumbent; drifting consumer means fighting them on their own ground.
 *
 * THE INCIDENT RULE also shapes the exclusions: crashes, security breaches and
 * crime are the tabloid layer of this sector and never our news. Disruption
 * enters only as economics (cost, recovery, procurement consequence), which is
 * what the resilience query asks for.
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-airport-title.mjs and the content plan, and these must stay in
 * lockstep.
 */
// Exclusions thin the noise; they do not remove it (Google negative operators
// leak — see the golf block above). The buyer and incident rules in the
// editorial standard are the actual guard, and the Researcher enforces them.
const NO_PAX =
  '-"travel tips" -"what to pack" -lounge -lounges -"best airports" -"worst airports" -"how early" -viral -TikTok';
const NO_AIRPORT_INCIDENT = '-crash -stabbing -arrested -smuggling -evacuated';

export const AIRPORT_NEWS_SEARCHES = [
  {
    name: "Wire: expansion and planning (UK/Europe)",
    category: "Expansion & Construction",
    locale: "GB",
    query: `airport (expansion OR "new runway" OR "third runway" OR masterplan OR "planning permission" OR "passenger cap") ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: expansion and construction (US)",
    category: "Expansion & Construction",
    locale: "US",
    query: `airport (expansion OR "new terminal" OR groundbreaking OR "breaks ground" OR "FAA grant") (million OR billion) when:7d`,
  },
  {
    name: "Wire: terminal and runway contracts",
    category: "Expansion & Construction",
    locale: "GB",
    query: `airport (contract OR tender OR "contract awarded" OR consortium OR "design contract") (terminal OR runway OR construction) when:7d`,
  },
  {
    name: "Wire: Gulf, India and Asia mega-projects",
    category: "Expansion & Construction",
    locale: "US",
    query: `airport (Dubai OR Saudi OR Riyadh OR India OR "Al Maktoum" OR Changi OR Incheon) (expansion OR construction OR terminal OR contract) when:7d`,
  },
  {
    name: "Wire: investment, ownership and financing",
    category: "News",
    locale: "GB",
    query: `airport (investment OR privatisation OR concession OR acquisition OR "stake in") (million OR billion) ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: non-aero revenue and concessions",
    category: "Revenue & Commercial",
    locale: "GB",
    query: `airport ("duty free" OR retail OR concession OR "food and beverage") (revenue OR contract OR tender OR awarded OR opens) ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: parking and ground transport revenue",
    category: "Revenue & Commercial",
    locale: "GB",
    query: `airport (parking OR "drop-off" OR "car park") (revenue OR charges OR income OR contract OR operator) -"promo code" -scam when:7d`,
  },
  {
    name: "Wire: traffic results and financials",
    category: "Revenue & Commercial",
    locale: "GB",
    query: `airport ("passenger numbers" OR "annual results" OR "half-year results" OR profit OR "record year") (million OR billion OR percent) ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: baggage and screening systems",
    category: "Technology & Systems",
    locale: "US",
    query: `airport ("baggage handling" OR "security screening" OR "CT scanner" OR checkpoint) (contract OR install OR deployment OR upgrade OR awarded) when:7d`,
  },
  {
    name: "Wire: biometrics and passenger processing",
    category: "Technology & Systems",
    locale: "US",
    query: `airport (biometric OR biometrics OR "e-gates" OR "facial recognition" OR "digital identity") (rollout OR launches OR deploys OR contract OR expands) when:7d`,
  },
  {
    // Named vendors, same pattern as barbering's clipper-brand query: the
    // cheapest way to catch contract news the generic phrasing misses.
    name: "Wire: airport IT and ops software",
    category: "Technology & Systems",
    locale: "GB",
    query: `airport (SITA OR Amadeus OR AODB OR "operations software" OR "management system" OR "cloud platform") (contract OR deal OR rollout OR partnership) when:7d`,
  },
  {
    // The incident rule applies to everything this returns: we cover the cost,
    // the recovery and the procurement consequence, never the incident itself.
    name: "Wire: disruption and resilience economics",
    category: "Operations & Resilience",
    locale: "GB",
    query: `airport (outage OR "IT failure" OR strike OR disruption OR closure) (cost OR operations OR recovery OR compensation) ${NO_AIRPORT_INCIDENT} when:7d`,
  },
  {
    name: "Wire: route development and new services",
    category: "Route Development",
    locale: "GB",
    query: `airport airline (route OR "new route" OR "direct flights" OR "begins service" OR resumes OR adds) when:7d`,
  },
  {
    name: "Wire: energy, net zero and SAF",
    category: "Sustainability & Energy",
    locale: "GB",
    query: `airport ("net zero" OR solar OR "sustainable aviation fuel" OR SAF OR electrification OR "energy costs") when:7d`,
  },
  {
    // The Movers column, same logic as every other title: named people at
    // named organisations, and both sides reshare it.
    name: "Wire: appointments (global)",
    category: "News",
    locale: "GB",
    query: `airport (appoints OR appointed OR "named as" OR "joins as") ("chief executive" OR CEO OR "managing director" OR "chief operating officer" OR "director of") when:7d`,
  },
];
