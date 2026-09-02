// Tagging companies in LinkedIn posts, with no human in the loop.
//
// JB, 2 Sep 2026: tagging matters and it has to be fully automated. The obvious
// design is a hand-curated name -> URN table, and it was the wrong answer: it
// needs a person to fill it and it goes stale.
//
// What makes automation possible is a detail in LinkedIn's own docs. Most
// organization endpoints are gated on the caller holding an ADMINISTRATOR role,
// but two are explicitly not: `organizations?q=vanityName` and
// `organizationsLookup?ids=`. Both return the non-admin field set for ANY
// public company page — id, localizedName, vanityName, localizedWebsite — on a
// plain rw_organization_admin token. Tagging a company in a post has never
// required administering it; only posting AS one does. So the whole problem
// reduces to finding the vanity name, and LinkedIn will confirm the rest.
//
// This deliberately does NOT read company pages off the public web. That works
// (a page's HTML carries its URN) and it is scraping, which breaches LinkedIn's
// terms and would undercut the API access this is built on. Everything here
// goes through the official API.
//
// The evidence chain per tag, and no tag is emitted without all three:
//   1. the ARTICLE links out to a company's own domain
//   2. a vanityName lookup for a candidate derived from that domain succeeds
//   3. the organisation LinkedIn returns names that same domain as its website
//
// Step 3 is what makes guessing safe. A wrong guess does not resolve, and a
// coincidental resolve is rejected because the websites will not match. Tagging
// the wrong company is worse than tagging nobody: it notifies a stranger and it
// is visible on the post for ever.
import { prisma } from "./prisma";

const CACHE_KEY = "linkedin:orgUrnCache";
const API_VERSION = process.env.LINKEDIN_API_VERSION || "202607";

// Three, not "as many as are relevant". Liberal tagging is a documented spam
// signal and the penalty lands on the page, which is worth far more than the
// reach a fourth tag buys.
export const MAX_MENTIONS = 3;

// Hosts that appear in article links constantly and are never the subject.
// Anything here is skipped before a lookup is even attempted, which keeps the
// call count down and stops us tagging the Guardian because we cited it.
const NEVER_TAG = new Set([
  "gov.uk",
  "www.gov.uk",
  "legislation.gov.uk",
  "ons.gov.uk",
  "hmrc.gov.uk",
  "europa.eu",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "google.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "pexels.com",
  "images.pexels.com",
]);

/** example.co.uk from https://www.example.co.uk/news/thing */
function registrableHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Vanity name guesses for a domain, best first.
 *
 * LinkedIn vanity names are usually the brand, so the second-level label is the
 * strongest guess. The hyphenated and unhyphenated forms cover the two ways a
 * multi-word brand tends to register.
 */
function vanityCandidates(host) {
  const label = host.split(".")[0];
  const out = [label];
  if (label.includes("-")) out.push(label.replace(/-/g, ""));
  return [...new Set(out)].filter((c) => c.length >= 3 && c.length <= 60);
}

// ---------- cache ----------
//
// Fleet-wide, not per title: Webfleet's URN is the same for Fleet as it is for
// Smart SME, and resolving it five times would be five API calls for one fact.
// Negative results are cached too, with a shorter life, because a domain that
// has no company page will otherwise be looked up on every post that cites it.

const POSITIVE_TTL_DAYS = 90;
const NEGATIVE_TTL_DAYS = 14;

async function readCache() {
  const row = await prisma.globalSetting.findUnique({ where: { key: CACHE_KEY } });
  if (!row) return {};
  try {
    return JSON.parse(row.value);
  } catch {
    return {};
  }
}

async function writeCache(cache) {
  const value = JSON.stringify(cache);
  await prisma.globalSetting.upsert({
    where: { key: CACHE_KEY },
    update: { value },
    create: { key: CACHE_KEY, value },
  });
}

const fresh = (entry) => {
  if (!entry) return false;
  const days = (Date.now() - entry.at) / 864e5;
  return days < (entry.urn ? POSITIVE_TTL_DAYS : NEGATIVE_TTL_DAYS);
};

// ---------- lookup ----------

async function vanityLookup(accessToken, vanity) {
  const url = `https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanity)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": API_VERSION,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return null;
  }
  // 403 here means the token lacks rw_organization_admin, which is a setup
  // problem and not something a different vanity name will fix. Treated as "no
  // match" rather than thrown: a post going out untagged is a far better
  // outcome than a post not going out.
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.elements?.[0] || null;
}

/**
 * The organisation behind a domain, or null.
 *
 * Verified, not guessed: whatever LinkedIn returns must itself claim the same
 * website. That is the whole safety property of this module.
 */
export async function organisationForHost(accessToken, host, cache) {
  if (!host || NEVER_TAG.has(host)) return null;

  const hit = cache[host];
  if (fresh(hit)) return hit.urn ? { urn: hit.urn, name: hit.name } : null;

  for (const vanity of vanityCandidates(host)) {
    const org = await vanityLookup(accessToken, vanity);
    if (!org?.id) continue;

    const claimed = registrableHost(org.localizedWebsite || "");
    // The confirmation step. Without it, "reach" resolves to whichever company
    // happens to own the vanity name "reach", and we tag a stranger.
    if (!claimed || claimed !== host) continue;

    const found = { urn: `urn:li:organization:${org.id}`, name: org.localizedName || org.vanityName };
    cache[host] = { ...found, at: Date.now() };
    return found;
  }

  cache[host] = { urn: null, at: Date.now() };
  return null;
}

/**
 * Companies to tag for one article, in the order they appear.
 *
 * `links` are the outbound URLs found in the article body; `ownHost` is the
 * title's own domain, which is never tagged.
 */
export async function mentionsForArticle(accessToken, { links = [], ownHost = "" } = {}) {
  const hosts = [];
  for (const link of links) {
    const host = registrableHost(link);
    if (!host || host === ownHost || host.endsWith(`.${ownHost}`)) continue;
    if (!hosts.includes(host)) hosts.push(host);
  }

  const cache = await readCache();
  const before = JSON.stringify(cache);
  const found = [];

  for (const host of hosts) {
    if (found.length >= MAX_MENTIONS) break;
    const org = await organisationForHost(accessToken, host, cache);
    if (org && !found.some((f) => f.urn === org.urn)) found.push(org);
  }

  if (JSON.stringify(cache) !== before) await writeCache(cache);
  return found;
}

// ---------- rendering ----------

// LinkedIn's commentary is a light markup format where an unescaped "(" does
// not merely render wrong, it silently truncates the post from that point on.
// A mention is spelled @[Name](urn), which is made entirely of the characters
// that have to be escaped everywhere else — so the text cannot simply be
// escaped and then have mentions substituted in, nor the reverse.
//
// The order that works: split the text around the literal company names, escape
// each plain segment, and join with mention markup that was never escaped.
const RESERVED = /[\\|{}@[\]()<>*_~]/g;

/** Escape a plain run of text. "#" is left alone so hashtags stay hashtags. */
export function escapeCommentary(text) {
  return text.replace(RESERVED, (c) => `\\${c}`);
}

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Escaped commentary with the first mention of each company turned into a tag.
 *
 * Only the first occurrence is tagged. LinkedIn renders every mention as a
 * link, and a company tagged four times in six paragraphs reads as keyword
 * stuffing rather than a citation.
 */
export function renderCommentary(text, mentions = []) {
  const usable = mentions.filter((m) => m?.urn && m?.name && text.includes(m.name)).slice(0, MAX_MENTIONS);
  if (!usable.length) return escapeCommentary(text);

  // Longest name first, so "Ford Pro" is matched before "Ford" and the shorter
  // name cannot eat the start of the longer one.
  const ordered = [...usable].sort((a, b) => b.name.length - a.name.length);
  const done = new Set();
  let out = "";
  let rest = text;

  while (rest) {
    let best = null;
    for (const m of ordered) {
      if (done.has(m.urn)) continue;
      const i = rest.indexOf(m.name);
      if (i === -1) continue;
      if (!best || i < best.index) best = { index: i, mention: m };
    }
    if (!best) break;

    out += escapeCommentary(rest.slice(0, best.index));
    out += `@[${best.mention.name}](${best.mention.urn})`;
    rest = rest.slice(best.index + best.mention.name.length);
    done.add(best.mention.urn);
  }

  return out + escapeCommentary(rest);
}
