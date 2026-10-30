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
//
// 30 Oct 2026: that design tagged about one post in five. JB wants nine in
// ten. Two leaks, both fixed below:
//   - A company found from its link was dropped unless its LinkedIn name
//     appeared word for word in the post ("SMMT" vs "Society of Motor
//     Manufacturers and Traders (SMMT)"): 39% of posts.
//   - A company the post is about but the article never linked to was never
//     looked for (The Dalaman Golf Club, linked only through Hilton).
// So the starting point is now the companies the POST names, picked out by
// Claude, which also leaves out the publications an article cites as sources:
// a rival magazine is exactly the page we must never tag. Each name is
// resolved by its own vanity guesses as well as through the links, and the
// evidence rule widens accordingly: LinkedIn's name for the page must match
// the name in the post, AND its website must back that up (the article links
// to it, or its domain carries the company's name).
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma.js";
import { lookupOrganisation } from "./social-bridge.js";

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
 * The domain label is the cheapest guess and it is often right, but on its own
 * it only ever guesses in one direction. Domains are rarely hyphenated and
 * LinkedIn vanity names very often are, so a brand whose domain runs the words
 * together was unreachable: barberingbusiness.com never produced
 * "barbering-business", which is our own title's page.
 *
 * Splitting a run-together label needs a word boundary we do not have. The
 * article does: the link's anchor text is the brand as a human wrote it, and
 * "Uppercut Deluxe" slugifies straight to "uppercut-deluxe".
 *
 * A junk anchor costs one failed lookup and nothing else, because the website
 * check below still has to pass before anything is tagged.
 */
const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Anchor text that reads like a brand, not like a sentence fragment. */
const looksLikeBrand = (text) => {
  const t = (text || "").trim();
  return Boolean(t) && t.length <= 40 && t.split(/\s+/).length <= 4 && !/[.,;:!?]$/.test(t);
};

export function vanityCandidates(host, anchors = []) {
  const label = host.split(".")[0];
  const out = [label];
  if (label.includes("-")) out.push(label.replace(/-/g, ""));

  for (const text of anchors) {
    if (!looksLikeBrand(text)) continue;
    const s = slug(text);
    if (!s) continue;
    out.push(s);
    if (s.includes("-")) out.push(s.replace(/-/g, ""));
  }

  // Capped: every candidate is a LinkedIn call, and the first two are right
  // most of the time.
  return [...new Set(out)].filter((c) => c.length >= 3 && c.length <= 60).slice(0, 5);
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
  // Bridge titles have no token of their own; Make makes the call for them.
  if (!accessToken) return await lookupOrganisation(vanity);

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
export async function organisationForHost(accessToken, host, cache, anchors = []) {
  if (!host || NEVER_TAG.has(host)) return null;

  const hit = cache[host];
  if (fresh(hit)) return hit.urn ? { urn: hit.urn, name: hit.name } : null;

  for (const vanity of vanityCandidates(host, anchors)) {
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

// ---------- by name ----------

const SUBJECT_MODEL = "claude-opus-5-5";

// Every lookup goes through Make at three credits, and a post is worth one or
// two good tags, not an exhaustive search.
const MAX_LOOKUPS_PER_POST = 10;

// Words that say what kind of thing a company is rather than which one. A
// website "golfclub.com" proves nothing about The Dalaman Golf Club.
const GENERIC = new Set([
  "the", "and", "of", "for", "group", "holdings", "ltd", "limited", "plc", "llp", "inc", "co", "company", "uk",
  "international", "global", "services", "solutions", "golf", "club", "hotel", "hotels", "resort", "resorts",
  "airport", "airports", "dental", "care", "farm", "farms", "fleet", "business", "news", "media", "partners",
]);
const LEGAL = /\b(ltd|limited|plc|llp|inc|co|corp|corporation|gmbh|sa|ag|bv|group)\b\.?/g;

const norm = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the\s+/, "")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Is LinkedIn's name for a page the company the post names? Equal once case,
 * punctuation, "The" and legal suffixes are set aside, or LinkedIn's name is
 * the post's name with a gloss after a separator: "ACI World - Airports
 * Council International", "ArrowXL by JP Home", "SMMT" inside its brackets.
 * Run-together styling ("CloseBrothers") compares equal once spaces go too.
 * Also the same: LinkedIn's name with only trade words after it ("Clyde Munro
 * Dental Group" for Clyde Munro), and an acronym of LinkedIn's name ("NSA"
 * for National Sheep Association).
 *
 * `loose` is for when the website has already proved who this is: then the
 * post's name only has to begin LinkedIn's ("PTx" for PTx Trimble).
 */
export function sameName(linkedinName, written, { loose = false } = {}) {
  const a = norm(linkedinName);
  const b = norm(written);
  if (!a || !b) return false;
  if (a === b || a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const raw = String(linkedinName || "");
  const parts = raw.split(/\s+[-–—|]\s+|\s+by\s+|,|\(|\)/i).map(norm).filter(Boolean);
  if (parts.some((p) => p === b || p.replace(/ /g, "") === b.replace(/ /g, ""))) return true;
  if (a.startsWith(`${b} `)) {
    const extra = a.slice(b.length + 1).split(" ");
    if (loose || extra.every((w) => GENERIC.has(w))) return true;
  }
  // Acronyms only when the website has proved it: "dvsa" on LinkedIn is a
  // Canadian students' association, whose initials spell DVSA perfectly well.
  const w = String(written || "").trim();
  if (loose && /^[A-Z]{2,6}$/.test(w)) {
    const initials = a.split(" ").filter((x) => !["and", "of", "the", "for"].includes(x)).map((x) => x[0]).join("");
    if (initials === w.toLowerCase()) return true;
  }
  return false;
}

/** Distinctive words of a name, for checking a website carries it. */
const distinctive = (name) => norm(name).split(" ").filter((w) => w.length >= 4 && !GENERIC.has(w));

function websiteBacksName(host, name) {
  if (!host) return false;
  const label = host.split(".").slice(0, -1).join("").replace(/[^a-z0-9]/g, "");
  const words = distinctive(name);
  return words.length > 0 && words.some((w) => label.includes(w));
}

/** Vanity guesses from a company's name, best first. */
export function nameCandidates(name) {
  const s = slug(String(name || "").replace(LEGAL, " "));
  if (!s) return [];
  const bare = s.replace(/^the-/, "");
  const out = [s, bare, bare.replace(/-/g, ""), `the-${bare}`];
  // One-word brands often hold a UK page under a suffix ("evri-uk").
  if (!bare.includes("-")) out.push(`${bare}-uk`, `${bare}uk`);
  return [...new Set(out)].filter((c) => c.length >= 3 && c.length <= 60);
}

/**
 * The organisations a post is about, as the post writes them.
 *
 * Claude rather than a pattern because the line between "Bristol Airport
 * generated 1.7 million kWh" (tag it) and "according to Motor Transport"
 * (never) is a reading of the sentence. Names come back exactly as they
 * appear in the post, since that is the text the tag replaces.
 */
export async function subjectOrganisations({ text, title, excerpt }) {
  if (!process.env.ANTHROPIC_API_KEY || !text) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const res = await client.messages.create({
      model: SUBJECT_MODEL,
      max_tokens: 2000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              organisations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    official: { type: "string" },
                    website: { type: "string" },
                  },
                  required: ["name", "official", "website"],
                  additionalProperties: false,
                },
              },
            },
            required: ["organisations"],
            additionalProperties: false,
          },
        },
      },
      system: `You pick which organisations a trade magazine's LinkedIn post should tag.

List the companies, clubs, hotels, venues, charities, associations and public bodies the post is ABOUT or features, most central first, at most five. Leave out:
- news outlets, magazines, trade publications and data providers cited as a source ("according to Motor Transport", "Hotel Dive reports")
- the magazine publishing the post
- products, events and places that are not an organisation

"name" must be copied exactly as it appears in the post text, same spelling and capitals, so it can be found in the text. Skip anything not named in the post text itself.
"official" is its full registered or trading name if the post shortens it ("Clyde Munro Dental Group" for Clyde Munro, "Driver and Vehicle Standards Agency" for DVSA), otherwise the same as name.
"website" is the organisation's own domain (example.com) if you are confident of it, otherwise "".`,
      messages: [
        {
          role: "user",
          content: `Post:\n${text}\n\nArticle headline: ${title || ""}\n\nArticle opening:\n${excerpt || ""}`,
        },
      ],
    });
    if (res.stop_reason === "refusal") return [];
    const block = res.content.find((b) => b.type === "text");
    const parsed = JSON.parse(block?.text || "{}");
    return (parsed.organisations || [])
      .filter((o) => o?.name && text.includes(o.name))
      .slice(0, 5)
      .map((o) => ({ name: o.name.trim(), official: String(o.official || "").trim(), website: registrableHost(`https://${String(o.website || "").replace(/^https?:\/\//, "")}`) }));
  } catch {
    return [];
  }
}

/**
 * The LinkedIn page for one organisation the post names, or null.
 *
 * `hosts` are the article's outbound links, already resolved where the cache
 * knows them. The cheapest evidence is checked first: a link whose page
 * LinkedIn has already confirmed, then the name's own vanity guesses.
 */
async function organisationForName(accessToken, subject, { hosts, cache, budget, skip }) {
  const key = `name:${norm(subject.name)}`;
  const hit = cache[key];
  if (fresh(hit)) return hit.urn ? { urn: hit.urn, name: hit.name } : null;

  // The page must list a website, and then a tag needs one of two proofs: the
  // website (linked from the article, the one Claude knows for the company, or
  // carrying its name), or a name so specific that a page holding it exactly
  // is that company — two or more words, at least one of them distinctive.
  // British Airways lists ba.com; "British Airways" on its own is proof enough.
  const accept = (org) => {
    if (!org?.id || skip.has(String(org.id))) return null;
    const name = org.localizedName || org.vanityName;
    const site = registrableHost(org.localizedWebsite || "");
    // A page with no website is usually stale or unofficial, and "Little
    // Pumpkins" with no site and no address could be any of a dozen nurseries.
    if (!site) return null;
    const siteProves = Boolean(hosts.includes(site) || site === subject.website);
    if (!sameName(name, subject.name, { loose: siteProves })) return null;
    const exact = norm(name) === norm(subject.name);
    const specific = exact && norm(subject.name).split(" ").length >= 2 && distinctive(subject.name).length >= 1;
    const backed = siteProves || websiteBacksName(site, subject.name) || specific;
    return backed ? { urn: `urn:li:organization:${org.id}`, name } : null;
  };

  // 1. A link in the article whose page is already confirmed and is this name.
  for (const host of hosts) {
    const known = cache[host];
    if (fresh(known) && known.urn && sameName(known.name, subject.name)) {
      cache[key] = { urn: known.urn, name: known.name, at: Date.now() };
      return { urn: known.urn, name: known.name };
    }
  }

  // 2. Vanity guesses from the post's name, then the full official name
  //    Claude gave, then the website.
  const guesses = [...nameCandidates(subject.name)];
  if (subject.official && norm(subject.official) !== norm(subject.name)) guesses.push(...nameCandidates(subject.official).slice(0, 3));
  if (subject.website) guesses.push(...vanityCandidates(subject.website, [subject.name]));
  for (const vanity of [...new Set(guesses)]) {
    if (budget.left <= 0) return null;
    budget.left--;
    const org = await vanityLookup(accessToken, vanity);
    const found = accept(org);
    if (found) {
      cache[key] = { ...found, at: Date.now() };
      return found;
    }
  }

  cache[key] = { urn: null, at: Date.now() };
  return null;
}

/**
 * Companies to tag in one post: [{ urn, name, written }].
 *
 * `name` is LinkedIn's exact name, which the tag has to carry for LinkedIn to
 * link it (its docs: organisation mentions must match the full name, case
 * sensitive, or they render as plain text). `written` is how the post says
 * it, which is the text renderCommentary replaces.
 */
export async function mentionsForPost({ accessToken, text, title, body, links = [], ownHost = "", ownOrgIds = [] }) {
  const linkHosts = [];
  const anchors = new Map();
  for (const link of links) {
    const host = registrableHost(typeof link === "string" ? link : link?.url);
    if (!host || host === ownHost || host.endsWith(`.${ownHost}`) || NEVER_TAG.has(host)) continue;
    if (!linkHosts.includes(host)) linkHosts.push(host);
    const anchor = typeof link === "string" ? null : link?.text;
    if (anchor) anchors.set(host, [...(anchors.get(host) || []), anchor]);
  }

  const excerpt = String(body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
  const subjects = await subjectOrganisations({ text, title, excerpt });
  if (!subjects.length) return [];

  const cache = await readCache();
  const before = JSON.stringify(cache);
  const budget = { left: MAX_LOOKUPS_PER_POST };
  const skip = new Set(ownOrgIds.map(String));
  const found = [];

  // Links whose page nobody has looked up yet are resolved first, once, so
  // step 1 of organisationForName can match them by name for free.
  for (const host of linkHosts) {
    if (budget.left <= 0 || fresh(cache[host])) continue;
    if (!subjects.some((s) => websiteBacksName(host, s.name) || (anchors.get(host) || []).some((a) => sameName(a, s.name)))) continue;
    budget.left -= vanityCandidates(host, anchors.get(host) || []).length;
    await organisationForHost(accessToken, host, cache, anchors.get(host) || []);
  }

  for (const subject of subjects) {
    if (found.length >= MAX_MENTIONS) break;
    const org = await organisationForName(accessToken, subject, { hosts: linkHosts, cache, budget, skip });
    if (org && !found.some((f) => f.urn === org.urn)) found.push({ ...org, written: subject.name });
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
 *
 * The tag replaces the post's own wording (`written`) with LinkedIn's exact
 * name, because LinkedIn only links a mention whose text is the page's full
 * name, case sensitive. "SMMT" becomes "Society of Motor Manufacturers and
 * Traders (SMMT)" at its first mention; a shorter tag would show as plain text.
 */
export function renderCommentary(text, mentions = []) {
  const said = (m) => m.written || m.name;
  const usable = mentions.filter((m) => m?.urn && m?.name && text.includes(said(m))).slice(0, MAX_MENTIONS);
  if (!usable.length) return escapeCommentary(text);

  // Longest name first, so "Ford Pro" is matched before "Ford" and the shorter
  // name cannot eat the start of the longer one.
  const ordered = [...usable].sort((a, b) => said(b).length - said(a).length);
  const done = new Set();
  let out = "";
  let rest = text;

  while (rest) {
    let best = null;
    for (const m of ordered) {
      if (done.has(m.urn)) continue;
      const i = rest.indexOf(said(m));
      if (i === -1) continue;
      if (!best || i < best.index) best = { index: i, mention: m };
    }
    if (!best) break;

    out += escapeCommentary(rest.slice(0, best.index));
    out += `@[${best.mention.name}](${best.mention.urn})`;
    rest = rest.slice(best.index + said(best.mention).length);
    done.add(best.mention.urn);
  }

  return out + escapeCommentary(rest);
}
