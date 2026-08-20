// Sources that autodiscovery cannot reach, and how to read them anyway.
//
// lib/feeds.js finds a feed by reading <link rel="alternate"> and then trying
// eight common paths. That works for roughly a fifth of a title's source list,
// which the playbook already says. What it does not say is what to do about the
// ones it misses, and the answer had been "nothing" — Fleet's four trade bodies
// sat at feedStatus null for three days while the title ran on manufacturers
// and government departments, and a trade body is the source a trade title is
// least able to do without.
//
// So: one registry, keyed by the host of the brand's newsHubUrl, holding the
// answer a person worked out by hand. Three kinds, in order of how much they
// cost to run:
//
//   feed     — there IS an RSS feed, autodiscovery just cannot find it.
//   html     — no feed at all. Read the newsroom listing page directly.
//   sitemap  — no feed, and the listing is rendered client-side so there is
//              nothing in the HTML to read. Diff sitemap.xml between scans.
//
// Adding an entry is cheaper than it looks and it is the highest-value hour in
// a new title's setup: verify by hand once, then it runs for ever. See
// docs/new-title-playbook.md §6.

export const NEWSROOMS = {
  // WordPress, but the news lives in a `blog` custom post type. The default
  // /feed is a valid, permanently EMPTY channel, which is worse than a 404:
  // looksLikeFeed() says yes, parseFeed() returns nothing, and the brand is
  // recorded as feedStatus "ok" with zero items for ever.
  "logistics.org.uk": {
    kind: "feed",
    feedUrl: "https://logistics.org.uk/feed/?post_type=blog",
  },

  // Bespoke CMS, no feed anywhere. The listing is server-rendered, so the
  // anchors are readable. Dates live in a sibling span rather than in the link
  // text, so items arrive undated — parseFeed's callers already allow that.
  "www.rha.uk.net": {
    kind: "html",
    listing: "https://www.rha.uk.net/News/News",
    link: /\/news\/news\/detail\//i,
  },

  // Same shape, and the link text carries its own date: "Tue 28 Jul 2026 <headline> Read more".
  "www.zemo.org.uk": {
    kind: "html",
    listing: "https://www.zemo.org.uk/news-events/news.htm",
    link: /\/news-events\/news,/i,
    stripLeadingDate: true,
    stripTrailing: /\s*Read more\s*$/i,
  },

  // Kentico, and the news index is built in the browser: fetching it returns a
  // 39KB page whose only links are the main navigation. There is no API behind
  // it that a server can call, and the article pages themselves are public and
  // perfectly readable — the only thing missing is a way to learn that a new
  // one exists. sitemap.xml lists all 435 of them.
  //
  // Its <lastmod> is worthless: every URL is stamped with today's date on every
  // regeneration, so the sitemap cannot be sorted by recency. What it CAN do is
  // tell us which URLs we have not seen before, which is the same question.
  "www.bvrla.co.uk": {
    kind: "sitemap",
    sitemap: "https://www.bvrla.co.uk/sitemap.xml",
    link: /\/news-and-analysis\/./i,
  },
};

/** The registry entry for a brand, or null. Matched on the news hub's host. */
export function newsroomFor(brand) {
  const url = brand?.newsHubUrl || brand?.website;
  if (!url) return null;
  try {
    return NEWSROOMS[new URL(url).host] || null;
  } catch {
    return null;
  }
}

const UA = "Mozilla/5.0 (compatible; CogentBot/1.0)";

async function fetchText(url, timeoutMs = 12000) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function textOfAnchor(inner) {
  return inner
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const LEADING_DATE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}\s+\w{3}\s+20\d\d)\s*/i;

/**
 * Read a server-rendered newsroom listing.
 *
 * Deliberately anchor-based rather than block-based: a regex over the card
 * markup breaks the first time the site changes a wrapper div, whereas the
 * shape of an article URL is the last thing anyone touches.
 */
export async function readHtmlNewsroom(spec) {
  const html = await fetchText(spec.listing);
  if (!html) return null;

  const items = [];
  const seen = new Set();
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let link;
    try {
      link = new URL(m[1], spec.listing).href;
    } catch {
      continue;
    }
    if (!spec.link.test(link) || seen.has(link)) continue;

    let title = textOfAnchor(m[2]);
    let publishedAt = null;
    if (spec.stripLeadingDate) {
      const d = title.match(LEADING_DATE);
      if (d) {
        const parsed = new Date(d[1]);
        if (!isNaN(parsed)) publishedAt = parsed;
        title = title.replace(LEADING_DATE, "");
      }
    }
    if (spec.stripTrailing) title = title.replace(spec.stripTrailing, "");
    title = title.trim();

    // A headline is a sentence. Anything shorter is "Read more", a breadcrumb
    // or an image link wrapping the same href.
    if (title.length < 20) continue;

    seen.add(link);
    items.push({ title: title.slice(0, 300), link, summary: null, publishedAt });
  }
  return items;
}

/**
 * Read a sitemap and return every URL matching the spec, newest-unknown-first
 * being impossible, so: in sitemap order.
 *
 * The caller is responsible for the part that makes this work — treating the
 * first scan as a baseline rather than as 435 news items.
 */
export async function readSitemapNewsroom(spec) {
  const xml = await fetchText(spec.sitemap, 20000);
  if (!xml) return null;

  const items = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const link = m[1].trim();
    if (!spec.link.test(link) || seen.has(link)) continue;
    seen.add(link);
    // The slug is the headline with the punctuation filed off. Good enough to
    // shortlist against; the Researcher fetches the page itself before it
    // writes anything, and that is where the real title comes from.
    const slug = decodeURIComponent(link.split("/").filter(Boolean).pop() || "");
    const title = slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
    if (title.length < 20) continue;
    items.push({ title: title.slice(0, 300), link, summary: null, publishedAt: null });
  }
  return items;
}
