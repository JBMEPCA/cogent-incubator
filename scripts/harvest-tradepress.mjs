// Harvest named people out of a trade title's own archive.
//
// The angle. Every sector has a trade press, every trade press runs a steady
// stream of appointment, promotion and award stories, and each of those names a
// person, their job title and their employer. That is the whole row, and the
// story itself is the hook, which is the thing the interview copy needs and the
// thing an award list does not give you. Sourcing this way also scales the
// right way round: it is a standing supply that refills every week rather than
// a list that runs out.
//
// Why the sitemap rather than the category pages. Category archives paginate
// differently on every site and some of them are JavaScript apps that ship
// their headlines but not their links, so an archive crawl breaks per site.
// Every one of these titles publishes a sitemap index instead: server-rendered
// XML, every article URL in it, no pagination to guess. One code path works
// everywhere.
//
// Why an LLM does the extraction. The prose is formulaic but not regular:
// "Dreamland Golf Club appoints new course superintendent" hides the name in
// the body, "Aaron Rai named inaugural winner" puts it in the headline, and
// "Darnell accepts GM role at leading Dubai club" gives a surname and no
// employer. A regex for that becomes a pile of special cases. Haiku reads the
// text and returns the fields, and is told to return nothing rather than guess,
// which is the part that matters: a wrong name is worse than no row.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
//     scripts/harvest-tradepress.mjs --site=airportindustry-news.com \
//     --out=scripts/roster/airport.csv [--limit=60] [--pages=8] [--all]
//
// By default only URLs whose slug looks like a people story are read, because
// that is roughly one article in ten and reading the other nine costs nine
// times as much for nothing. --all drops that filter.

import Anthropic from "@anthropic-ai/sdk";
import { findAddress } from "./lib/find-address.mjs";
import { guessDomain } from "./lib/guess-domain.mjs";
import { mergeRoster, readRoster, summarise } from "./lib/roster.mjs";

const UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };
const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split("=")[1] : d;
};
const SITE = arg("site", "");
const OUT = arg("out", "");
const LIMIT = Number(arg("limit", "60"));
const SUBMAPS = Number(arg("pages", "8"));
const ALL = process.argv.includes("--all");
const NO_ADDRESS = process.argv.includes("--no-address");
// Sector words a guessed domain must show on its homepage before it is
// believed. Without these, domain guessing is the tstgroup.com trap.
const PROOF = arg("proof", "").split(",").map((s) => s.trim()).filter(Boolean);

if (!SITE || !OUT) {
  console.error("usage: harvest-tradepress.mjs --site=<host> --out=<csv> [--limit=60] [--pages=8] [--all]");
  process.exit(1);
}

// Slugs that suggest a person is named in the story. Kept deliberately wide:
// a false positive costs one Haiku call, a false negative loses a person.
const PEOPLE_SLUG =
  /(appoint|appoints|appointed|appointment|joins|join-|names|named|promot|hire|recruit|new-(chief|ceo|managing|general|head|director|course|club|sales|operations|technical)|-md-|becomes|steps-up|takes-(over|the-reins|on)|succeed|elected|award|awards|wins|winner|honour|honor|of-the-year|interview|profile|in-conversation|q-and-a|spotlight|meet-the)/i;

// Never worth reading.
const SKIP_URL =
  /(\/(category|tag|author|page|wp-content|wp-json|feed|privacy|cookie|terms|advertise|subscribe|contact|about|jobs?|events?|webinar|whitepaper|sitemap)\/|\.(jpe?g|png|gif|pdf|webp|svg|xml)$)/i;

// Retried, because a single pass over Turf Matters fetched 200 URLs and got
// only 47 bodies back. The misses were not 404s, they were the site shedding
// load under a burst, and treating that as "no article" silently threw away
// three quarters of the harvest.
async function text(url, { timeout = 20000, attempts = 3 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(timeout) });
      if (r.ok) return await r.text();
      // A real 404 will not become a 200 on a retry; only back off on the
      // statuses that mean "not now".
      if (![408, 425, 429, 500, 502, 503, 504].includes(r.status)) return "";
    } catch {
      // A timeout or a dropped connection is worth another go.
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return "";
}

// All in One SEO wraps every URL in CDATA and Yoast does not, so both forms
// have to be read. Counting raw <loc> tags with grep hides this: the tags are
// all present, and a regex that expects a bare URL inside them still matches
// nothing.
const locsIn = (xml) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1]);

// The sitemap index points at sub-sitemaps; the sub-sitemaps hold the articles.
// Newest first is what we want, and post sitemaps are conventionally numbered,
// so the highest numbered ones are read first.
async function articleUrls(host) {
  const index = await text(`https://${host}/sitemap.xml`) || await text(`https://${host}/sitemap_index.xml`);
  const subs = locsIn(index).filter((u) => /\.xml/i.test(u));
  const posty = subs
    .filter((u) => !/(category|tag|author|user|page|product|attachment|image|video)/i.test(u))
    .sort((a, b) => {
      const n = (s) => Number((s.match(/(\d+)\.xml/) || [])[1] || 0);
      return n(b) - n(a);
    });

  const out = [];
  for (const sub of (posty.length ? posty : subs).slice(0, SUBMAPS)) {
    const urls = locsIn(await text(sub)).filter((u) => !SKIP_URL.test(u));
    out.push(...urls);
  }
  // Deduplicate, keep the discovery order, and drop the site root.
  return [...new Set(out)].filter((u) => new URL(u).pathname.length > 12);
}

function readable(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ");
  // Outbound links are how an article names the subject's own website, which
  // saves guessing the domain from the company name.
  const links = [...body.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
    .map((m) => m[1])
    .filter((u) => {
      try {
        const h = new URL(u).hostname.replace(/^www\./, "");
        return (
          h !== SITE.replace(/^www\./, "") &&
          !/facebook|twitter|linkedin|instagram|youtube|tiktok|x\.com|google|gravatar|wp\.com|cloudflare|pinterest|whatsapp|mailto/i.test(h)
        );
      } catch {
        return false;
      }
    });
  const plain = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return { title: title.replace(/\s+/g, " ").trim(), plain: plain.slice(0, 3500), links: [...new Set(links)].slice(0, 8) };
}

const client = new Anthropic();

const SYSTEM = `You extract one interview candidate from a trade press article.

Return ONLY minified JSON: {"name":"","role":"","company":"","website":""}

Rules, and the first one overrides everything else:
- If the article does not clearly name a specific living individual person, return {} and nothing else. Never guess a name, never infer one from a company name, never return a company as the name.
- name: the full name of the person the story is about. If several people are named, choose the one the story is actually about: the person appointed, promoted, or given the award.
- role: their job title exactly as the article states it. Empty string if not stated. Never invent a plausible title.
- company: the organisation they work for, as stated.
- website: the organisation's own website, but ONLY if the article text or one of the supplied candidate links clearly belongs to that organisation. Otherwise empty string.
- Do not return journalists, the article's author, a press officer, or a politician commenting on someone else's news.`;

async function extract(article) {
  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Headline: ${article.title}\n\nCandidate links: ${article.links.join(" ") || "(none)"}\n\nArticle:\n${article.plain}`,
      },
    ],
  });
  const raw = (res.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

const urls = await articleUrls(SITE);
if (!urls.length) {
  console.error(`No article URLs found for ${SITE}. Check that https://${SITE}/sitemap.xml exists.`);
  process.exit(1);
}
const candidates = ALL ? urls : urls.filter((u) => PEOPLE_SLUG.test(u));
console.log(`${SITE}: ${urls.length} articles in the sitemap, ${candidates.length} look like people stories, reading ${Math.min(LIMIT, candidates.length)}\n`);

const rows = [];
let read = 0, named = 0, addressed = 0, failed = 0;
for (const url of candidates.slice(0, LIMIT)) {
  const html = await text(url);
  if (!html) continue;
  read++;
  const article = readable(html);
  if (article.plain.length < 200) continue;
  // A people-shaped slug is not a sector-relevant story. An airport archive
  // carries a football club's chief executive because the trade press covers
  // its parent group's other interests, and that person is no use to us.
  if (PROOF.length) {
    const hay = `${article.title} ${article.plain}`.toLowerCase();
    if (!PROOF.some((w) => hay.includes(w.toLowerCase()))) continue;
  }

  let got;
  try {
    got = await extract(article);
  } catch (e) {
    failed++;
    // Credit exhaustion and rate limits look identical to a bad article unless
    // they are surfaced, and the fleet has died silently on Anthropic credit
    // before, so stop rather than write a run of empty rows.
    console.error(`extraction failed: ${String(e.message).slice(0, 140)}`);
    if (failed >= 3) {
      console.error("Three extraction failures in a row. Stopping rather than reporting an empty harvest.");
      break;
    }
    continue;
  }
  failed = 0;
  if (!got?.name || !got.name.trim().includes(" ")) continue;
  named++;

  let domain = "";
  let guessed = false;
  if (got.website) {
    try {
      domain = new URL(got.website.startsWith("http") ? got.website : `https://${got.website}`).hostname.replace(/^www\./, "");
    } catch {}
  }
  // The trade press names an employer far more often than it links one, so a
  // domain the article did not give is worked out from the company name and
  // then made to prove itself. PROOF is what stops a generic name landing on
  // the wrong company: "Menzies Aviation" shortened to "menzies" once resolved
  // to an accountancy firm.
  if (!domain && got.company && PROOF.length) {
    try {
      domain = (await guessDomain(got.company, { extraProof: PROOF })) || "";
      guessed = Boolean(domain);
    } catch {}
  }

  let email = "";
  if (domain && !NO_ADDRESS) {
    try {
      email = (await findAddress(domain, { person: got.name }))?.email || "";
    } catch {}
  }
  if (email) addressed++;

  rows.push({
    name: got.name.trim(),
    role: (got.role || "").trim(),
    company: (got.company || "").trim(),
    domain,
    email,
    source: `${SITE} archive${guessed ? ", domain guessed" : ""}`,
    hookUrl: url,
  });
  console.log(`${got.name.slice(0, 24).padEnd(25)} ${(got.company || "").slice(0, 26).padEnd(27)} ${(email || "-").padEnd(34)}`);
}

const { total, added } = mergeRoster(OUT, rows);
const s = summarise(readRoster(OUT));
console.log(
  `\nread ${read} articles, ${named} named a person, ${addressed} of those reachable.\n` +
    `${OUT} now holds ${total} rows (${added} new): ${s.withEmail} with an address, ${s.ready} with both.`
);
