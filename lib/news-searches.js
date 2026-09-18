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
  // JB's title sheet, 4 Sep 2026: the events that drive this market's news
  // cycle, so coverage lands before the show rather than after.
  {
    name: "Wire: business shows and events",
    category: "News",
    query: 'UK ("London Tech Week" OR "Great British Business Show" OR "B2B Expo" OR "Business Revival" OR "business show" OR "business expo") (announces OR opens OR speakers OR exhibitors OR "takes place") when:7d',
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
  // Lucas's title sheet, 26 Aug 2026: three of the five events that matter are
  // in September. Winners and shortlists are Fleet Professional targets.
  {
    name: "Wire: fleet awards and events",
    category: "News",
    query: 'UK ("Motor Transport Awards" OR "Fleet Champions" OR FORS OR "Fleet & Mobility Live" OR "Commercial Fleet Show" OR "fleet awards" OR "logistics awards") (winner OR winners OR shortlist OR finalists OR announces OR "takes place") when:7d',
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

/**
 * Golf categories changed on 14 Sep 2026: News, Features and Resources and Tools
 * are parents, and every search below points at a News subcategory, which is
 * what the site's section list now holds. Closures and reopenings file under
 * Development because nearly all of them are renovation or redevelopment
 * stories; travel trade files under Hotel & Hospitality, which absorbed the
 * old Golf Travel Trade category.
 */
export const GOLF_NEWS_SEARCHES = [
  {
    name: "Wire: course and resort transactions (US)",
    category: "Investment",
    locale: "US",
    query: `golf (resort OR course OR club) ("has been sold" OR acquires OR acquisition OR "portfolio of") ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: course and resort transactions (Europe)",
    category: "Investment",
    locale: "GB",
    query: `golf (resort OR club) (sold OR acquired OR "takeover" OR "investment") (million OR billion) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: management contracts and operators",
    category: "Investment",
    locale: "US",
    query: `golf (Troon OR "Arcis Golf" OR "Invited Clubs" OR "Heritage Golf" OR "management company") (manage OR portfolio OR adds OR partnership OR expands) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: development and construction (Americas)",
    category: "Development",
    locale: "US",
    query: `golf course ("breaks ground" OR "under construction" OR "will open" OR "new 18-hole") (resort OR development) when:7d`,
  },
  {
    name: "Wire: development and construction (EMEA)",
    category: "Development",
    locale: "GB",
    query: `golf course (development OR "planning permission" OR "breaks ground" OR "to open") (resort OR Saudi OR Portugal OR Spain OR Ireland OR Scotland) when:7d`,
  },
  {
    name: "Wire: development and construction (Asia-Pacific)",
    category: "Development",
    locale: "AU",
    query: `golf course (development OR "under construction" OR "to open") (Vietnam OR Thailand OR Japan OR China OR Australia OR resort) when:7d`,
  },
  {
    name: "Wire: architects and course design",
    category: "Development",
    locale: "US",
    query: `golf course (architect OR "course design" OR redesign OR "restoration project") (appointed OR unveils OR completes) when:7d`,
  },
  {
    name: "Wire: resort operations and revenue",
    category: "Operations",
    locale: "US",
    query: `golf (resort OR club) ("rounds played" OR "green fees" OR "membership sales" OR "revenue per" OR occupancy) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: course closures and reopenings",
    category: "Development",
    locale: "GB",
    query: `golf course (closure OR "to close" OR "has closed" OR reopens OR "reopening") (club OR resort) ${NO_NOISE} when:7d`,
  },
  {
    name: "Wire: agronomy, turf and course management",
    category: "Course and Maintenance",
    locale: "GB",
    query: `golf course (superintendent OR greenkeeper OR "course manager" OR agronomy OR turf) (appointed OR renovation OR project OR trial) when:7d`,
  },
  {
    name: "Wire: water, irrigation and sustainability",
    category: "Sustainability",
    locale: "GB",
    query: `golf course (water OR irrigation OR drought OR "reclaimed water" OR sustainability) (restriction OR regulation OR ban OR investment OR certification) when:7d`,
  },
  {
    name: "Wire: golf travel trade",
    category: "Hotel & Hospitality",
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
    category: "Appointments",
    locale: "US",
    query: `golf (resort OR club OR "golf group") (appoints OR appointed OR "named as" OR "joins as") ("general manager" OR "director of golf" OR president OR superintendent) when:7d`,
  },
  {
    name: "Wire: hotel and resort investment crossover",
    category: "Investment",
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
  // Lucas's title sheet, 25 Aug 2026: heads of cargo and passenger experience
  // are readers, and neither beat had a search. Tom's note, 6 Sep 2026: big
  // renovation programmes and mass technology rollouts are where supplier
  // budgets go, so both get a standing search of their own.
  {
    name: "Wire: cargo terminals and freight",
    category: "Operations & Resilience",
    locale: "GB",
    query: `airport (cargo OR freight OR "cargo terminal" OR "cargo hub" OR freighter) (opens OR expansion OR investment OR contract OR tonnes OR "new facility") ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: passenger experience and queues",
    category: "Operations & Resilience",
    locale: "US",
    query: `airport ("passenger experience" OR "wait times" OR "queue times" OR "customer satisfaction" OR ASQ OR "service quality") (investment OR launches OR rollout OR results OR award OR technology) ${NO_PAX} when:7d`,
  },
  {
    name: "Wire: renovation and capital programmes",
    category: "Expansion & Construction",
    locale: "GB",
    query: `airport (renovation OR modernisation OR modernization OR refurbishment OR "capital programme" OR "capital program" OR "government funding" OR "World Cup" OR Olympics) (terminal OR runway OR airport) (million OR billion) when:7d`,
  },
  {
    name: "Wire: technology rollouts",
    category: "Technology & Systems",
    locale: "US",
    query: `airport (rollout OR "rolled out" OR "roll-out" OR "all airports" OR "every airport" OR mandate OR deadline OR nationwide) ("CT scanner" OR "CT scanners" OR biometric OR "e-gates" OR "digital identity" OR AODB OR autonomous OR "self-service" OR "digital travel credential") when:7d`,
  },
];

/**
 * Gym Business News: the business of fitness for small operators.
 *
 * THE SCOPE RULE (docs/editorial-standard.md): we cover the business of
 * fitness, never the practice of it. If a query would return something a gym
 * member wanting a workout would read, it is wrong. Never seed bare "gym",
 * "fitness", "workout", "personal trainer" or "HYROX".
 *
 * `when:7d` LEADS every query deliberately. Tested 18 Sep 2026: Google News
 * drops a trailing `when:7d` once a query passes roughly 200 characters and
 * returns all-time results, which the ingester's age cutoff then discards, so
 * the search reads as a quiet week. Keep the exclusion block short for the
 * same reason.
 *
 * Deliberate absences: Start & Grow has no wire query (the PT and start-up
 * beats have no news supply; they are fed by the content plan), and there is
 * no appointments query (tested: ~3 usable in 41).
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-gym-business-news-title.mjs and the content plan, and these must
 * stay in lockstep.
 */
// Exclusions thin the consumer noise; they do not remove it. The scope rule is
// the actual guard, and the Researcher enforces it.
const NO_WORKOUT = '-workout -"weight loss" -diet';

export const GYM_BUSINESS_NEWS_SEARCHES = [
  {
    name: "Wire: gym and studio openings",
    category: "News",
    locale: "GB",
    query: `when:7d ("new gym" OR "gym opens" OR "gym to open" OR "gym opening" OR "fitness studio opens" OR "new fitness studio" OR "health club opens" OR "24-hour gym") ${NO_WORKOUT} -school`,
  },
  {
    // Openings and closures is the strongest format signal in the fleet's data.
    name: "Wire: gym closures and failures",
    category: "News",
    locale: "GB",
    query: `when:7d (gym OR "fitness studio" OR "health club" OR "gym chain") (closes OR closure OR "to close" OR administration OR administrators OR liquidation) -school`,
  },
  {
    // Every chain story answers one question for the reader: what does this
    // change for an independent? (the small-operator rule).
    name: "Wire: UK operators, results and deals",
    category: "Franchise & Deals",
    locale: "GB",
    query: `when:7d (PureGym OR "The Gym Group" OR "David Lloyd Leisure" OR "David Lloyd Clubs" OR "Anytime Fitness" OR "Virgin Active" OR "Basic-Fit" OR "Everyone Active" OR "Nuffield Health" OR "JD Gyms" OR "Snap Fitness" OR "Third Space")`,
  },
  {
    name: "Wire: fitness franchise deals",
    category: "Franchise & Deals",
    locale: "US",
    query: `when:7d ("fitness franchise" OR "gym franchise" OR "boutique fitness" OR "fitness franchisee") (franchise OR franchisee OR "development agreement" OR units OR studios OR expansion OR signs)`,
  },
  {
    name: "Wire: fitness M&A and funding",
    category: "Franchise & Deals",
    locale: "US",
    query: `when:7d ("fitness company" OR "gym chain" OR "health club" OR "fitness brand" OR "fitness operator" OR "boutique fitness") (acquires OR acquisition OR raises OR "funding round" OR "private equity" OR merger)`,
  },
  {
    // "Xplor" is deliberately absent: it collides with a mining investor event.
    name: "Wire: gym software and platforms",
    category: "Tech & Software",
    locale: "US",
    query: `when:7d ("gym software" OR "gym management" OR "fitness software" OR Mindbody OR "ABC Fitness" OR Glofox OR Daxko OR EGYM OR Wellhub OR Hapana OR WellnessLiving) (launches OR partnership OR acquires OR funding OR integration OR partners OR AI)`,
  },
  {
    // "Keiser" is deliberately absent: it returns a university's sports news.
    name: "Wire: commercial equipment",
    category: "Equipment & Fit-Out",
    locale: "GB",
    query: `when:7d (Technogym OR "Life Fitness" OR "Matrix Fitness" OR Precor OR Freemotion OR "Escape Fitness" OR Eleiko OR "Hammer Strength") (operator OR operators OR club OR clubs OR partnership OR launches OR supplier) -review -best`,
  },
  {
    name: "Wire: sector bodies and policy",
    category: "News",
    locale: "GB",
    query: `when:7d (ukactive OR CIMSPA OR "fitness sector" OR "physical activity sector" OR "leisure operators" OR "Health and Fitness Association")`,
  },
  {
    name: "Wire: rates, tax and costs",
    category: "Money & Compliance",
    locale: "GB",
    query: `when:7d (gym OR gyms OR "fitness industry" OR "leisure centres" OR "leisure operators") (VAT OR "business rates" OR HMRC OR "energy costs" OR "minimum wage" OR "national insurance" OR subscription OR CMA OR "consumer law")`,
  },
  {
    name: "Wire: membership, pricing and retention",
    category: "Members & Marketing",
    locale: "GB",
    query: `when:7d (gym OR gyms OR "health club" OR "fitness studio" OR "fitness industry") ("membership prices" OR "price rise" OR retention OR churn OR "membership numbers" OR "record members" OR "members rise") ${NO_WORKOUT}`,
  },
  {
    // Council leisure refurbishments are where fit-out and equipment budgets go.
    name: "Wire: leisure contracts and investment",
    category: "Equipment & Fit-Out",
    locale: "GB",
    query: `when:7d ("leisure centre" OR "leisure centres" OR "leisure trust") (contract OR operator OR council OR investment OR refurbishment OR gym) (million OR £)`,
  },
  {
    name: "Wire: fitness industry data (US)",
    category: "News",
    locale: "US",
    query: `when:7d ("fitness industry" OR "health club industry" OR "gym industry") (revenue OR operators OR report OR membership OR clubs OR survey) ${NO_WORKOUT}`,
  },
  {
    name: "Wire: personal trainers and careers",
    category: "People & PTs",
    locale: "US",
    query: `when:7d ("personal trainers" OR "personal training" OR "fitness coaches" OR "fitness professionals") (business OR income OR certification OR "gym owners" OR employed OR independent OR pay) ${NO_WORKOUT}`,
  },
];

/**
 * Nursery Daily (nursery-daily). The consumer twin is the worst in the fleet:
 * operator intent is about 1% of "childcare" searches and about 12% of
 * "nursery" searches (docs/vertical-brief-nurseries.md section 4). So:
 *
 * NEVER seed bare `nursery`, `childcare`, `day nursery`, `nursery staff`,
 * `early years sector` or `30 hours childcare`. Every query is scoped to an
 * operator marker (acquisition, funding rate, planning, Ofsted framework,
 * workforce, fees as a provider).
 *
 * intitle: is used on the nursery beats because Google News matches words
 * anywhere on the publisher's page, and regional sites with "nursery" in their
 * menus flooded the untitled versions with unrelated local news.
 *
 * THE SAFEGUARDING RULE shapes the exclusions: harm to children is the
 * sector's lead story and never ours. NO_HARM thins it; it does not remove it,
 * and the rule itself, plus a human-review gate, is the actual guard.
 *
 * KEEP EVERY QUERY SHORT. Measured 18 Sep 2026: queries of roughly 200+
 * characters or with many OR terms silently lose their `when:` window and
 * return items years old. Every query below was checked to honour its window.
 *
 * Deliberate absence: no query feeds Operations & Tech. Vendor names return
 * Bayeux Tapestry and US daycare-fraud stories; that section is fed by the
 * content plan and the supplier feeds only. No appointments query either: the
 * scoped versions returned no UK nursery appointments in 14 days.
 *
 * `category` must match a section in scripts/seed-nursery-daily-title.mjs.
 */
const NO_PARENT = '-"near me" -rhymes -plant -garden';
const NO_HARM = '-died -abuse -trial -sentenced';

export const NURSERY_DAILY_NEWS_SEARCHES = [
  {
    name: "Wire: nursery openings and expansion",
    category: "News",
    query: `when:7d (intitle:nursery OR intitle:nurseries) (opens OR opening OR "new nursery" OR expands OR expansion) ${NO_PARENT} ${NO_HARM}`,
  },
  {
    // A single setting's closure after an Ofsted inspection is NOT ours under
    // the safeguarding rule; council and viability closures are.
    name: "Wire: nursery closures",
    category: "News",
    query: `when:7d (intitle:nursery OR intitle:nurseries OR intitle:"pre-school") (closure OR close OR closing) ${NO_PARENT} -store ${NO_HARM}`,
  },
  {
    name: "Wire: school-based nurseries and wraparound",
    category: "News",
    query: `when:7d ("school-based nurseries" OR "school-based nursery" OR "school nurseries" OR "wraparound childcare" OR "maintained nursery")`,
  },
  {
    // 30 days, not 7: the deal flow is about one a week, and FeedItem is unique
    // on (siteId, link), so the wider window cannot duplicate.
    name: "Wire: nursery acquisitions",
    category: "Deals & Valuations",
    query: `(intitle:nursery OR intitle:nurseries) (acquires OR acquisition OR acquired OR "sold to" OR buys) -plant when:30d`,
  },
  {
    // Group-level regulatory notices from official sources ARE in scope under
    // the safeguarding rule, for their business consequence only, and only
    // with the human-review gate in place.
    name: "Wire: the large groups",
    category: "Deals & Valuations",
    query: `(intitle:"Kids Planet" OR intitle:"Busy Bees" OR intitle:"Bright Horizons" OR intitle:Storal OR intitle:Grandir OR intitle:Partou) -BFAM -NYSE -shares ${NO_HARM} when:14d`,
  },
  {
    name: "Wire: funding rates and funded hours",
    category: "Funding & Fees",
    query: `when:7d ("early years funding" OR "funding rates" OR "funded hours" OR "funded childcare") (nurseries OR providers OR council) -fraud -daycare`,
  },
  {
    name: "Wire: fees and viability",
    category: "Funding & Fees",
    query: `when:7d (nurseries OR "childcare providers") (fees OR "top-up" OR "additional charges" OR "financial pressure" OR viability) ${NO_HARM}`,
  },
  {
    name: "Wire: Scotland, Wales and Northern Ireland",
    category: "Funding & Fees",
    query: `when:7d ("early learning and childcare" OR "Flying Start childcare" OR "Childcare Offer for Wales" OR "funded childcare") (Scotland OR Wales OR "Northern Ireland" OR council)`,
  },
  {
    name: "Wire: workforce and pay",
    category: "Staffing & Pay",
    query: `when:7d ("nursery staff" OR "early years staff" OR "early years workforce" OR "childcare workers") (pay OR wage OR recruitment OR shortage OR bonus) -US`,
  },
  {
    name: "Wire: Ofsted and early years regulation",
    category: "Compliance & Ofsted",
    query: `when:7d Ofsted ("early years" OR nurseries OR childminders) (framework OR inspections OR notice OR registration OR "report cards") ${NO_HARM}`,
  },
  {
    name: "Wire: EYFS, ratios and compliance cost",
    category: "Compliance & Ofsted",
    query: `when:7d (nurseries OR "early years settings") (EYFS OR ratios OR CCTV OR "safeguarding training") (government OR DfE OR cost OR consultation) ${NO_HARM}`,
  },
  {
    name: "Wire: planning and premises",
    category: "Property & Premises",
    query: `when:7d ("day nursery" OR "children's nursery" OR "nursery for") ("planning permission" OR "planning application" OR "change of use" OR approved)`,
  },
];

/**
 * Senior Lifestyle Business: UK-led, AU/NZ second, US capital only.
 *
 * The retirement community as a business (docs/vertical-brief-retirement-villages.md).
 * Measured 18 Sep 2026 in GB, AU and US editions (docs/senior-lifestyle-business-launch.md).
 * NEVER seed the bare queries `retirement village`, `senior living`,
 * `later living`, `extra care` or `care home` (brief §4): the raw feeds are
 * 25-45% usable and drift to residents' birthdays, obituaries and crime.
 *
 * THE FRONT-DOOR RULE (docs/editorial-standard.md): if the resident has their
 * own front door and a lease, licence or tenancy, it is ours; a room and a care
 * plan in a CQC-registered care home belongs to CIM's Care Home Magazine. No
 * query here may contain a care-home term except as an exclusion.
 *
 * QUERY LENGTH. Google News silently drops `when:7d` from an over-complex
 * query and returns up to 100 stale items. Every entry below was checked for
 * it. Adding alternatives or exclusions to any of them means re-checking that
 * the items are still dated within the week.
 *
 * LOCALES. Per beat: AU for AU/NZ operator names and land lease, US for
 * capital and sales, GB elsewhere. Generic phrases return the same items in
 * every edition.
 *
 * Deliberate absence: no wire query feeds "Design & Amenities" (measured ~25%
 * usable); it is plan-fed.
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-senior-lifestyle-business-title.mjs and the content plan, and
 * these must stay in lockstep.
 */
// Exclusions thin the care-home layer; they do not remove it (negative
// operators match the article body and leak). Measured cost: 10-15% of items
// on most queries, 60% on the extra care query (so it runs without), and it
// breaks the appointments query outright (so that runs without too). The
// front-door rule is the actual guard, and the Researcher enforces it.
const NO_CARE_HOME = '-"care home" -"care homes" -"nursing home" -"nursing homes"';

export const SENIOR_LIFESTYLE_BUSINESS_NEWS_SEARCHES = [
  {
    name: "Wire: UK later living",
    category: "News",
    locale: "GB",
    query: `when:7d "later living" (scheme OR developer OR operator OR homes OR investment OR planning) ${NO_CARE_HOME}`,
  },
  {
    // Eight names is the ceiling: fourteen dropped when:7d (see QUERY LENGTH).
    // Bare "Beechcroft" and "Lifestory" match schools and 5K runs; keep them out.
    name: "Wire: UK operators",
    category: "News",
    locale: "GB",
    query: `when:7d ("McCarthy Stone" OR "McCarthy & Stone" OR "Audley Group" OR "Inspired Villages" OR "Retirement Villages Group" OR "Rangeford Villages" OR "Churchill Retirement")`,
  },
  {
    // The Movers column. No exclusion block: it breaks this query.
    name: "Wire: appointments",
    category: "News",
    locale: "GB",
    query: `when:7d ("later living" OR "retirement village" OR "retirement living" OR "retirement housing" OR "senior living") (appoints OR appointed OR "joins as" OR "named as")`,
  },
  {
    name: "Wire: retirement village planning",
    category: "Development & Planning",
    locale: "GB",
    query: `when:7d "retirement village" (planning OR approved OR consent OR appeal OR council) ${NO_CARE_HOME}`,
  },
  {
    // No exclusion block: extra care schemes sit beside care homes in the copy,
    // and excluding them cost 3 of 5 usable items. The front-door rule decides.
    name: "Wire: extra care and housing with care",
    category: "Development & Planning",
    locale: "GB",
    query: `when:7d ("extra care housing" OR "extra care scheme" OR "extra care facility" OR "extra care development" OR "housing with care")`,
  },
  {
    // "Seniors housing" is the NSW planning term (SEPP), so this is the AU
    // development pipeline: exhibitions, DAs and approvals.
    name: "Wire: seniors housing proposals (AU)",
    category: "Development & Planning",
    locale: "AU",
    query: `when:7d "seniors housing" (proposal OR exhibition OR "development application" OR approval OR approved OR planning) ${NO_CARE_HOME}`,
  },
  {
    name: "Wire: capital, funding and acquisitions",
    category: "Capital & Investment",
    locale: "GB",
    query: `when:7d ("later living" OR "retirement living" OR "retirement village") (funding OR investment OR loan OR facility OR acquisition) ${NO_CARE_HOME}`,
  },
  {
    // US capital markets only: REIT and platform deals that move UK money, and
    // benchmarks. US operator news is Senior Housing News's ground, not ours.
    name: "Wire: US senior housing capital markets",
    category: "Capital & Investment",
    locale: "US",
    query: `when:7d ("senior housing" OR "seniors housing" OR "senior living") (acquisition OR acquires OR financing OR portfolio OR REIT) -"skilled nursing" -"nursing home"`,
  },
  {
    name: "Wire: land lease communities (AU)",
    category: "Capital & Investment",
    locale: "AU",
    query: `when:7d "land lease" (community OR communities OR lifestyle) (developer OR operator OR acquisition OR approval OR takeover)`,
  },
  {
    // "Ryman Healthcare", never bare Ryman: the bare word returns Nashville's
    // Ryman Auditorium and a US hotel REIT.
    name: "Wire: listed AU/NZ operators",
    category: "Operators & Economics",
    locale: "AU",
    query: `when:7d ("Ryman Healthcare" OR Summerset OR "Oceania Healthcare" OR Arvida OR Metlifecare OR Aveo OR Ingenia OR GemLife) (village OR retirement OR "land lease" OR results)`,
  },
  {
    name: "Wire: operator economics",
    category: "Operators & Economics",
    locale: "AU",
    query: `when:7d "retirement village" (operator OR developer) (profit OR results OR occupancy OR sales OR earnings) ${NO_CARE_HOME}`,
  },
  {
    // The resident-harm rule applies to everything this returns: repayment
    // waits and fee rulings are regulatory risk to operators, never a
    // resident's story, and no private resident is ever named.
    name: "Wire: AU/NZ village law and fees",
    category: "Fees & Regulation",
    locale: "AU",
    query: `when:7d "retirement village" (law OR bill OR reform OR repayment OR "Retirement Commissioner" OR tribunal OR ACCC) ${NO_CARE_HOME}`,
  },
  {
    name: "Wire: UK event fees and older people's housing policy",
    category: "Fees & Regulation",
    locale: "GB",
    query: `when:7d ("event fees" OR "exit fees" OR "older people's housing" OR "retirement housing" OR "later living") (government OR consultation OR taskforce OR regulation OR NPPF OR leasehold)`,
  },
  {
    name: "Wire: sales, occupancy and marketing",
    category: "Sales & Marketing",
    locale: "US",
    query: `when:7d ("retirement village" OR "retirement living" OR "later living" OR "senior living") ("sales director" OR "marketing director" OR "sales and marketing" OR occupancy OR "move-ins" OR "sold out")`,
  },
];

/**
 * Dental Business News. UK-only (markets ["GB"]), GB edition throughout.
 *
 * The brief measured the bare `dentist` feed at ~35% usable and `dental
 * practice` at ~45%, both swamped by patient health advice, obituaries, crime
 * and India's NEET admissions. So every query here is anchored on a business
 * phrase, and the patient exclusion block goes only on the queries that
 * measurably drift patient-side.
 *
 * Never seed bare `dentist`, `dental`, `teeth`, `NHS dentist`, `teeth
 * whitening`, `UDA` (it returns Kenyan politics: the UDA is a party) or a bare
 * group name.
 *
 * Finance & Tax deliberately has NO wire query: every finance query tested on
 * 18 Sep 2026 returned US DSO and stock-tip items and nothing usable from the
 * UK. It is fed by the content plan and the direct feeds only. Vendor corporate
 * news (Straumann, Dentsply Sirona, Henry Schein, Align, Envista) is likewise
 * excluded: 40 items a week, almost all stock-tip farms.
 *
 * `category` must match a section on the site, and the section list is defined
 * by scripts/batch-plan-dental-business-news.json. Keep them in lockstep.
 */
const NO_PATIENT = '-"near me" -whitening -veneers -"Turkey teeth"';

export const DENTAL_BUSINESS_NEWS_SEARCHES = [
  {
    // ~75% usable (6 of 8). Local access stories are usable only as contract
    // economics and capacity, per the owner rule.
    name: "Wire: NHS dental contract and funding",
    category: "NHS Contract",
    query: `when:7d ("NHS dentistry" OR "NHS dental contract" OR "dental contract reform" OR "units of dental activity" OR "UDA value") ${NO_PATIENT}`,
  },
  {
    // 100% usable (4 of 4). Four contract regimes means four policy threads.
    name: "Wire: devolved dental contracts",
    category: "NHS Contract",
    query: `when:7d ("NHS dentistry" OR "dental contract" OR "general dental services") (Wales OR Scotland OR "Northern Ireland")`,
  },
  {
    // 100% usable (2 of 2), low volume, overlaps the contract query. Feeds the
    // private conversion index.
    name: "Wire: handbacks and going private",
    category: "Private & Plans",
    query: `when:7d ("dental practice" OR dentist OR dentists) ("hands back" OR "handed back" OR "going private" OR "leaving the NHS" OR "NHS contract") ${NO_PATIENT}`,
  },
  {
    // 0 in 7 days, 1 in 30 (usable). A tripwire, not a supply line: UK deals do
    // not reach Google News, which is why the deals tracker is the flagship.
    name: "Wire: UK practice and group deals",
    category: "Deals & Groups",
    query: `when:7d ("dental group" OR "dental practice" OR "dental practices") (acquires OR acquired OR acquisition OR "sold to" OR "private equity") (UK OR England OR Scotland OR Wales)`,
  },
  {
    // ~65% usable (2 of 3). Group names only ever paired with a dental term.
    name: "Wire: the named dental groups",
    category: "Deals & Groups",
    query: `when:7d (mydentist OR "Bupa Dental Care" OR PortmanDentex OR "Portman Dental" OR "Rodericks Dental" OR "Clyde Munro" OR "Colosseum Dental" OR "Together Dental") (practice OR practices OR NHS)`,
  },
  {
    // ~50% usable (1 of 2 in 7 days, 2 of 3 in 14). Named local businesses:
    // the openings and closures tracker's raw material. No exclusion block:
    // it takes the query past the length limit.
    name: "Wire: practice openings and closures",
    category: "News",
    query: `when:7d ("new dental practice" OR "dental practice to close" OR "dental practice closes" OR "dental practice opens" OR "dental surgery closes" OR "dental practice closure")`,
  },
  {
    // ~55% usable (5 of 9).
    name: "Wire: dental workforce",
    category: "Workforce",
    query: `when:7d ("dental nurse" OR "dental nurses" OR "dental therapists" OR "dental workforce" OR "dentist shortage") (UK OR NHS OR GDC OR visa)`,
  },
  {
    // ~75% usable (3 of 4).
    name: "Wire: visas and international recruitment",
    category: "Workforce",
    query: `when:7d (dentists OR "dental nurses") ("skilled worker" OR visa OR "international dentists" OR "overseas-qualified") UK`,
  },
  {
    // ~80% usable (4 of 5). The fitness-to-practise rule governs every item:
    // published determinations only, names only as the regulator publishes
    // them, never a live case. One of the five test items was exactly that
    // trap (a named suspension with no published reason).
    name: "Wire: GDC and CQC",
    category: "Regulation & Compliance",
    query: `when:7d ("General Dental Council" OR GDC OR CQC) (dental OR dentistry OR dentists)`,
  },
  {
    // ~65% usable (3 of 3 on topic, most not dental-specific). The claims rule
    // applies: the regulation and liability of aesthetics, never how-to.
    name: "Wire: aesthetics licensing and regulation",
    category: "Regulation & Compliance",
    query: `when:7d ("non-surgical cosmetic" OR "cosmetic procedures" OR botox OR fillers) (licensing OR licence OR "Department of Health") (England OR UK)`,
  },
  {
    // 100% usable (4 of 4). The quotable voices on every contract story.
    name: "Wire: BDA, ADG, BDIA and BADN",
    category: "News",
    query: `when:7d ("British Dental Association" OR "Association of Dental Groups" OR "British Dental Industry Association" OR "British Association of Dental Nurses")`,
  },
  {
    // ~50% usable (3 of 6).
    name: "Wire: practice software and technology",
    category: "Premises & Technology",
    query: `when:7d ("dental practice" OR "dental practices" OR "dental group") (software OR AI OR "practice management" OR digital) (UK OR NHS OR Britain)`,
  },
  {
    // 100% usable (2 of 2), low volume. Award shortlists name practice owners:
    // each one is an interview target.
    name: "Wire: dental business awards",
    category: "News",
    query: `when:7d ("Private Dentistry Awards" OR "Dentistry Awards" OR "Dental Awards" OR "Dental Industry Awards" OR "Aesthetic Dentistry Awards")`,
  },
];

/**
 * Smart Farming News: the business of the farm, UK-only, GB edition throughout
 * (docs/smart-farming-news-launch.md, block C).
 *
 * Measured 18 Sep 2026: Google News does not honour `when:7d` for every query
 * shape. The solar, grants, BNG and land-value queries returned items up to
 * twelve months old; the scan dedupes by link, so the first scan backfills and
 * later scans see only new items.
 *
 * `category` must match a section on the site. The section list is defined in
 * scripts/seed-smart-farming-news-title.mjs, and these must stay in lockstep.
 */
// Consumer and hobby stems that the owner rule keeps out of the wire:
// Clarkson's Farm, farm-shop reviews, days out, property listings, petting farms.
const NO_FARM_NOISE =
  '-Clarkson -"Diddly Squat" -"farm shop" -"days out" -pumpkin -"for sale" -"near me" -"open farm" -petting';

// Paid market-research listings ("Precision Agriculture Market Size 2034") swamp
// every agtech query and carry no reportable fact.
const NO_MARKET_REPORT = '-"market size" -"market report" -CAGR';

export const SMART_FARMING_NEWS_SEARCHES = [
  {
    name: "Wire: farm diversification projects",
    category: "Diversification",
    query: `when:7d UK ("farm diversification" OR "diversified farm" OR "diversification project" OR "diversification scheme") ${NO_FARM_NOISE}`,
  },
  {
    // Planning decisions are the kernel here: every approval or refusal is a
    // named farm, a named use and usually a stated income case.
    name: "Wire: lets, venues and farm buildings",
    category: "Diversification",
    query: `when:7d UK (farm OR farmer OR farmland OR "farm buildings") ("holiday let" OR "holiday lets" OR glamping OR "shepherd huts" OR "wedding venue" OR "barn conversion" OR "Class Q" OR "self-storage" OR "business units") (planning OR approved OR refused OR income OR tax OR business) ${NO_FARM_NOISE}`,
  },
  {
    // The politics rule applies to everything this returns: objection
    // campaigns and "food versus solar" rows are reported as business (who is
    // paid, how much, what was decided), never taken sides on.
    name: "Wire: solar on farmland",
    category: "Energy & Land Use",
    query: `when:7d UK (farmland OR "agricultural land" OR landowner OR landowners OR farmer) ("solar farm" OR "solar park") (approved OR approval OR planning OR consent OR refused OR lease OR rent OR income) ${NO_FARM_NOISE}`,
  },
  {
    name: "Wire: landowner energy deals",
    category: "Energy & Land Use",
    query: `when:7d UK (landowner OR landowners OR farmer OR farmers OR farmland) ("battery storage" OR "grid connection" OR "wind farm" OR "anaerobic digestion" OR biomethane OR "option agreement" OR "community benefit") -offshore`,
  },
  {
    name: "Wire: BNG, carbon and nature markets",
    category: "Natural Capital",
    query: `when:7d UK ("biodiversity net gain" OR "habitat bank" OR "nature market" OR "nature markets" OR "natural capital" OR "carbon credits" OR "woodland carbon") (farm OR farmers OR landowners OR "land managers" OR farmland)`,
  },
  {
    // The no-advice rule and the politics rule both apply. Scoped to the
    // rules, the advisers and HMRC so the protest-and-personality coverage of
    // the farm tax stays out; the bare "farm inheritance tax" query is ~40%
    // politics.
    name: "Wire: APR, IHT and succession",
    category: "Land, Tax & Succession",
    query: `when:7d ("agricultural property relief" OR "business property relief" OR "farm inheritance tax" OR "farm succession" OR "succession planning") (farm OR farmers OR farming OR estate) (HMRC OR adviser OR advisers OR accountants OR solicitors OR allowance OR "£2.5m" OR planning)`,
  },
  {
    name: "Wire: farmland values and rents",
    category: "Land, Tax & Succession",
    query: `when:7d ("farmland values" OR "farmland prices" OR "farmland market" OR "farm rents" OR "farm business tenancy" OR "agricultural tenancy" OR "land values") (UK OR England OR Scotland OR Wales OR Savills OR "Knight Frank" OR "Strutt & Parker" OR "Carter Jonas")`,
  },
  {
    name: "Wire: agritech and precision farming",
    category: "Farm Tech",
    query: `when:7d UK (agritech OR "agri-tech" OR "precision farming" OR "precision agriculture" OR "farm robot" OR "agricultural robotics") (farm OR farmers OR growers) ${NO_MARKET_REPORT} ${NO_FARM_NOISE}`,
  },
  {
    // Tractor registrations are the AEA's monthly data drop and the cleanest
    // capex signal the sector publishes; robots and drones are the payback
    // stories the title exists to judge.
    name: "Wire: robots, autonomy and machinery data",
    category: "Farm Tech",
    query: `when:7d ("tractor registrations" OR "autonomous tractor" OR "robotic milking" OR "milking robot" OR "precision spraying" OR "farm robot" OR "agricultural robot" OR "spray drone" OR "agricultural drone") (UK OR British OR farmers) ${NO_MARKET_REPORT}`,
  },
  {
    name: "Wire: agtech funding and deals",
    category: "Farm Tech",
    query: `when:7d (agritech OR "agri-tech" OR agtech) (raises OR raised OR funding OR "seed round" OR "Series A" OR acquires OR acquisition) (UK OR British OR London OR Cambridge OR Scotland) ${NO_MARKET_REPORT}`,
  },
  {
    name: "Wire: farm data, software and AI",
    category: "Software & Data",
    query: `when:7d ("farm data" OR "farm management software" OR "herd management" OR "farm software" OR "digital farming" OR AI) (farmers OR farm OR farming) (UK OR British OR AHDB OR Defra OR England) ${NO_MARKET_REPORT} -"data centre"`,
  },
  {
    // Deliberately NOT the general SFI or Countryside Stewardship beat, which
    // is the incumbents' daily ground. Only the capital and technology grants
    // that change a payback sum.
    name: "Wire: equipment, technology and capital grants",
    category: "Finance & Grants",
    query: `when:7d ("Farming Equipment and Technology Fund" OR FETF OR "Farming Innovation Programme" OR "Farming Investment Fund" OR "Capital Grants" OR "ADOPT Fund" OR "Rural England Prosperity Fund") (farm OR farmers OR farming OR growers)`,
  },
  {
    name: "Wire: farm lending and finance",
    category: "Finance & Grants",
    query: `when:7d UK (farm OR farmers OR farming OR agricultural OR agriculture) (lending OR loan OR loans OR "asset finance" OR "green finance" OR mortgage) (bank OR Oxbury OR AMC OR Lloyds OR NatWest OR HSBC OR Barclays OR Santander)`,
  },
  {
    // The Movers column: named people at named firms, and both sides reshare it.
    name: "Wire: industry appointments",
    category: "News",
    query: `when:7d UK (agritech OR "agri-tech" OR "rural business" OR "land agent" OR "natural capital" OR "farm business" OR agricultural OR farming) (appoints OR appointed OR "joins as" OR "named as" OR "new chief executive") (director OR head OR partner OR "chief executive" OR chair)`,
  },
];
