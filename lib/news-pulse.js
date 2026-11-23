// The news pulse: what each title's trade is reporting in the last few hours,
// read fresh on every trending refresh.
//
// Why this exists. Google's national Trending now list is mass-market: from
// 17-23 Nov 2026 it gave Smart SME 98 matches and every other title 0-18, with
// Barbering, Dental, FM and Senior getting none at all. The news lane (lib/
// news-clusters.js) fits the trade titles far better (average fit 78-85
// against 66-72), but it could only see the title's own wire: narrow beat
// searches over seven days, scanned hourly, and nothing at all for some titles.
//
// So every refresh now also asks two broad, fast sources what the trade is
// talking about right now, and those articles join the wire's in the same
// clustering. A story three outlets are running is caught within the half
// hour, not when it eventually reaches a beat search.
//
//   Google News: one broad search per title over the last 12 hours, GB
//   edition. Unofficial but stable and the source the wire already relies on.
//   Its links are Google redirects, which the draft cannot read, so...
//
//   GDELT (api.gdeltproject.org): a free global news monitor that updates
//   every 15 minutes and returns real publisher links. It asks for one request
//   every five seconds, so a third of the titles are asked per refresh, each
//   title every ninety minutes.
//
// Nothing here is stored. These are read, clustered and discarded; only a story
// that clusters becomes a TrendingTopic. The Director's wire is untouched.

import { splitHeadline } from "./news-clusters";

// Broad terms per title: the words a headline about that trade would use.
// `global` titles ask GDELT worldwide; the rest are UK outlets only. Google News
// is always the GB edition, which still carries the big international stories.
export const PULSE = {
  "smart-sme": { terms: ['"small business"', '"small businesses"', "SME", "SMEs", '"business owners"', '"business rates"', '"self-employed"'] },
  "fleet-magazine": { terms: ["HGV", "haulage", '"lorry drivers"', '"fleet operators"', '"company car"', "DVSA", '"electric vans"', '"van drivers"'] },
  "golf-resort-magazine": { terms: ['"golf course"', '"golf courses"', '"golf club"', '"golf resort"', '"golf tourism"'], global: true },
  "barbering-business": { terms: ["barber", "barbers", "barbershop", "hairdressers", '"hair salon"'] },
  "airport-business-magazine": { terms: ["airport", "airports", "Heathrow", "Gatwick", '"air passengers"', '"air traffic"'], global: true },
  "gym-business-news": { terms: ["gym", "gyms", '"health club"', '"leisure centre"', '"fitness club"', "PureGym"] },
  "nursery-daily": { terms: ["nursery", "nurseries", '"early years"', "childcare", '"free childcare"'] },
  "senior-lifestyle-business": { terms: ['"care home"', '"care homes"', '"retirement village"', '"retirement living"', '"later living"', '"social care"'] },
  "dental-business-news": { terms: ["dentist", "dentists", "dental", '"NHS dentistry"', "orthodontist"] },
  "smart-farming-news": { terms: ["farmers", "farming", "farmland", "Defra", "agriculture", "livestock"] },
  "data-centre-today": { terms: ['"data centre"', '"data centres"', '"data center"', '"data centers"', "hyperscale"], global: true },
  "fm-weekly": { terms: ['"facilities management"', '"facility management"', '"building maintenance"', '"cleaning contract"', "Mitie"] },
  "stadium-arena-business": { terms: ['"new stadium"', '"stadium plans"', '"stadium redevelopment"', '"arena plans"', '"naming rights"', '"stadium capacity"'], global: true },
  "retail-business-magazine": { terms: ["retailer", "retailers", '"high street"', '"retail sales"', "supermarket", "supermarkets"] },
  "travel-business-news": { terms: ['"travel industry"', '"tour operator"', '"holiday bookings"', '"travel firm"', "airlines", "hotels"] },
};

const PULSE_HOURS = 12;
const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1]);

function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * One title's Google News search for the last 12 hours, as cluster items.
 * The outlet is the publisher Google names, so a redirect link still counts
 * once per publisher.
 */
export async function googlePulse(slug) {
  const cfg = PULSE[slug];
  if (!cfg) return [];
  const q = `(${cfg.terms.join(" OR ")}) when:${PULSE_HOURS}h`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News pulse ${slug} returned ${res.status}`);
  const xml = await res.text();
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) || [])
    .map((it) => {
      const title = tag(it, "title");
      const sourceUrl = it.match(/<source[^>]*url="([^"]+)"/i)?.[1];
      const outlet = hostOf(sourceUrl) || splitHeadline(title).outlet?.toLowerCase() || null;
      const when = new Date(tag(it, "pubDate"));
      return { title, link: tag(it, "link"), publishedAt: isNaN(when) ? null : when, brand: { name: outlet || "" }, via: "google" };
    })
    .filter((i) => i.title && i.brand.name && i.publishedAt);
}

/** GDELT's seendate, "20261123T150000Z", as a Date. */
function gdeltDate(s) {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

/** One title's GDELT article list for the last 12 hours, as cluster items with real links. */
export async function gdeltPulse(slug) {
  const cfg = PULSE[slug];
  if (!cfg) return [];
  const where = cfg.global ? "sourcelang:english" : "sourcelang:english sourcecountry:UK";
  const query = `(${cfg.terms.join(" OR ")}) ${where}`;
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({ query, mode: "artlist", format: "json", timespan: `${PULSE_HOURS}h`, maxrecords: "250", sort: "datedesc" });
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`GDELT ${slug} returned ${res.status}: ${text.slice(0, 120)}`);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    // GDELT answers a bad query or a too-fast caller in plain text with a 200.
    throw new Error(`GDELT ${slug}: ${text.slice(0, 120)}`);
  }
  return (body.articles || [])
    .map((a) => ({
      title: decode(a.title),
      link: a.url,
      publishedAt: gdeltDate(a.seendate),
      brand: { name: String(a.domain || hostOf(a.url)).replace(/^www\./, "").toLowerCase() },
      via: "gdelt",
    }))
    .filter((i) => i.title && i.link && i.brand.name && i.publishedAt);
}

// GDELT asks for no more than one request every five seconds.
const GDELT_GAP_MS = 5500;
const GDELT_GROUPS = 3;

/**
 * Pulse items for every title, keyed by slug, plus counts for the Trending tab.
 * Google News for every title in parallel; GDELT for a rotating third of them,
 * one at a time. Failures are reported, never thrown: the wire's own items
 * still cluster without the pulse.
 */
export async function readPulse(slugs) {
  const bySlug = new Map(slugs.map((s) => [s, []]));
  const counts = { google: 0, gdelt: 0, gdeltTitles: [] };
  const errors = [];
  const known = slugs.filter((s) => PULSE[s]);

  const google = Promise.all(
    known.map(async (slug) => {
      try {
        const items = await googlePulse(slug);
        bySlug.get(slug).push(...items);
        counts.google += items.length;
      } catch (e) {
        errors.push(e.message);
      }
    })
  );

  // Which third this refresh asks, from the half hour it runs in, so every
  // title is asked once every three refreshes with nothing to remember.
  const turn = Math.floor(Date.now() / (30 * 60 * 1000)) % GDELT_GROUPS;
  const gdeltSlugs = known.filter((_, i) => i % GDELT_GROUPS === turn);
  const gdelt = (async () => {
    for (const [n, slug] of gdeltSlugs.entries()) {
      if (n) await new Promise((r) => setTimeout(r, GDELT_GAP_MS));
      try {
        const items = await gdeltPulse(slug);
        bySlug.get(slug).push(...items);
        counts.gdelt += items.length;
        counts.gdeltTitles.push(slug);
      } catch (e) {
        errors.push(e.message);
        // On 23 Nov 2026 GDELT answered even a single small query with 429
        // after 13 seconds: it is rationing the free API. One refusal ends
        // this refresh's turn rather than spending a minute collecting more.
        if (/429|limit requests|fetch failed|aborted|timeout/i.test(e.message)) {
          counts.gdeltRefused = true;
          break;
        }
      }
    }
  })();

  await Promise.all([google, gdelt]);
  return { bySlug, counts, errors };
}
