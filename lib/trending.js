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
// to nothing. 3x over baseline with 40+ impressions in three days, or a query
// with no history at all that has arrived at 60+.
const SPIKE_RATIO = 3;
const SPIKE_MIN_RECENT = 40;
const NEW_QUERY_MIN = 60;

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

export async function fetchTrends(market) {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(market)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google Trends ${market} returned ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items
    .map((it) => {
      const news = (it.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) || [])
        .map((n) => ({
          title: tag(n, "ht:news_item_title"),
          url: tag(n, "ht:news_item_url"),
          source: tag(n, "ht:news_item_source"),
        }))
        .filter((n) => n.url);
      return {
        term: tag(it, "title"),
        traffic: tag(it, "ht:approx_traffic") || null,
        pictureUrl: tag(it, "ht:picture") || null,
        news,
      };
    })
    .filter((t) => t.term);
}

/* -------------------------------------------------------------- classifier */

function titleCard(site) {
  const sections = sectionNames(site);
  return `- slug: ${site.slug}
  name: ${site.name}${site.strapline ? ` (${site.strapline})` : ""}
  readers: ${site.audience || "not stated"}
  sections: ${sections.length ? sections.join(", ") : "none listed"}`;
}

/**
 * Match each trend to the title whose readers would genuinely care, or none.
 *
 * One call per batch, Haiku, because this runs every half hour on a feed that
 * is mostly football: the expensive judgement is the Director's and the gate's
 * later, on the handful that get commissioned.
 */
export async function classify(trends, sites, market) {
  if (!trends.length || !sites.length || !process.env.ANTHROPIC_API_KEY) return [];
  const client = new Anthropic();
  const list = trends
    .map((t, i) => `${i}. "${t.term}" (${t.traffic || "?"} searches)\n${t.news.slice(0, 3).map((n) => `   - ${n.title} [${n.source}]`).join("\n")}`)
    .join("\n");

  const res = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 4000,
    // The same trend must land on the same title on every refresh.
    temperature: 0,
    system: `You are the news desk for a group of UK trade magazines. You see what people are searching for right now on Google (${market}) and decide which magazine, if any, should cover each one.

THE MAGAZINES:
${sites.map(titleCard).join("\n")}

Match a trend to a magazine ONLY when that magazine's readers would want an article on it in their working capacity: a fleet manager on diesel supply, a dentist on an NHS contract change, an SME owner on a Dragons' Den pitch or a local business closing. An incident INSIDE a magazine's industry counts too, because its readers run that industry: an aircraft emergency or airport disruption for an airport title, a farm prosecution or animal disease outbreak for a farming title, a care home scandal for a care title. Sport, celebrity, TV drama, weather and general politics match nothing unless there is a real business angle for those readers. Most trends match nothing, and that is the correct answer for them.

When a trend matters to several magazines, give it to the one whose CORE subject it is: diesel supply is a fleet story first, even though farmers buy diesel too. Never stretch across industries: a rail crash is not an airport story, and a hospital story is not a care home story unless care homes are named.

For each trend reply with:
- i: its number
- slug: the magazine's slug, or null
- relevance: 0-100, how strongly that magazine's readers would want it (0 when slug is null)
- angle: for a match, a headline for THAT magazine, 70 characters or fewer, opening with the exact search term or its key name so it matches what people typed
- keywords: for a match, 3-5 search phrases, the trend's own term first
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
 * A term already seen in that market inside the window only has lastSeenAt
 * bumped: it was classified when it arrived, and the verdict does not change
 * because Google is still listing it.
 */
async function refreshGoogleTrends(sites) {
  const markets = [...new Set(sites.flatMap((s) => (s.markets?.length ? s.markets : ["GB"])).map((m) => m.toUpperCase()))];
  const since = new Date(Date.now() - WINDOW_HOURS * 36e5);
  const out = { fetched: 0, fresh: 0, matched: 0, errors: [] };

  for (const market of markets) {
    let trends;
    try {
      trends = await fetchTrends(market);
    } catch (e) {
      out.errors.push(e.message);
      continue;
    }
    out.fetched += trends.length;

    const fresh = [];
    for (const t of trends) {
      const seen = await prisma.trendingTopic.findFirst({
        where: { source: "google_trends", market, term: t.term, lastSeenAt: { gte: since } },
        select: { id: true },
      });
      if (seen) {
        await prisma.trendingTopic.update({
          where: { id: seen.id },
          data: { lastSeenAt: new Date(), traffic: t.traffic, trafficNum: trafficFloor(t.traffic) },
        });
      } else {
        fresh.push(t);
      }
    }
    if (!fresh.length) continue;

    const inMarket = sites.filter((s) => (s.markets?.length ? s.markets : ["GB"]).map((m) => m.toUpperCase()).includes(market));
    let verdicts = [];
    try {
      verdicts = await classify(fresh, inMarket, market);
    } catch (e) {
      // Stored unmatched rather than dropped: a classifier outage should cost
      // one refresh's matching, not the record that the trend happened.
      out.errors.push(`classify ${market}: ${e.message}`);
    }

    for (const [i, t] of fresh.entries()) {
      const v = verdicts.find((r) => Number(r?.i) === i) || {};
      // Under the floor is a stretch the model talked itself into; it stays in
      // "everything trending", where it can still be commissioned by hand.
      const site = v.slug && Number(v.relevance) >= MIN_RELEVANCE ? inMarket.find((s) => s.slug === v.slug) : null;
      const sections = site ? sectionNames(site) : [];
      await prisma.trendingTopic.create({
        data: {
          source: "google_trends",
          market,
          term: t.term.slice(0, 200),
          traffic: t.traffic,
          trafficNum: trafficFloor(t.traffic),
          news: JSON.stringify(t.news.slice(0, 5)),
          pictureUrl: t.pictureUrl,
          siteId: site?.id ?? null,
          relevance: site ? Math.max(0, Math.min(100, Number(v.relevance) || 0)) : 0,
          angle: site ? String(v.angle || "").slice(0, 160) || null : null,
          keywords: site && Array.isArray(v.keywords) ? v.keywords.slice(0, 5).join(", ") : null,
          section: site && sections.includes(v.section) ? v.section : null,
          why: v.why ? String(v.why).slice(0, 300) : null,
          status: site ? "new" : "irrelevant",
        },
      });
      out.fresh++;
      if (site) out.matched++;
    }
  }
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

    for (const q of byQuery.values()) {
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
