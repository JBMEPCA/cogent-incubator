// The SEO Analyst agent: audits the live WordPress site and files improvement
// suggestions that wait for JB's one-click approval. Needs both the Anthropic
// key and WordPress credentials.
//
// LINKING IS THIS AGENT'S FIRST DUTY, ahead of titles, metadata and general
// advice. The three news rewrites published on 3 and 4 August 2026 carried zero
// internal links between them, and the business bank accounts guide named eight
// providers (Xero, QuickBooks, FreeAgent, Monzo, Starling, Tide, Revolut, Wise)
// without linking a single one. Both are the cheapest wins available to a site
// with no domain authority, and both were being left on the floor because
// nothing was accountable for them once an article was live. This agent is.
//
// The linking pass is deliberately split in two:
//   - Brand links are found and written HERE, in code, from the PrBrand table.
//     We know the company and we know its URL, so there is nothing to reason
//     about and nothing to invent.
//   - Internal links are chosen by a model, but no longer here. Since 9 Oct
//     2026 they are a weekly pass over that week's new articles only, on Haiku
//     (runInternalLinks in lib/agents/upkeep.js). The Sonnet call that used to
//     sit in this sweep cost about $0.22 a run, re-read the same ten posts
//     twice a day, and most of what it filed was thrown away (1,124 of 1,574
//     internal links and 170 of 182 pieces of advice in the 30 days to 9 Oct).
//     JB's ceiling for the whole linking job is £5 a week across the fleet.
//     This sweep is now pure code and costs nothing.
import { forSite } from "./prisma";
import { fetchPosts, fetchPost, isWordPressConfigured } from "./wordpress";
import { isDraftingConfigured } from "./drafting";
import { countLinksTo, siteHost } from "./voice";


// The Anthropic key is fleet-wide; the WordPress install being audited is not.
export function isSeoAgentConfigured(wp) {
  return isDraftingConfigured() && isWordPressConfigured(wp);
}

/** This title's WordPress credential, for the entry points handed only a site. */
async function wordpressCredential(siteId) {
  const { siteCredentials } = await import("./site");
  const { creds } = await siteCredentials(siteId);
  return creds.wordpress || null;
}

// The floor every published article is held to. Same number as the QA gate in
// lib/qa.js, on purpose: this agent is the safety net for anything that got
// past it or was published before the gate covered its format.
export const MIN_INTERNAL_LINKS = 2;

// A post naming a dozen providers does not need a dozen approvals in one go,
// and the queue is only useful if JB can actually clear it.
const MAX_BRAND_LINKS_PER_POST = 4;
const MAX_BRAND_LINKS_PER_SWEEP = 12;

// How far back the linking pass looks. Cheap: string work over posts already
// fetched, with no model call behind it.
const AUDIT_POSTS = 40;
// Brand names that are also ordinary English words. Matching is case sensitive
// and whole word, which handles most of them ("sage" the herb never matches
// "Sage"), but a sentence opening "Make sure you..." still would. For these
// names only, a sentence-initial mention is skipped rather than linked.
// A skipped mention is not a lost one: the scan carries on through the rest of
// the article, so a name that opens a table cell here and appears mid-sentence
// two paragraphs down is still linked on the second one.
const AMBIGUOUS_BRANDS = new Set([
  "Make", "Square", "Box", "Monday", "Meta", "Wise", "Sage", "Slack", "Notion",
  "Zoom", "Stripe", "Element", "Focus", "Origin", "Method", "Motion", "Front",
  "Craft", "Loop", "Pitch", "Simple", "Better", "Standard", "Mission", "Circle",
  "Later", "Simplified", "Float", "Bright", "Sorted", "Nimble", "Expensify",
]);

// Tags that end a sentence as surely as a full stop does. Inline tags are not
// on this list: <strong>Xero</strong> in the middle of a sentence is still in
// the middle of a sentence.
const BLOCK_TAG =
  /<\/?(p|div|h[1-6]|li|ul|ol|table|thead|tbody|tfoot|tr|td|th|br|hr|section|article|blockquote|figure|figcaption|header|footer)\b[^>]*>/gi;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decode = (s = "") =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");

/* --------------------------------------------- matching the model's text */

// The model is shown post HTML inside a JSON.stringify'd digest, and it copies
// what it sees: some of the time that is "government’s" as six literal
// characters, some of the time it is the real ’, and the post itself stores
// &#8217;. An exact includes() failed on all three mismatches, and it was
// failing on the replacement too: one Barbering post went live reading
// "it’s" before anyone noticed.
export const unescapeModelText = (s = "") =>
  String(s).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

// WordPress stores typographic characters as numeric entities.
const ENTITY = { "’": "&#8217;", "‘": "&#8216;", "“": "&#8220;", "”": "&#8221;", "–": "&#8211;", "—": "&#8212;", "…": "&#8230;", " ": "&nbsp;" };
const entitise = (s) => s.replace(/[’‘“”–—… ]/g, (c) => ENTITY[c]).replace(/&(?![#a-z0-9]+;)/gi, "&amp;");

/**
 * The run of `content` the model meant by `find`, as it is actually spelt in
 * the post, or null. Tries the text as given, with its escapes resolved, with
 * typographic characters as entities, and with entities as characters. Never
 * fuzzier than that: a spot that cannot be found character for character is
 * not edited.
 */
export function locate(content = "", find = "") {
  if (!find) return null;
  for (const v of new Set(spellings(find))) {
    if (v && content.includes(v)) return v;
  }
  return null;
}

/** The ways a piece of model text might be spelt in a stored post, in order. */
export function spellings(s = "") {
  const plain = unescapeModelText(s);
  return [s, plain, entitise(plain), decode(plain)];
}

const normUrl = (u = "") => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();

/** The hrefs a replacement would add. */
export const hrefsIn = (html = "") => [...String(html).matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);

/**
 * True when every link a replacement would add is already in the post. Two
 * thirds of the fleet's "failed" link suggestions on 29 September were this:
 * the sweep re-proposing a link an earlier sweep had already written, under a
 * different sentence, which the exact-text check then refused as missing.
 */
export function alreadyLinked(content = "", replaceWith = "") {
  const want = hrefsIn(replaceWith).map(normUrl);
  if (!want.length) return false;
  const have = new Set(hrefsIn(content).map(normUrl));
  return want.every((h) => have.has(h));
}

/**
 * True when a replacement changes nothing a reader sees except adding links:
 * the same words, in the same order, with some of them wrapped in <a>.
 *
 * An internal link is only allowed to be that. Measured on 29 September, about
 * 2,600 of the fleet's 2,900 auto-applied "internal links" were not: the model
 * wrote a new clause or sentence to hang the anchor on ("a caution mirrored in
 * the 200+ emissions cuts under way on UK dairy farms, McKinsey found"), and the
 * sweep published it. 39,000 words of copy nobody wrote or checked, in 538 live
 * articles, several of them chained through each other until the paragraph
 * stopped making sense. The Karl Foster quote was the same fault inside a
 * blockquote.
 */
export function linkOnly(find = "", replaceWith = "") {
  const text = (s) =>
    decode(unescapeModelText(s).replace(/<[^>]+>/g, ""))
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return text(find) === text(replaceWith) && hrefsIn(replaceWith).length > hrefsIn(find).length;
}

/** Thrown when the change is already on the site: nothing to do, nothing wrong. */
function alreadyDone(message) {
  const e = new Error(message);
  e.alreadyDone = true;
  return e;
}

/* ------------------------------------------------------- the linking pass */

// Replace the first occurrence of `anchor` that sits outside an existing link.
// Lifted from scripts/add-sources.js, which has been inserting anchors into
// live posts for weeks: never nest a link, never link inside a heading, never
// land inside a tag attribute. Kept as its own copy because that file is CJS
// and this one is an ES module.
export function linkify(html, anchor, url) {
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
  for (let i = 0; i < parts.length; i++) {
    if (/^<a\b/i.test(parts[i])) continue; // never nest a link
    const at = parts[i].indexOf(anchor);
    if (at < 0) continue;
    const before = parts[i].slice(0, at);
    if (/<h[1-6][^>]*>[^<]*$/i.test(before)) continue; // not inside a heading
    if (before.lastIndexOf("<") > before.lastIndexOf(">")) continue; // not inside a tag
    parts[i] =
      parts[i].slice(0, at) + `<a href="${url}">${anchor}</a>` + parts[i].slice(at + anchor.length);
    return { html: parts.join(""), ok: true };
  }
  return { html, ok: false };
}

export function internalLinkCount(html = "", host = null) {
  return host ? countLinksTo(html, host) : 0;
}

// The text a reader actually sees, minus anything already inside a link. Brand
// detection runs against this so an existing anchor, an image alt or an href
// can never be mistaken for an unlinked mention.
function visibleUnlinkedText(html = "") {
  return html
    .split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi)
    .filter((p) => !/^<a\b/i.test(p))
    .join(" ")
    // A block boundary has to survive as a boundary. Flattening every tag to a
    // space ran a heading ending "...no client names in prompts" straight into
    // a paragraph opening "Make this the headline rule", which read as Make
    // mid-sentence and proposed linking the automation tool over an ordinary
    // English verb. Same fault put a link under the word "Simplified" at the
    // head of a table column.
    .replace(BLOCK_TAG, " ¶ ")
    .replace(/<[^>]+>/g, " ");
}

const sentenceInitial = (text, at) => {
  const before = text.slice(Math.max(0, at - 60), at).replace(/\s+$/, "");
  return before === "" || /[.!?:;¶]$/.test(before);
};

/**
 * Every known brand this post names without linking. Matched on the stored name
 * exactly: "Microsoft UK" is not matched by the word "Microsoft", because
 * pointing a general mention at a specific product page is worse than leaving
 * it alone. Skips any brand whose domain already appears anywhere in the post,
 * so a link under different anchor text still counts as linked.
 */
export function unlinkedBrandMentions(html = "", brands = []) {
  const visible = visibleUnlinkedText(html);
  const found = [];
  for (const b of brands) {
    const name = (b.name || "").trim();
    if (!name || !b.website || name.length < 3) continue;

    let host;
    try {
      host = new URL(b.website).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (html.includes(host)) continue; // already linked somewhere in this post

    const re = new RegExp(`(?<![\\w'’-])${escapeRe(name)}(?![\\w'’])`, "g");
    let m;
    while ((m = re.exec(visible))) {
      if (AMBIGUOUS_BRANDS.has(name) && sentenceInitial(visible, m.index)) continue;
      found.push({ name, website: b.website });
      break;
    }
  }
  return found;
}

/**
 * The whole linking picture for a set of live posts. No model call, no cost.
 * Exported so the Engine Room and the SEO agent's turn can both report it.
 */
export function linkDebt(posts = [], brands = [], host = null) {
  return posts.map((p) => {
    const html = p.content?.rendered || "";
    const internal = internalLinkCount(html, host);
    return {
      id: p.id,
      url: p.link,
      title: decode(p.title?.rendered || ""),
      internalLinks: internal,
      shortBy: Math.max(0, MIN_INTERNAL_LINKS - internal),
      // A mention only counts if there is somewhere safe to put the link. The
      // CRM guide named Xero exactly once, inside an FAQ <h3>, and linkify
      // rightly refuses to link inside a heading: filed as a suggestion, that
      // put an item in the approval queue that could only ever fail when
      // approved. Detection means "linkable mention", not "mention".
      unlinkedBrands: unlinkedBrandMentions(html, brands)
        .filter((b) => linkify(html, b.name, b.website).ok)
        .slice(0, MAX_BRAND_LINKS_PER_POST),
    };
  });
}

/* ------------------------------------------------------------------ audit */

export async function runSeoAudit(site, wp) {
  const db = forSite(site.id);
  // Callers that already hold the context pass `wp` in; the cron route and the
  // manual wake do not, so it is fetched here rather than made their problem.
  if (!wp) wp = await wordpressCredential(site.id);
  if (!isSeoAgentConfigured(wp)) throw new Error("SEO agent not configured");

  // The host getting in the way is not this agent failing.
  //
  // A SiteGround challenge threw, which marked the SEO agent BLOCKED on the
  // Engine Room board and left it there until someone woke it by hand - twice
  // on 9 September, on Smart SME and Airport, while every article on both
  // titles published normally through the same WordPress. A blocked agent that
  // is only waiting for a host to calm down is a false alarm, and it hides the
  // real ones.
  let posts;
  try {
    posts = await fetchPosts(wp, AUDIT_POSTS);
  } catch (e) {
    if (e.retryable) return { summary: `Skipped: ${e.message.slice(0, 120)} Deferred to the next sweep.` };
    throw e;
  }
  const brands = await db.prBrand.findMany({
    where: { website: { not: null } },
    select: { name: true, website: true },
  });

  // Deterministic work first. This part cannot fail on a bad model reply, and
  // it is the part the operation was actually losing ground on.
  const debt = linkDebt(posts, brands);
  const short = debt.filter((d) => d.shortBy > 0);
  const brandsFiled = await fileBrandLinks(db, debt);

  // The site score, worked out rather than asked for: the share of recent
  // posts that meet the internal-link floor and name no company unlinked. The
  // model used to make this number up as part of the audit, so it moved with
  // the model's mood rather than with the site.
  const clean = debt.filter((d) => d.shortBy <= 0 && !d.unlinkedBrands.length).length;
  const siteScore = debt.length ? Math.round((clean / debt.length) * 100) : null;
  if (siteScore != null) {
    await db.engineSetting.upsert({
      where: { key: "seo_site_score" },
      update: { value: String(siteScore) },
      create: { key: "seo_site_score", value: String(siteScore) },
    });
  }

  // The linking picture is stored whole so the Engine Room can show it without
  // paying for another audit, and so a sweep that files nothing still leaves
  // evidence of what it looked at.
  const linkState = {
    at: new Date().toISOString(),
    postsAudited: debt.length,
    postsShortOfInternalLinks: short.length,
    unlinkedBrandMentions: debt.reduce((n, d) => n + d.unlinkedBrands.length, 0),
    worst: short
      .slice()
      .sort((a, b) => b.shortBy - a.shortBy)
      .slice(0, 10)
      .map((d) => ({ id: d.id, title: d.title, internalLinks: d.internalLinks, url: d.url })),
  };
  await db.engineSetting.upsert({
    where: { key: "seo_link_debt" },
    update: { value: JSON.stringify(linkState) },
    create: { key: "seo_link_debt", value: JSON.stringify(linkState) },
  });

  const summary =
    `${clean} of ${debt.length} recent posts fully linked. ` +
    (short.length ? `${short.length} short of internal links, picked up by the weekly linking pass.` : "Internal links all at the floor.");

  await db.engineSetting.upsert({
    where: { key: "seo_last_audit" },
    update: { value: JSON.stringify({ at: new Date().toISOString(), summary, internalGaps: short.length, brandLinksFiled: brandsFiled.filed }) },
    create: { key: "seo_last_audit", value: JSON.stringify({ at: new Date().toISOString(), summary, internalGaps: short.length, brandLinksFiled: brandsFiled.filed }) },
  });

  return {
    siteScore,
    added: brandsFiled.filed,
    postsAudited: debt.length,
    internalGaps: short.length,
    internalFiled: 0,
    brandLinksFiled: brandsFiled.filed,
    brandsNamed: brandsFiled.named,
    summary,
  };
}

/* ------------------------------------------------------------------ apply */

// Apply an approved suggestion via the WordPress REST API.
/**
 * True when a character offset sits inside a <blockquote>.
 *
 * A quote is the one part of a post that is somebody else's words. Interview
 * quotes are printed as said, and a link or a clause spliced into one puts
 * words in a real person's mouth. That is exactly what happened to the Karl
 * Foster interview on Barbering Business: after publication his quote gained
 * "a lesson echoed in the new mentoring push behind Mentored By Menspire's
 * weekly sessions", which he never said, because an auto-applied internal link
 * matched a phrase inside his blockquote. Edits there are refused outright.
 */
export function insideBlockquote(html, index) {
  if (index < 0) return false;
  const re = /<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (index >= m.index && index < m.index + m[0].length) return true;
  }
  return false;
}

export async function applySuggestion(site, suggestion, wp) {
  const db = forSite(site.id);
  const { updatePost } = await import("./wordpress");
  if (!wp) wp = await wordpressCredential(site.id);
  if (!isWordPressConfigured(wp)) throw new Error("No WordPress credential for this title");
  const payload = suggestion.payload ? JSON.parse(suggestion.payload) : null;

  // The search result line and description (Yoast), from the weekly
  // nearly-there job. The headline on the page is left alone, so this is safe
  // on any post, interviews included.
  if (suggestion.kind === "title_update" && (payload?.seoTitle || payload?.metaDesc) && suggestion.wpPostId) {
    await updatePost(wp, suggestion.wpPostId, {
      meta: {
        ...(payload.seoTitle ? { _yoast_wpseo_title: unescapeModelText(payload.seoTitle) } : {}),
        ...(payload.metaDesc ? { _yoast_wpseo_metadesc: unescapeModelText(payload.metaDesc) } : {}),
      },
    });
    return;
  }

  if (suggestion.kind === "title_update" && payload?.newTitle && suggestion.wpPostId) {
    // An interview's title carries the franchise-eyebrow span, and that span is
    // what files it in the Leaders hub. The audit reads it as stray markup and
    // proposes "stripping" it; a leak of the span as text is fixed where the
    // title is printed (cogent_plain_title), never by editing the title.
    const post = await fetchPost(wp, suggestion.wpPostId, { edit: true });
    if (/franchise-eyebrow/.test(post?.title?.raw || post?.title?.rendered || "")) {
      throw new Error("interview titles carry the Leaders hub eyebrow span and are never retitled by the audit");
    }
    await updatePost(wp, suggestion.wpPostId, { title: unescapeModelText(payload.newTitle) });
    return;
  }

  // A brand link carries the company and its URL rather than a text diff, and
  // the insertion point is worked out against the live post at this moment. If
  // the copy has changed since the sweep, or someone has linked it in the
  // meantime, this fails loudly rather than writing the link somewhere odd.
  if (suggestion.kind === "brand_link" && payload?.anchor && payload?.url && suggestion.wpPostId) {
    const post = await fetchPost(wp, suggestion.wpPostId, { edit: true });
    if (!post) throw new Error("post not found");
    const content = storedContent(post);
    if (alreadyLinked(content, `href="${payload.url}"`)) throw alreadyDone(`${payload.anchor} is already linked in this post`);
    const r = linkify(content, payload.anchor, payload.url);
    if (!r.ok) throw new Error(`"${payload.anchor}" is no longer present outside an existing link`);
    // Where linkify chose to write is the first character the two versions
    // disagree on.
    let at = 0;
    while (at < content.length && content[at] === r.html[at]) at++;
    if (insideBlockquote(content, at)) throw new Error(`"${payload.anchor}" is inside a quote, which is never edited`);
    await updatePost(wp, suggestion.wpPostId, { content: r.html });
    return;
  }

  if (
    (suggestion.kind === "internal_link" || suggestion.kind === "content_edit") &&
    payload?.find &&
    payload?.replaceWith &&
    suggestion.wpPostId
  ) {
    // Was a 30-post list scanned for a match, which silently could not find
    // anything older than the last 30 articles. Fetch the one post by id.
    const post = await fetchPost(wp, suggestion.wpPostId, { edit: true });
    if (!post) throw new Error("post not found");
    const content = storedContent(post);
    const replaceWith = unescapeModelText(payload.replaceWith);
    if (suggestion.kind === "internal_link" && alreadyLinked(content, replaceWith)) {
      throw alreadyDone("the post already links to this destination");
    }
    // Checked here as well as at filing, because the queue still holds
    // suggestions filed before the rule existed.
    if (suggestion.kind === "internal_link" && !linkOnly(payload.find, replaceWith)) {
      throw new Error("adds words as well as a link; an internal link may only wrap text already in the post");
    }
    const find = locate(content, payload.find);
    if (!find) throw new Error("target text no longer present in post");
    // String.replace edits the first occurrence, so that is the one checked.
    if (insideBlockquote(content, content.indexOf(find))) {
      throw new Error("target text is inside a quote, which is never edited");
    }
    // A function, not the string: replaceWith is model text, and a "$&" or
    // "$1" in it would otherwise be read as a replacement pattern.
    await updatePost(wp, suggestion.wpPostId, {
      content: content.replace(find, () => replaceWith),
    });
    return;
  }
  // "advice" and anything without an appliable payload: approving just records it.
}

// The copy as stored. context=edit is an editor-capability read, so raw is
// normally there; rendered is the fallback for a host that strips it.
function storedContent(post) {
  return post.content?.raw ?? post.content?.rendered ?? "";
}

/** Where a suggestion goes when applying it threw. Shared by every caller. */
export function outcomeFor(e) {
  if (e?.alreadyDone) return { status: "dismissed", error: `already done: ${e.message}`.slice(0, 300) };
  return { status: "failed", error: e?.message?.slice(0, 300) };
}
