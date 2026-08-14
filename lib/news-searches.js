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
const LOCALE = "hl=en-GB&gl=GB&ceid=GB:en";

/** RSS URL for a query. `when:7d` keeps the window tight so the wire stays fresh. */
export function searchFeedUrl(query) {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&${LOCALE}`;
}

/** Human-facing search page for the same query, used as the newsHubUrl. */
export function searchHubUrl(query) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&${LOCALE}`;
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
