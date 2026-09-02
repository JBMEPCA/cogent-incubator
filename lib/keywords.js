// Keyword demand, from Bing Webmaster Tools.
//
// The gap this fills: Search Console can only ever show queries we ALREADY get
// impressions for, so it is blind to exactly the terms a young title most needs
// — the ones the audience searches and we are invisible for. lib/agents/researcher.js
// works from GSC near-misses (position 7.5-30) plus autocomplete phrasing, and
// neither answers "what should we be competing for that we are not".
//
// Google sells that data and does not give it away. Keyword Planner is free but
// buckets volumes into ranges without ad spend, and the Ads API needs a
// developer token and a review round. Bing Webmaster Tools gives real integer
// impression counts, free, no spend, behind a key you self-issue from the
// dashboard. Bing is a few percent of search, so the ABSOLUTE numbers are small
// and must never be quoted as search volume; the ORDERING of terms is what this
// is for, and that tracks Google closely enough to commission from.
//
// One key covers every site: Bing issues API keys per USER, not per property
// (learn.microsoft.com/en-us/bingwebmaster/getting-access). So this is an env
// var and not a SiteCredential row, unlike wordpress or google_analytics. Each
// title still has to be added and verified in Bing Webmaster Tools before its
// data is reachable.

const BASE = "https://ssl.bing.com/webmaster/api.svc/json";

// Bing's own impressions, scaled to a Google-order estimate. Bing sits at
// roughly 4% of UK search, so a term with 25 Bing impressions is plausibly
// ~600 on Google. This is a sighting shot and nothing more: it exists so the
// dashboard can show a number an editor recognises instead of a Bing count
// that reads as "nobody searches this". Never present a scaled figure as
// measured volume, and never rank on it — ranking on scaled numbers is
// identical to ranking on raw ones, because it is one multiplier.
const GOOGLE_SCALE = Number(process.env.BING_GOOGLE_SCALE || 25);

export function isBingConfigured() {
  return Boolean(process.env.BING_WEBMASTER_API_KEY);
}

// Market code to the (country, language) pair Bing wants: a lowercase ISO 3166
// country and an IETF language tag. Site.markets is already ISO country codes
// in priority order, which is what the autocomplete lane keys off, so the
// global titles (Golf Resort and Airport Business, both ["US","GB"]) get their
// demand measured in the market that matters first rather than UK-locked.
//
// Hardcoded rather than derived: there is no correct language for a country in
// general, only a correct one for OUR audience, and a wrong guess here silently
// returns a plausible-looking empty set.
const LOCALES = {
  GB: { country: "gb", language: "en-GB" },
  US: { country: "us", language: "en-US" },
  IE: { country: "ie", language: "en-IE" },
  AU: { country: "au", language: "en-AU" },
  CA: { country: "ca", language: "en-CA" },
  NZ: { country: "nz", language: "en-NZ" },
  ZA: { country: "za", language: "en-ZA" },
  AE: { country: "ae", language: "en-AE" },
};

export function localeFor(market) {
  return LOCALES[String(market || "").toUpperCase()] || LOCALES.GB;
}

export function primaryLocale(site) {
  return localeFor(site?.markets?.[0] || "GB");
}

// WCF serialises dates into query strings as ISO 8601. The keyword endpoints
// are the least exercised corner of this API and the docs give no worked
// example for the date pair, so if a live call ever returns an empty array for
// a term the dashboard clearly has data for, the date format is the first thing
// to suspect: the fallback is the "/Date(ms)/" form the RESPONSES use.
function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Undocumented rate limits. Microsoft publishes quotas for URL submission and
// nothing at all for the keyword endpoints, so this assumes throttling exists,
// backs off when it appears, and gives up quietly rather than taking an agent
// run down with it. A keyword sweep that returns half its seeds is still a
// useful sweep; one that throws loses the whole run.
async function bingGet(method, params, { retries = 3 } = {}) {
  const qs = new URLSearchParams({
    ...params,
    apikey: process.env.BING_WEBMASTER_API_KEY,
  });
  const url = `${BASE}/${method}?${qs}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (res.ok) {
      const body = await res.json();
      // Every WCF JSON response wraps its payload in "d".
      return body?.d ?? [];
    }

    // 429 and 5xx are worth another go; a 401 is a bad key and will never fix
    // itself, so fail loudly on it rather than burning three retries.
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Bing Webmaster API rejected the key (${res.status}). Check BING_WEBMASTER_API_KEY.`);
    }
    if (attempt === retries || (res.status < 500 && res.status !== 429)) {
      throw new Error(`Bing Webmaster API ${method} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    await sleep(1000 * 2 ** attempt);
  }
  return [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Expand one seed into related search terms WITH demand attached.
 *
 * This is the whole reason Bing is worth wiring up: GetRelatedKeywords returns
 * Query + Impressions in a single call, so a seed goes in and a ranked demand
 * list comes out. Doing the same job through GetKeywordStats would be one HTTP
 * call per term against an undocumented rate limit.
 *
 * Impressions is strict match, BroadImpressions is broad. Strict is the honest
 * demand figure for the exact phrase and is what we rank on; broad is kept
 * because a term with a huge broad-to-strict gap is usually a topic worth a
 * pillar page rather than a single article.
 */
export async function relatedKeywords(seed, { country, language, days = 30 } = {}) {
  if (!isBingConfigured() || !seed) return [];
  const end = new Date();
  const start = new Date(Date.now() - days * 864e5);

  const rows = await bingGet("GetRelatedKeywords", {
    q: seed,
    country,
    language,
    startDate: isoDay(start),
    endDate: isoDay(end),
  });

  return rows
    .map((r) => ({
      query: String(r.Query || "").trim().toLowerCase(),
      impressions: Number(r.Impressions || 0),
      broadImpressions: Number(r.BroadImpressions || 0),
      estGoogle: Math.round(Number(r.Impressions || 0) * GOOGLE_SCALE),
      country,
      language,
    }))
    .filter((r) => r.query);
}

/**
 * The weekly impression series for one term, oldest first.
 *
 * GetKeywordStats is already weekly, which is the cadence the fleet wanted, and
 * it is the only free source that will say whether a term is RISING rather than
 * merely large. Reserve it for the shortlist: it costs one call per term, so
 * running it across a whole discovery sweep is how the rate limit gets found
 * the hard way.
 */
export async function keywordHistory(term, { country, language } = {}) {
  if (!isBingConfigured() || !term) return [];
  const rows = await bingGet("GetKeywordStats", { q: term, country, language });

  return rows
    .map((r) => ({
      // "/Date(1316645995221-0700)/" — the offset suffix is optional and the
      // leading digits are already epoch ms, so parsing the integer out is
      // both sufficient and immune to the offset being absent.
      week: new Date(Number(String(r.Date || "").match(/-?\d+/)?.[0] || 0)),
      impressions: Number(r.Impressions || 0),
      broadImpressions: Number(r.BroadImpressions || 0),
    }))
    .filter((r) => r.week.getTime() > 0)
    .sort((a, b) => a.week - b.week);
}

/**
 * Rising-ness of a term: recent weeks against the ones before them.
 *
 * Returns a multiplier, so 1.4 means the last month ran 40% above the previous
 * quarter. Seasonal titles are the reason this exists rather than a raw
 * week-on-week delta: golf resort demand climbs every spring and a single
 * week's jump says nothing, but a sustained month against its own baseline
 * does. Null when there is not enough history to make the comparison, which is
 * different from "flat" and must not be scored as zero.
 */
export function trendRatio(series, { recentWeeks = 4 } = {}) {
  if (!Array.isArray(series) || series.length < recentWeeks * 2) return null;
  const recent = series.slice(-recentWeeks);
  const baseline = series.slice(0, -recentWeeks);

  const mean = (xs) => xs.reduce((a, b) => a + b.impressions, 0) / (xs.length || 1);
  const base = mean(baseline);
  if (!base) return null;
  return mean(recent) / base;
}

export const _internals = { GOOGLE_SCALE, LOCALES, BASE };
