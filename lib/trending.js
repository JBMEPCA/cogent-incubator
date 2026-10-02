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
// Two lanes:
//   google_trends   - Google's own "Trending now" feed per market. Most of it is
//                     sport and celebrity, so each new term is matched to the
//                     one title whose readers would care, or to none.
//   search_console  - queries already landing on one of our titles whose
//                     impressions have jumped over their own 28-day baseline.
//                     We already rank, so a follow-up is the cheapest win going.

const CLASSIFY_MODEL = "claude-haiku-4-5";

// Paywalled publishers: listed by Google beside a trend but fetching them
// returns a login wall, and a draft written from a login wall is a draft
// written from the headline. Kept as sources for the brief, never chosen as
// the one the article links and is written from when anything else exists.
const PAYWALLED = ["ft.com", "thetimes.com", "thetimes.co.uk", "telegraph.co.uk", "wsj.com", "bloomberg.com", "economist.com", "nytimes.com"];

// A spike has to be big enough to be worth an article, not just big relative
// to nothing: 3x over baseline with 10+ impressions in three days, or a query
// with no history at all that has arrived at 8+.
//
// Set to the titles' real size. These were 40 and 60 and found nothing on the
// first run: Smart SME takes 500-800 impressions a day across EVERY query, and
// its biggest single query over three days was 22. At 10 the same run surfaced
// "servicem8 15" (new, ranking 7.9) and "best email marketing platforms" (20x,
// ranking 11.8), which are exactly the stories this lane exists for.
const SPIKE_RATIO = 3;
const SPIKE_MIN_RECENT = 10;
const NEW_QUERY_MIN = 8;
// The most a title adds per refresh, biggest first, so a noisy day on one title
// cannot bury every other title's cards.
const SPIKES_PER_TITLE = 12;

// Search operators mean a person prospecting, not a reader: the top three
// "spikes" on Smart SME on 2 October were 'accounting "media pack" site:.uk
// -"guest post sites"' and two siblings, somebody's link-building list.
const OPERATOR_QUERY = /\bsite:|\binurl:|\bintitle:|"|(^|\s)-\S/;

// Below this the classifier is reaching. Measured on the first dry run: the
// genuine matches scored 68-75, the stretches (a rail crash for the airport
// title) around 50.
const MIN_RELEVANCE = 55;

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
export async function classify(trends, sites, market) {
  if (!trends.length || !sites.length || !process.env.ANTHROPIC_API_KEY) return [];
  const batches = [];
  for (let at = 0; at < trends.length; at += CLASSIFY_BATCH) batches.push(at);
  const results = await Promise.all(
    batches.map((at) =>
      classifyBatch(trends.slice(at, at + CLASSIFY_BATCH), sites, market)
        .then((rows) => rows.map((r) => ({ ...r, i: Number(r?.i) + at })))
        .catch(() => [])
    )
  );
  return results.flat();
}

async function classifyBatch(trends, sites, market) {
  const client = new Anthropic();
  const list = trends
    .map((t, i) => {
      const lines = [`${i}. "${t.term}" (${t.traffic || "?"} searches${t.category ? `, ${t.category}` : ""})`];
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
    system: `You are the news desk for a group of UK trade magazines. You see what people are searching for right now on Google (${market}) and decide which magazine, if any, should cover each one.

THE MAGAZINES:
${sites.map(titleCard).join("\n")}

Match a trend to a magazine when that magazine's readers would want an article on it in their working capacity: a fleet manager on diesel supply, a dentist on an NHS contract change. An incident INSIDE a magazine's industry counts too, because its readers run that industry: an aircraft emergency for an airport title, a farm prosecution or animal disease outbreak for a farming title, a care home scandal for a care title.

A GENERAL SMALL-BUSINESS magazine is the widest net of all. It takes any trend with a business story inside it: a named company in the news, a shop, restaurant or chain closing or opening, a takeover or collapse, a founder or brand on Dragons' Den, The Apprentice or similar, a product launch owners will buy, a tax, wage, energy, interest-rate or benefit change, a tool or AI product people use at work, a strike or outage that stops trade. If a working business owner would click it, it is theirs.

Sport, celebrity gossip, TV drama, weather and general politics match nothing unless there is a real business angle for those readers. Most trends match nothing, and that is the correct answer for them.

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
    messages: [{ role: "user", content: untrustedBlock(list, "TRENDING SEARCHES, from Google Trends") }],
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
  const markets = [...new Set(sites.flatMap((s) => (s.markets?.length ? s.markets : ["GB"])).map((m) => m.toUpperCase()))];
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

/* --------------------------------------------------------- search console */

const isoDay = (msAgo) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);

async function gscRows(token, property, startDate, endDate, dimensions) {
  const { googlePost } = await import("./google");
  const data = await googlePost(
    token,
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    // "all" includes the fresh, not-yet-final days. Final data lags two to
    // three days, which is the whole life of a news spike.
    { startDate, endDate, dimensions, rowLimit: 1000, dataState: "all" }
  );
  return data.rows || [];
}

/**
 * Queries on one title running well above their own baseline.
 *
 * Recent = the last three days including today's partial data. Baseline = the
 * 28 days before that, as a daily average. The page that ranks is kept as the
 * source: a follow-up is written from what we already said.
 */
async function refreshSearchConsole(sites) {
  const { isGoogleConfigured, getGoogleAccessToken } = await import("./google");
  const { siteCredentials } = await import("./site");
  const out = { spikes: 0, errors: [] };
  if (!isGoogleConfigured()) return out;

  let token;
  try {
    token = await getGoogleAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
  } catch (e) {
    out.errors.push(`gsc auth: ${e.message}`);
    return out;
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 36e5);
  for (const site of sites) {
    const { creds } = await siteCredentials(site.id);
    const property = creds.google_analytics?.gscSiteUrl;
    if (!property) continue;

    let recent, baseline;
    try {
      [recent, baseline] = await Promise.all([
        gscRows(token, property, isoDay(2 * 864e5), isoDay(0), ["query", "page"]),
        gscRows(token, property, isoDay(31 * 864e5), isoDay(3 * 864e5), ["query"]),
      ]);
    } catch (e) {
      out.errors.push(`${site.slug}: ${e.message}`);
      continue;
    }

    const base = new Map(baseline.map((r) => [r.keys[0], r.impressions / 28]));
    // A query can land on several pages; keep the one with most impressions.
    const byQuery = new Map();
    for (const r of recent) {
      const [query, page] = r.keys;
      const cur = byQuery.get(query) || { query, impressions: 0, clicks: 0, page: null, pageImpr: -1, position: r.position };
      cur.impressions += r.impressions;
      cur.clicks += r.clicks;
      if (r.impressions > cur.pageImpr) {
        cur.page = page;
        cur.pageImpr = r.impressions;
        cur.position = r.position;
      }
      byQuery.set(query, cur);
    }

    const candidates = [...byQuery.values()]
      .filter((q) => !OPERATOR_QUERY.test(q.query))
      .sort((a, b) => b.impressions - a.impressions);
    let added = 0;
    for (const q of candidates) {
      if (added >= SPIKES_PER_TITLE) break;
      const perDay = q.impressions / 3;
      const was = base.get(q.query) || 0;
      const ratio = was > 0 ? perDay / was : null;
      const spiking = was > 0 ? ratio >= SPIKE_RATIO && q.impressions >= SPIKE_MIN_RECENT : q.impressions >= NEW_QUERY_MIN;
      if (!spiking) continue;

      const existing = await prisma.trendingTopic.findFirst({
        where: { source: "search_console", siteId: site.id, term: q.query, lastSeenAt: { gte: since } },
        select: { id: true },
      });
      const data = {
        traffic: `${q.impressions.toLocaleString("en-GB")} impr. / 3 days`,
        trafficNum: q.impressions,
        spike: ratio == null ? null : Math.round(ratio * 10) / 10,
        position: Math.round(q.position * 10) / 10,
        lastSeenAt: new Date(),
      };
      if (existing) {
        await prisma.trendingTopic.update({ where: { id: existing.id }, data });
        continue;
      }
      await prisma.trendingTopic.create({
        data: {
          ...data,
          source: "search_console",
          market: (site.markets?.[0] || "GB").toUpperCase(),
          term: q.query.slice(0, 200),
          siteId: site.id,
          news: JSON.stringify([{ title: "Our article already ranking for this", url: q.page, source: site.name }]),
          // No classifier here: the query already lands on this title, which is
          // a stronger relevance signal than any model's opinion of it.
          relevance: Math.min(100, Math.round(50 + (ratio ? Math.min(ratio, 10) * 5 : 50))),
          keywords: q.query,
          why:
            ratio == null
              ? `New query: ${q.impressions} impressions in three days with no history, ranking at ${data.position}.`
              : `Running at ${data.spike}x its 28-day average, ranking at ${data.position}.`,
          status: "new",
        },
      });
      out.spikes++;
      added++;
    }
  }
  return out;
}

/** Both lanes, every live title. Safe to call as often as the cron likes. */
export async function refreshTrending() {
  const sites = await liveSites();
  const [trends, gsc] = await Promise.all([refreshGoogleTrends(sites), refreshSearchConsole(sites)]);
  return { ...trends, spikes: gsc.spikes, errors: [...trends.errors, ...gsc.errors] };
}

/* ------------------------------------------------------------- commission */

function briefFor(topic, site) {
  const news = parseNews(topic);
  const lead =
    topic.source === "search_console"
      ? `People are suddenly searching "${topic.term}" and landing on ${site.name}: ${topic.why} Write the follow-up that answers that search better than anything else on page one, building on our existing article (the source below) and anything genuinely new.`
      : `"${topic.term}" is trending on Google ${topic.market} right now (${topic.traffic || "rising"} searches). ${topic.why || ""} Write the article ${site.name}'s readers need on it TODAY: what has happened, why it matters to them, what to do about it.`;
  return [
    `TRENDING TOPIC, commissioned to publish fast.`,
    lead,
    topic.keywords ? `The headline and first paragraph must carry the exact search term "${topic.term}" so the piece matches what people are typing. Target keywords: ${topic.keywords}.` : null,
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
    await claimTerm(site, topic.term, { articleId: article.id, source: "trending" });
  } catch {
    // The article is commissioned either way.
  }

  return { ok: true, articleId: article.id, siteSlug: site.slug, siteName: site.name };
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
