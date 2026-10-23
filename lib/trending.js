import Anthropic from "@anthropic-ai/sdk";
import { prisma, forSite } from "./prisma";
import { sectionNames } from "./sections";
import { untrustedBlock } from "./voice";

// Trending Topics: catch a search spike while it is still rising, and get a
// sourced article on it out ahead of the crowd.
//
// The Researcher reads Search Console over ninety days, which finds steady
// long-tail demand and averages a 48-hour spike into nothing. What did best for
// the fleet in September was the opposite shape: "smarty plants dragons den"
// (a broadcast) and "broadstairs restaurant shuts down" (3,221 impressions at
// position 6.9, six clicks). On a spike the first decent article takes Top
// Stories and keeps it, so being two hours earlier beats being better written.
//
// The feed is Google's own "Trending now" list per market. Most of it is sport
// and celebrity, so each new term is matched to the one title whose readers
// would care, or to none.
//
// There was a second lane here, single search queries spiking on our own
// titles in Search Console. Beside Google Trends volumes its numbers read as
// worthless (13 impressions against 20K searches), because Search Console only
// counts searches we appeared in, and its natural action was improving an
// article we already had rather than commissioning one. It became the Rising
// Articles section (lib/rising-articles.js), measured per page instead.

const CLASSIFY_MODEL = "claude-haiku-4-5";

// Paywalled publishers: listed by Google beside a trend but fetching them
// returns a login wall, and a draft written from a login wall is a draft
// written from the headline. Kept as sources for the brief, never chosen as
// the one the article links and is written from when anything else exists.
const PAYWALLED = ["ft.com", "thetimes.com", "thetimes.co.uk", "telegraph.co.uk", "wsj.com", "bloomberg.com", "economist.com", "nytimes.com"];

// Below this the classifier is reaching. Measured on the first dry run: the
// genuine matches scored 68-75, the stretches (a rail crash for the airport
// title) around 50.
const MIN_RELEVANCE = 55;

// The markets whose trends are read, whatever a title's Site.markets says.
// UK only since 20 Oct 2026: of the first 42 trending pieces, the 13 written
// from US trends (mostly US Social Security for Senior Lifestyle, US airline
// news for Airport) earned 0.2 clicks each, one of them any click at all,
// against 3.6 each for the 29 from GB. A young domain does not outrank US
// national news on its own home searches. Site.markets still governs the
// Researcher and keywords; this only narrows the trend feed.
const TREND_MARKETS = ["GB"];

// What the tab shows: anything seen in the last two days. Trends that are still
// in Google's feed keep having lastSeenAt bumped, so a live one never ages out.
export const WINDOW_HOURS = 48;

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const paywalled = (u) => PAYWALLED.some((d) => hostOf(u) === d || hostOf(u).endsWith(`.${d}`));

/** "20K+" -> 20000, "1,000+" -> 1000. */
export function trafficFloor(band) {
  const m = String(band || "").replace(/,/g, "").match(/([\d.]+)\s*([KM])?/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6 }[(m[2] || "").toUpperCase()] || 1;
  return Math.round(Number(m[1]) * mult);
}

export function parseNews(topic) {
  try {
    const list = JSON.parse(topic?.news || "[]");
    return Array.isArray(list) ? list.filter((n) => n && n.url) : [];
  } catch {
    return [];
  }
}

/** The publisher an article is written from and links to: first free one, else the first. */
export function primarySource(topic) {
  const news = parseNews(topic);
  return news.find((n) => !paywalled(n.url)) || news[0] || null;
}

/* ----------------------------------------------------------- google trends */

const decode = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"))?.[1]);
const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// Google's own category ids on the Trending now page.
const CATEGORY = {
  1: "Autos and vehicles", 2: "Beauty and fashion", 3: "Business and finance", 4: "Entertainment",
  5: "Food and drink", 6: "Games", 7: "Health", 8: "Hobbies and leisure", 9: "Jobs and education",
  10: "Law and government", 11: "Other", 13: "Pets and animals", 14: "Politics", 15: "Science",
  16: "Shopping", 17: "Sports", 18: "Technology", 19: "Travel and transportation", 20: "Climate",
};
const LOCALE = { GB: "en-GB", US: "en-US", AU: "en-AU", NZ: "en-NZ", IE: "en-IE" };

const band = (n) => {
  if (!n) return null;
  const fmt = (v, unit) => `${Number(v.toFixed(v < 10 ? 1 : 0))}${unit}+`;
  return n >= 1e6 ? fmt(n / 1e6, "M") : n >= 1e3 ? fmt(n / 1e3, "K") : `${n}+`;
};

/**
 * The top ten, with publishers. The RSS feed ignores every filter and always
 * returns Google's ten biggest national trends, which on 1-2 October 2026 were
 * 30 of 30 football, celebrity and politics. Kept because it is the one place
 * Google hands over the reporting beside each trend.
 */
async function fetchTrendsRss(market) {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(market)}`, {
    headers: UA,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google Trends RSS ${market} returned ${res.status}`);
  const xml = await res.text();
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) || [])
    .map((it) => ({
      term: tag(it, "title"),
      traffic: tag(it, "ht:approx_traffic") || null,
      pictureUrl: tag(it, "ht:picture") || null,
      news: (it.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) || [])
        .map((n) => ({ title: tag(n, "ht:news_item_title"), url: tag(n, "ht:news_item_url"), source: tag(n, "ht:news_item_source") }))
        .filter((n) => n.url),
    }))
    .filter((t) => t.term);
}

/**
 * Everything trending in the last 24 hours: the list the Trending now page
 * itself renders, about 190 terms for GB against the RSS feed's ten, with
 * Google's own volume, growth, category and related searches.
 *
 * This is Google's internal page endpoint, not a published API, so it can
 * change without notice. When it fails the RSS ten still arrive, so the tab
 * degrades to what it was rather than going blank.
 */
async function fetchTrendsFull(market) {
  const args = JSON.stringify([null, null, market, 0, LOCALE[market] || "en-GB", 24, 1]);
  const res = await fetch("https://trends.google.com/_/TrendsUi/data/batchexecute", {
    method: "POST",
    headers: { ...UA, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ "f.req": JSON.stringify([[["i0OFE", args, null, "generic"]]]) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Google Trends ${market} returned ${res.status}`);
  const text = (await res.text()).replace(/^\)\]\}'\s*/, "");
  const envelope = JSON.parse(text.slice(0, text.lastIndexOf("]") + 1));
  const payload = envelope.find((e) => e?.[0] === "wrb.fr" && e?.[1] === "i0OFE")?.[2];
  const list = JSON.parse(payload || "null")?.[1];
  if (!Array.isArray(list)) throw new Error(`Google Trends ${market}: unexpected response shape`);
  return list
    .filter((t) => typeof t?.[0] === "string")
    .map((t) => ({
      term: t[0],
      trafficNum: Number(t[6]) || null,
      traffic: band(Number(t[6])),
      growth: Number(t[8]) || null,
      startedAt: t[3]?.[0] ? new Date(t[3][0] * 1000) : null,
      // Null while the trend is still running; a time once Google calls it over.
      endedAt: t[4]?.[0] ? new Date(t[4][0] * 1000) : null,
      related: Array.isArray(t[9]) ? t[9].filter((q) => typeof q === "string" && q !== t[0]).slice(0, 6) : [],
      category: (t[10] || []).map((c) => CATEGORY[c]).filter(Boolean).join(", ") || null,
      pictureUrl: null,
      news: [],
    }));
}

/** Full list where Google allows it, with the RSS feed's publishers merged in. */
export async function fetchTrends(market) {
  const [full, rss] = await Promise.allSettled([fetchTrendsFull(market), fetchTrendsRss(market)]);
  const top = rss.status === "fulfilled" ? rss.value : [];
  if (full.status !== "fulfilled") {
    if (!top.length) throw full.reason;
    return top.map((t) => ({ ...t, trafficNum: trafficFloor(t.traffic), related: [], category: null, startedAt: null, endedAt: null }));
  }
  const byTerm = new Map(top.map((t) => [t.term.toLowerCase(), t]));
  return full.value.map((t) => {
    const r = byTerm.get(t.term.toLowerCase());
    return r ? { ...t, news: r.news, pictureUrl: r.pictureUrl } : t;
  });
}

/**
 * Publishers' reporting for a trend Google listed none for.
 *
 * Bing News, because a Google News result is a JavaScript shell with no
 * publisher URL in it (see researcher.js, 18 August), and a Bing RSS link
 * carries the real one in its url parameter.
 */
export async function findReporting(term, market = "GB") {
  try {
    const res = await fetch(
      `https://www.bing.com/news/search?q=${encodeURIComponent(term)}&format=rss&cc=${market}&setlang=${LOCALE[market] || "en-GB"}`,
      { headers: UA, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return (xml.match(/<item>[\s\S]*?<\/item>/gi) || [])
      .map((it) => {
        const link = tag(it, "link");
        let url = link;
        try {
          url = new URL(link).searchParams.get("url") || link;
        } catch {
          // A malformed link keeps its raw value and is filtered below.
        }
        return { title: tag(it, "title"), url, source: tag(it, "News:Source") || hostOf(url) };
      })
      .filter((n) => n.url && /^https?:/.test(n.url) && !/bing\.com|msn\.com/.test(hostOf(n.url)))
      .slice(0, 5);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------- classifier */

function titleCard(site) {
  const sections = sectionNames(site);
  return `- slug: ${site.slug}
  name: ${site.name}${site.strapline ? ` (${site.strapline})` : ""}
  readers: ${site.audience || "not stated"}
  sections: ${sections.length ? sections.join(", ") : "none listed"}`;
}

// One model call per this many trends. The full list is ~190 a market, and one
// call for all of them overruns the output budget; forty keeps each answer
// well inside it, and the batches run side by side.
const CLASSIFY_BATCH = 40;

/**
 * Match each trend to the title whose readers would genuinely care, or none.
 *
 * Haiku, because only new terms are ever classified and most of the feed is
 * football: the expensive judgement is the Director's and the gate's later,
 * on the handful that get commissioned.
 */
export async function classify(trends, sites, market, { feed = "google" } = {}) {
  if (!trends.length || !sites.length || !process.env.ANTHROPIC_API_KEY) return [];
  const batches = [];
  for (let at = 0; at < trends.length; at += CLASSIFY_BATCH) batches.push(at);
  const results = await Promise.all(
    batches.map((at) =>
      classifyBatch(trends.slice(at, at + CLASSIFY_BATCH), sites, market, feed)
        .then((rows) => rows.map((r) => ({ ...r, i: Number(r?.i) + at })))
        .catch(() => [])
    )
  );
  return results.flat();
}

async function classifyBatch(trends, sites, market, feed) {
  const client = new Anthropic();
  // The news lane hands over stories several trade outlets ran today, not
  // searches, so the desk is told which it is looking at.
  const news = feed === "news";
  const list = trends
    .map((t, i) => {
      const size = news ? t.traffic : `${t.traffic || "?"} searches${t.category ? `, ${t.category}` : ""}`;
      const lines = [`${i}. "${t.term}" (${size})`];
      if (t.related?.length) lines.push(`   also searched: ${t.related.slice(0, 5).join("; ")}`);
      for (const n of (t.news || []).slice(0, 3)) lines.push(`   - ${n.title} [${n.source}]`);
      return lines.join("\n");
    })
    .join("\n");

  const res = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 8000,
    // The same trend must land on the same title on every refresh.
    temperature: 0,
    system: `You are the news desk for a group of UK trade magazines. ${
      news
        ? "You see stories that several outlets have reported in the last day and a half, gathered from each trade's own news wire,"
        : `You see what people are searching for right now on Google (${market})`
    } and decide which magazine, if any, should cover each one.

THE MAGAZINES:
${sites.map(titleCard).join("\n")}

Match a trend to a magazine when that magazine's readers would want an article on it in their working capacity: a fleet manager on diesel supply, a dentist on an NHS contract change. An incident INSIDE a magazine's industry counts too, because its readers run that industry: an aircraft emergency for an airport title, a farm prosecution or animal disease outbreak for a farming title, a care home scandal for a care title.

A GENERAL SMALL-BUSINESS magazine is the widest net of all. It takes any trend with a business story inside it: a named company in the news, a shop, restaurant or chain closing or opening, a takeover or collapse, a founder or brand on Dragons' Den, The Apprentice or similar, a product launch owners will buy, a tax, wage, energy, interest-rate or benefit change, a tool or AI product people use at work, a strike or outage that stops trade. If a working business owner would click it, it is theirs.

Sport, celebrity gossip, TV drama, weather and general politics match nothing unless there is a real business angle for those readers. Motorsport and its drivers are sport, even to a fleet or vehicles magazine. A bare place or person name ("bedford", "lance stroll") is whatever its headlines and "also searched" say it is; an accident, crime or sports result there is nobody's business story, and with nothing to go on it matches nothing. Most trends match nothing, and that is the correct answer for them.

JUDGE THE STORY, NOT THE SEARCH WORDS. Where headlines are listed, they say what the trend is actually about, and they overrule the term: "david parkes animal welfare conviction" sounds like farming, but the headlines were a social worker who neglected 84 pet dogs at home, which is no magazine's story. A private individual's court case is only a match when it happened inside that magazine's industry, to a business in it.

When a trend matters to several magazines, give it to the one whose CORE subject it is: diesel supply is a fleet story first, even though farmers buy diesel too. Never stretch across industries: a rail crash is not an airport story, and a hospital story is not a care home story unless care homes are named.

For each trend reply with:
- i: its number
- slug: the magazine's slug, or null
- relevance: 0-100, how strongly that magazine's readers would want it (0 when slug is null)
- angle: for a match, a headline for THAT magazine, 70 characters or fewer, opening with the exact search term or its key name so it matches what people typed
- keywords: for a match, 3-5 search phrases, the trend's own term first; prefer phrases from "also searched" when they fit
- section: for a match, one of that magazine's sections, exactly as written, or null
- why: one short sentence on why its readers care, or why nobody does

Reply with ONLY a JSON array, no prose.`,
    messages: [{ role: "user", content: untrustedBlock(list, news ? "STORIES RUNNING ON THE TRADE WIRE" : "TRENDING SEARCHES, from Google Trends") }],
  });

  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return [];
  try {
    const rows = JSON.parse(json);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function liveSites() {
  return prisma.site.findMany({
    where: { status: { in: ["live", "cold_start"] } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Pull every market's trends, store anything new, and match it.
 *
 * A term already stored inside the window only has its volume and lastSeenAt
 * updated: it was classified when it arrived, and the verdict does not change
 * because Google is still listing it. lastSeenAt is the moment Google called
 * the trend over when it has, so "Trending now" on the tab means exactly that.
 *
 * Bulk reads and a single bulk insert: ~190 terms a market makes a lookup per
 * term far too slow for one refresh.
 */
async function refreshGoogleTrends(sites) {
  const markets = [...new Set(sites.flatMap((s) => (s.markets?.length ? s.markets : ["GB"])).map((m) => m.toUpperCase()))].filter((m) =>
    TREND_MARKETS.includes(m)
  );
  const since = new Date(Date.now() - WINDOW_HOURS * 36e5);
  const out = { fetched: 0, fresh: 0, matched: 0, errors: [] };

  await Promise.all(
    markets.map(async (market) => {
      let trends;
      try {
        trends = await fetchTrends(market);
      } catch (e) {
        out.errors.push(e.message);
        return;
      }
      out.fetched += trends.length;

      const stored = await prisma.trendingTopic.findMany({
        where: { source: "google_trends", market, lastSeenAt: { gte: since } },
        select: { id: true, term: true, trafficNum: true, news: true },
      });
      const known = new Map(stored.map((r) => [r.term.toLowerCase(), r]));

      const fresh = [];
      const updates = [];
      for (const t of trends) {
        const row = known.get(t.term.toLowerCase());
        if (!row) {
          fresh.push(t);
          continue;
        }
        const data = { lastSeenAt: t.endedAt || new Date() };
        if (t.trafficNum && t.trafficNum !== row.trafficNum) Object.assign(data, { trafficNum: t.trafficNum, traffic: t.traffic });
        if (t.news?.length && (!row.news || row.news === "[]")) data.news = JSON.stringify(t.news.slice(0, 5));
        updates.push(prisma.trendingTopic.update({ where: { id: row.id }, data }));
      }
      if (updates.length) await prisma.$transaction(updates);
      if (!fresh.length) return;

      const inMarket = sites.filter((s) => (s.markets?.length ? s.markets : ["GB"]).map((m) => m.toUpperCase()).includes(market));
      let verdicts = [];
      try {
        verdicts = await classify(fresh, inMarket, market);
      } catch (e) {
        // Stored unmatched rather than dropped: a classifier outage should cost
        // one refresh's matching, not the record that the trend happened.
        out.errors.push(`classify ${market}: ${e.message}`);
      }

      const rows = await Promise.all(
        fresh.map(async (t, i) => {
          const v = verdicts.find((r) => r.i === i) || {};
          // Under the floor is a stretch the model talked itself into; it stays
          // in "everything trending", where it can still be commissioned by hand.
          const site = v.slug && Number(v.relevance) >= MIN_RELEVANCE ? inMarket.find((s) => s.slug === v.slug) : null;
          const sections = site ? sectionNames(site) : [];
          // Only a matched trend is worth a news search: it is the only kind
          // anyone will commission, and the button needs something to write from.
          const news = t.news?.length ? t.news : site ? await findReporting(t.term, market) : [];
          return {
            source: "google_trends",
            market,
            term: t.term.slice(0, 200),
            traffic: t.traffic,
            trafficNum: t.trafficNum,
            news: JSON.stringify(news.slice(0, 5)),
            pictureUrl: t.pictureUrl,
            siteId: site?.id ?? null,
            relevance: site ? Math.max(0, Math.min(100, Number(v.relevance) || 0)) : 0,
            angle: site ? String(v.angle || "").slice(0, 160) || null : null,
            keywords: site && Array.isArray(v.keywords) ? v.keywords.slice(0, 5).join(", ") : null,
            section: site && sections.includes(v.section) ? v.section : null,
            why: v.why ? String(v.why).slice(0, 300) : t.category ? `Google category: ${t.category}` : null,
            status: site ? "new" : "irrelevant",
            firstSeenAt: t.startedAt || new Date(),
            lastSeenAt: t.endedAt || new Date(),
          };
        })
      );
      await prisma.trendingTopic.createMany({ data: rows });
      out.fresh += rows.length;
      out.matched += rows.filter((r) => r.siteId).length;
    })
  );
  return out;
}

/* ------------------------------------------------------------ news clusters */

// A story inside a trade, found by its own wire rather than by national search
// volume (see lib/news-clusters.js for why). Read over the last day and a half,
// which covers a story's first wave without carrying yesterday's into today.
const CLUSTER_HOURS = 36;
// Three different outlets in that window. On 12-19 Oct 2026 this gave every
// title some candidates (Dental 7, Nursery 5, Barbering 1) without letting one
// publisher's syndication across its local papers pass as three.
const CLUSTER_MIN_OUTLETS = 3;

const isGoogleNewsLink = (u) => /(^|\.)news\.google\.com$/.test(hostOf(u));

/**
 * Stories several outlets ran on one title's wire, stored as trends for that
 * title. A story already stored inside the window is updated, not re-matched,
 * so a cluster growing through the day costs no further model calls.
 */
async function refreshNewsClusters(sites) {
  const { clusterItems, splitHeadline, sameHeadline } = await import("./news-clusters");
  const since = new Date(Date.now() - WINDOW_HOURS * 36e5);
  const from = new Date(Date.now() - CLUSTER_HOURS * 36e5);
  const out = { clusters: 0, clusterMatched: 0, errors: [] };

  for (const site of sites) {
    try {
      const items = await prisma.feedItem.findMany({
        where: { siteId: site.id, publishedAt: { gte: from } },
        select: { title: true, link: true, publishedAt: true, status: true, brand: { select: { name: true } } },
      });
      const stories = clusterItems(items, { minOutlets: CLUSTER_MIN_OUTLETS });
      if (!stories.length) continue;

      const stored = await prisma.trendingTopic.findMany({
        where: { source: "news_cluster", siteId: site.id, lastSeenAt: { gte: since } },
        select: { id: true, term: true },
      });
      // Stories already stored for this title, matched on headline rather than
      // exact text: the first headline of a cluster can change as items arrive.
      const fresh = [];
      for (const s of stories) {
        const row = stored.find((r) => sameHeadline(r.term, s.head));
        if (row) {
          await prisma.trendingTopic.update({
            where: { id: row.id },
            data: { lastSeenAt: s.lastAt, trafficNum: s.outlets.length, traffic: `${s.outlets.length} outlets` },
          });
        } else if (!s.items.some((i) => i.status === "drafted")) {
          // Skipped when the wire item has already been written up: the
          // Director got there first, and a second piece would compete with it.
          fresh.push(s);
        }
      }
      if (!fresh.length) continue;

      const asTrends = fresh.map((s) => ({
        term: s.head,
        traffic: `${s.outlets.length} outlets`,
        news: s.items.slice(0, 5).map((i) => ({ title: splitHeadline(i.title).head, source: i.outlet })),
      }));
      const verdicts = await classify(asTrends, [site], "GB", { feed: "news" });

      const rows = await Promise.all(
        fresh.map(async (s, i) => {
          const v = verdicts.find((r) => r.i === i) || {};
          const matched = v.slug === site.slug && Number(v.relevance) >= MIN_RELEVANCE;
          // The draft is written from these links, and a Google News link is a
          // JavaScript shell with no article in it. Publisher links from the
          // cluster first, then Bing's reporting for a matched story.
          let news = s.items
            .filter((it) => !isGoogleNewsLink(it.link))
            .map((it) => ({ title: splitHeadline(it.title).head, url: it.link, source: it.outlet }));
          if (matched && news.length < 2) news = [...news, ...(await findReporting(s.head, "GB"))];
          const sections = sectionNames(site);
          return {
            source: "news_cluster",
            market: "GB",
            term: s.head.slice(0, 200),
            traffic: `${s.outlets.length} outlets`,
            trafficNum: s.outlets.length,
            news: JSON.stringify(news.slice(0, 5)),
            siteId: matched ? site.id : null,
            relevance: matched ? Math.max(0, Math.min(100, Number(v.relevance) || 0)) : 0,
            angle: matched ? String(v.angle || "").slice(0, 160) || null : null,
            keywords: matched && Array.isArray(v.keywords) ? v.keywords.slice(0, 5).join(", ") : null,
            section: matched && sections.includes(v.section) ? v.section : null,
            why: v.why ? String(v.why).slice(0, 300) : `Reported by ${s.outlets.slice(0, 4).join(", ")}`,
            status: matched ? "new" : "irrelevant",
            firstSeenAt: s.firstAt,
            lastSeenAt: s.lastAt,
          };
        })
      );
      await prisma.trendingTopic.createMany({ data: rows });
      out.clusters += rows.length;
      out.clusterMatched += rows.filter((r) => r.siteId).length;
    } catch (e) {
      out.errors.push(`news ${site.slug}: ${e.message}`);
    }
  }
  return out;
}

/** Every live title's markets and wires. Safe to call as often as the cron likes. */
export async function refreshTrending() {
  const sites = await liveSites();
  const [trends, clusters] = await Promise.all([
    refreshGoogleTrends(sites),
    refreshNewsClusters(sites).catch((e) => ({ clusters: 0, clusterMatched: 0, errors: [`news: ${e.message}`] })),
  ]);
  const out = { ...trends, clusters: clusters.clusters, clusterMatched: clusters.clusterMatched, errors: [...trends.errors, ...clusters.errors] };
  // Then the strongest fresh matches commission themselves, when switched on.
  const auto = await autoCommission().catch((e) => ({ auto: 0, error: e.message }));
  return { ...out, autoCommissioned: auto.auto, autoPicked: auto.picked || [] };
}

/* ------------------------------------------------------------- commission */

function briefFor(topic, site) {
  const news = parseNews(topic);
  const cluster = topic.source === "news_cluster";
  const lead =
    topic.source === "search_console"
      ? `People are suddenly searching "${topic.term}" and landing on ${site.name}: ${topic.why} Write the follow-up that answers that search better than anything else on page one, building on our existing article (the source below) and anything genuinely new.`
      : cluster
        ? `${topic.traffic || "Several outlets"} have run this story in the last day and a half, so ${site.name}'s trade is talking about it now: "${topic.term}". ${topic.why || ""} Write the article ${site.name}'s readers need on it TODAY: what has happened, why it matters to them, what to do about it. Add what a trade reader needs that the general coverage left out.`
        : `"${topic.term}" is trending on Google ${topic.market} right now (${topic.traffic || "rising"} searches). ${topic.why || ""} Write the article ${site.name}'s readers need on it TODAY: what has happened, why it matters to them, what to do about it.`;
  // A cluster's term is a headline, not a search, so only its keywords are
  // asked for verbatim.
  const keywordLine = !topic.keywords
    ? null
    : cluster
      ? `Work the first of these search phrases into the headline and first paragraph, and the rest where they fit: ${topic.keywords}.`
      : `The headline and first paragraph must carry the exact search term "${topic.term}" so the piece matches what people are typing. Target keywords: ${topic.keywords}.`;
  return [
    `TRENDING TOPIC, commissioned to publish fast.`,
    lead,
    keywordLine,
    news.length ? `Reporting on it so far (attribute anything you use; link the source you rely on most):\n${news.map((n) => `- ${n.title} (${n.source}) ${n.url}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Turn a trend into an article at the front of that title's queue.
 *
 * Created straight into "drafting" rather than as a proposed topic: the
 * Director's shelf guard exists to stop speculative work, and a spike is the
 * least speculative thing the system ever sees. The Editor, the Designer and
 * the scheduler each take trending work first (see trendingArticleIds).
 */
export async function commissionTrend(topicId, siteSlug) {
  const topic = await prisma.trendingTopic.findUnique({ where: { id: topicId } });
  if (!topic) return { ok: false, error: "That trend no longer exists." };
  if (topic.status === "commissioned") return { ok: false, error: "Already commissioned." };

  const site = await prisma.site.findUnique({ where: { slug: siteSlug } });
  if (!site) return { ok: false, error: "Pick a title to commission it for." };

  // Matched before its reporting existed, or never matched at all: look again
  // now, because a trend is usually written up within the hour. A Search
  // Console spike carries only our own page, and a follow-up written from
  // nothing but what we already said has nothing new in it, so it gets the
  // news too, kept behind our page.
  const have = parseNews(topic);
  if (!have.length || topic.source === "search_console") {
    const found = await findReporting(topic.term, topic.market);
    if (found.length) {
      topic.news = JSON.stringify([...have, ...found].slice(0, 5));
      await prisma.trendingTopic.update({ where: { id: topic.id }, data: { news: topic.news } });
    }
  }
  const source = primarySource(topic);
  if (!source) return { ok: false, error: "Google listed no reporting for this one, so there is nothing to write it from yet." };

  // Matched to a different title than the one chosen: the classifier's angle
  // and section were written for the other title's readers, so don't carry them.
  const sameTitle = topic.siteId === site.id;
  const title = (sameTitle && topic.angle) || topic.term;

  const { alreadyCovered } = await import("./agents/dedupe");
  const clash = await alreadyCovered(site, title);
  if (clash) return { ok: false, error: `${site.name} already has "${clash.title}" (${clash.status}).` };

  const db = forSite(site.id);
  const article = await db.article.create({
    data: {
      title: title.slice(0, 300),
      type: "pr_rewrite",
      status: "drafting",
      sourceUrl: source.url,
      keywords: sameTitle ? topic.keywords || topic.term : topic.term,
      category: sameTitle ? topic.section : null,
      brief: briefFor(topic, site),
    },
  });

  await prisma.trendingTopic.update({
    where: { id: topic.id },
    data: { status: "commissioned", articleId: article.id, siteId: site.id, commissionedAt: new Date() },
  });

  // Claimed so the Researcher stops proposing it and no sibling title chases
  // the same results page. A refusal is informational only: on a news spike
  // being there matters more than the registry.
  try {
    const { claimTerm } = await import("./keyword-registry");
    // A news cluster's term is a headline; the search it should own is its
    // first keyword.
    const claim = topic.source === "news_cluster" ? topic.keywords?.split(",")[0]?.trim() || null : topic.term;
    if (claim) await claimTerm(site, claim, { articleId: article.id, source: "trending" });
  } catch {
    // The article is commissioned either way.
  }

  return { ok: true, articleId: article.id, siteSlug: site.slug, siteName: site.name };
}

// The most automatic spend one trending article may take, in USD: 40p at
// about $1.33 to the pound. JB's ceiling, 6 Oct 2026. Measured over the first
// 21: one that passes first time costs 12-18p, one held and repaired 30-55p,
// and three that went round the loop five times cost over £1 each. Past the
// ceiling the engine stops and the piece waits for a person, so the cost of
// any piece is known before it is spent.
export const TREND_COST_CAP_USD = 0.53;
// Roughly what one more writing pass costs (a repair is $0.13-0.27). The engine
// will not start a pass that would likely carry the article over the ceiling.
export const TREND_PASS_ESTIMATE_USD = 0.2;

/** What the agents have already spent on this article, in USD. */
export async function spentOn(siteId, articleId) {
  try {
    const { forSite } = await import("./prisma");
    const r = await forSite(siteId).agentRun.aggregate({ where: { articleId }, _sum: { costUsd: true } });
    return r._sum.costUsd || 0;
  } catch {
    return 0;
  }
}

/** Article ids on this title that came from a trend, for the queue-jumping rules. */
//
// Both lookups below sit on the Editor's, the Designer's and the scheduler's
// hot path, so neither may ever throw. If the table is missing (code deployed
// ahead of its migration) or the query fails, the answer is "nothing is
// trending" and the engine runs exactly as it did before this feature existed.
export async function trendingArticleIds(siteId) {
  try {
    const rows = await prisma.trendingTopic.findMany({
      where: { siteId, status: "commissioned", articleId: { not: null } },
      select: { articleId: true },
      orderBy: { commissionedAt: "asc" },
      take: 50,
    });
    return rows.map((r) => r.articleId);
  } catch {
    return [];
  }
}

/** The trend an article was commissioned from, if it was. */
export async function trendFor(articleId) {
  if (!articleId) return null;
  try {
    return await prisma.trendingTopic.findFirst({ where: { articleId } });
  } catch {
    return null;
  }
}

/* --------------------------------------------------------- auto-commission */

// The strongest matches commission themselves, so the hours between a spike
// starting and someone opening the tab are not lost. Measured on the first
// week: a GB trend is active for a median of 2.8 hours (13 for one with 5K+
// searches), and the first 18 trending pieces went live a median 17 hours
// after their trend began, after most of them had ended.
//
// Off unless GlobalSetting trending_autocommission is "on" (the toggle on the
// Trending Topics tab). Bounded three ways: only good, sizeable, fresh matches;
// at most three a title a day; and every piece is under the 40p ceiling.
//
// Lowered on 13 Oct 2026 from 80 fit and 5K searches, at which only seven
// trends qualified in a week while 223 matched ones went uncommissioned and the
// median trend-to-commission gap was 8.3 hours.
export const AUTO_KEY = "trending_autocommission";
export const AUTO_MIN_FIT = 70;
export const AUTO_MIN_SEARCHES = 2000;
const AUTO_FRESH_HOURS = 6;
export const AUTO_PER_TITLE_PER_DAY = 3;

// Titles whose matches are never commissioned automatically. They can still be
// commissioned by hand from the tab.
//
// Airport Business since 20 Oct 2026: its eleven trending pieces to that date
// had no Google impressions at all, because Google had stopped picking up new
// Airport posts (its sitemap last fetched 6 Oct, the newest posts "unknown to
// Google"). It also held the most qualifying matches, so it was taking the
// most automatic spend for nothing. Lift once Search Console shows new Airport
// posts being indexed within a day again.
const AUTO_PAUSED = new Set(["airport-business-magazine"]);

/**
 * How specific a trend is, by the words in its term. Single words are left to
 * a person; among the rest, three or more words rank above two.
 *
 * On the first 42 pieces the winners were specific stories a national desk had
 * not written the business angle of: "john healey inheritance tax ai proposal"
 * (73 clicks at position 5), "greg jackson" (12). The bare head terms were
 * the BBC's to win: "amazon" (50K searches, no clicks), "airport", "drought",
 * "billionaire". Ordering by search volume put exactly those first.
 */
export function specificity(term) {
  return String(term || "").trim().split(/\s+/).filter(Boolean).length;
}

export async function autoCommissionOn() {
  try {
    const row = await prisma.globalSetting.findUnique({ where: { key: AUTO_KEY } });
    return String(row?.value || "").trim().toLowerCase() === "on";
  } catch {
    return false;
  }
}

export async function autoCommission() {
  if (!(await autoCommissionOn())) return { auto: 0, off: true };
  const candidates = await prisma.trendingTopic.findMany({
    where: {
      source: "google_trends",
      status: "new",
      siteId: { not: null },
      relevance: { gte: AUTO_MIN_FIT },
      trafficNum: { gte: AUTO_MIN_SEARCHES },
      firstSeenAt: { gte: new Date(Date.now() - AUTO_FRESH_HOURS * 36e5) },
    },
    include: { site: true },
  });

  // Specific before broad, then the better fit, then volume as the tiebreak.
  const ranked = candidates
    .filter((c) => specificity(c.term) >= 2 && !AUTO_PAUSED.has(c.site?.slug))
    .sort(
      (a, b) =>
        Math.min(specificity(b.term), 3) - Math.min(specificity(a.term), 3) ||
        (b.relevance || 0) - (a.relevance || 0) ||
        (b.trafficNum || 0) - (a.trafficNum || 0)
    )
    .slice(0, 20);

  const out = { auto: 0, picked: [] };
  const dayAgo = new Date(Date.now() - 864e5);
  for (const c of ranked) {
    if (!c.site?.engineEnabled) continue;
    const today = await prisma.trendingTopic.count({ where: { siteId: c.siteId, status: "commissioned", commissionedAt: { gte: dayAgo } } });
    if (today >= AUTO_PER_TITLE_PER_DAY) continue;
    const res = await commissionTrend(c.id, c.site.slug).catch(() => null);
    if (res?.ok) {
      out.auto++;
      out.picked.push(`${c.site.name}: ${c.term}`);
    }
  }
  return out;
}

/* ------------------------------------------------- advance to live, now */

// The engine's half-hourly ladder runs one agent per title per tick, so a piece
// commissioned from a trend waited a tick to be written, another to be
// pictured, and fill-schedule then publish-due to go out: a median 1.8 hours
// from commission to live over 6-13 Oct 2026. This walks each commissioned
// piece through those steps straight away, in the trending refresh, the same
// route Push live takes from the browser.
//
// Bounded by the caller's deadline: a draft takes up to two minutes, so a step
// is only started with room to finish it. What does not fit is picked up by the
// next refresh (30 minutes) or the ordinary ladder, whichever comes first.
// Pieces QA held, parked, or at the cost ceiling are left for a person.
const DRAFT_ROOM_MS = 130000;
const PICTURE_ROOM_MS = 45000;

async function articleState(siteId, articleId) {
  return forSite(siteId).article.findUnique({
    where: { id: articleId },
    select: { status: true, qaPassed: true, imageUrl: true, body: true, publishedAt: true },
  });
}

/** Time a finished piece for now and run publish-due, which sends only what is due. */
export async function publishDueNow(siteId, articleId) {
  await forSite(siteId).article.update({ where: { id: articleId }, data: { scheduledFor: new Date() } });
  const { GET } = await import("@/app/api/cron/publish-due/route");
  const headers = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  await GET(new Request("http://internal/api/cron/publish-due", { headers }));
  return (await articleState(siteId, articleId))?.status === "published";
}

/**
 * Queue a LinkedIn post for a trending piece that has just gone live, booked for
 * the next posting run. Only where the title can actually post, and only once.
 */
export async function announceTrend(site, articleId) {
  try {
    const db = forSite(site.id);
    if (await db.linkedInPost.findFirst({ where: { articleId }, select: { id: true } })) return false;
    const { isLinkedInConfigured, authFor } = await import("./linkedin");
    const { bridgeReady } = await import("./social-bridge");
    const ready = isLinkedInConfigured(await authFor(site)) || (await bridgeReady(site, "linkedin"));
    if (!ready) return false;
    const { runLinkedIn } = await import("./agents/linkedin");
    await runLinkedIn(site, "trending_live", { articleId, now: true });
    return true;
  } catch {
    // A failed post must never stop the refresh; the daily queue still runs.
    return false;
  }
}

export async function advanceTrending({ deadline }) {
  const out = { written: 0, pictured: 0, published: 0, announced: 0 };
  const topics = await prisma.trendingTopic.findMany({
    where: { status: "commissioned", articleId: { not: null }, siteId: { not: null } },
    include: { site: true },
    orderBy: { commissionedAt: "asc" },
    take: 40,
  });
  const room = (ms) => Date.now() + ms < deadline;
  const { runEditor, runDesigner } = await import("./agents/team");

  for (const t of topics) {
    let a = await articleState(t.siteId, t.articleId);
    if (!a || a.status === "published" || a.status === "idea") continue;
    // Held by QA: the Editor's own ceiling rules decide whether it is tried
    // again; a person can always use Fix and publish.
    if (a.status !== "drafting" && !a.qaPassed) continue;

    if (a.status === "drafting") {
      if (!room(DRAFT_ROOM_MS)) break;
      await runEditor(t.site, "trending_now", { articleId: t.articleId }).catch(() => null);
      out.written++;
      a = await articleState(t.siteId, t.articleId);
      if (!a?.qaPassed) continue;
    }
    if (!a.imageUrl) {
      if (!room(PICTURE_ROOM_MS)) break;
      await runDesigner(t.site, "trending_now").catch(() => null);
      out.pictured++;
      a = await articleState(t.siteId, t.articleId);
      if (!a?.imageUrl) continue;
    }
    if (a.qaPassed && a.imageUrl && a.status !== "published" && room(20000)) {
      if (await publishDueNow(t.siteId, t.articleId)) out.published++;
    }
  }

  // Everything that went live in the last day and has no post yet, however it
  // got there: this run, Push live, Fix and publish, or the ordinary ladder.
  const dayAgo = new Date(Date.now() - 864e5);
  for (const t of topics) {
    if (!room(30000)) break;
    const a = await articleState(t.siteId, t.articleId);
    if (a?.status !== "published" || !a.publishedAt || a.publishedAt < dayAgo) continue;
    if (await announceTrend(t.site, t.articleId)) out.announced++;
  }
  return out;
}
