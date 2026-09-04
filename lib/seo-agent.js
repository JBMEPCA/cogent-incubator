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
//   - Internal links go to the model, because choosing which of forty articles
//     genuinely belongs in a given sentence, and what the anchor text should
//     say, is the part that needs judgement.
import Anthropic from "@anthropic-ai/sdk";
import { forSite } from "./prisma";
import { fetchPosts, fetchPost, isWordPressConfigured } from "./wordpress";
import { isDraftingConfigured } from "./drafting";
import { countLinksTo, siteHost, titleBrief } from "./voice";

const AUDIT_MODEL = "claude-sonnet-5";

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
// How many posts the model is asked to read for internal linking. Their full
// content goes into the prompt, so this is the number that costs money — and,
// via the MUST FIX list, the number that decides how much the reply has to
// contain. Fifteen posts at 4,000 characters each was what kept running past
// the token ceiling and losing the whole sweep, so both numbers came down. The
// pass runs twice a day: ten posts that come back beats fifteen that do not.
const MODEL_POSTS = 10;
// Characters of each post's HTML sent for review. Enough to find a natural
// anchor point and quote it back verbatim, without shipping whole articles.
const MODEL_POST_CHARS = 2500;

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

/* ---------------------------------------------------------- the model pass */

const AUDIT_SYSTEM = (site) => `${titleBrief(site)}

You are the SEO analyst. Treat the site as one with limited domain authority: wins come from long-tail keywords, tight internal linking, and technical hygiene.

YOUR FIRST DUTY IS INTERNAL LINKING, and it is not optional. You will be given a MUST FIX list of live posts carrying fewer than the required number of internal links. Every post on that list has to come back with enough internal_link suggestions to close its gap. That comes before titles, before metadata, before any general advice. An audit that returns clever advice while a post on the MUST FIX list still has no internal links is a failed audit.

Brand links are handled in code and are NOT your job: do not propose linking a company name to its own website, that has already been done.

A related-reading block is already built and live. Every article page ends with a theme-generated block carrying three more posts from the same section, one similar piece from another section, the category hub and the post tags, all as real crawlable anchors. You cannot see it because you are shown the post content from the REST API and the block is added by the theme at render time. Never file advice asking for a related-posts block, a related-reading block, a read-next module or a standing internal-link template: that work is done, and it has been proposed on every title for a fortnight. Your job is the contextual in-body links the template cannot write.

You will receive the site's current published posts. Respond with ONLY valid JSON (no code fences):
{
  "site_score": <0-100 overall SEO health for a site at this stage>,
  "summary": "<one sentence on the site's biggest lever right now>",
  "suggestions": [
    {
      "kind": "internal_link" | "title_update" | "content_edit" | "advice",
      "wp_post_id": <post id or null>,
      "title": "<short imperative label, max 70 chars>",
      "detail": "<2-3 sentences: what to change and why it helps rankings/traffic>",
      "impact": <1-100 estimated benefit>,
      "payload": {"find": "<exact existing text>", "replaceWith": "<replacement html>"} | {"newTitle": "..."} | null
    }
  ]
}

Rules:
- internal_link / content_edit MUST include payload.find that appears VERBATIM in that post's content HTML (copy it exactly, character for character), and replaceWith containing the change. Keep edits surgical: one sentence or phrase.
- internal_link means linking one existing post to another existing post with descriptive anchor text. Use only URLs from the post lists you are given. Never invent a URL, and never link a post to itself.
- Anchor text must describe what the reader will get. Never "click here", "this article" or "read more".
- Every internal_link must be genuinely relevant. If a post on the MUST FIX list has no honest connection to anything else on the site, say so as an "advice" item naming that post, rather than forcing a link that reads as spam. That is the ONLY acceptable reason to leave a MUST FIX post short.
- title_update needs payload.newTitle.
- advice = anything not auto-appliable (site-level, new content ideas, technical); payload null.
- Order the list by impact, highest first. An internal link closing a MUST FIX gap is worth 75 or more.
- Return the MUST FIX internal links plus at most 4 other suggestions, and never more than 12 suggestions in total. If more than 12 would be needed, return the highest-impact 12 and note the rest in a single advice item: the next sweep runs within twelve hours and will take the remainder. A reply that runs past the token ceiling is thrown away in full, so a complete list is worth more than an exhaustive one.
- Keep every "detail" to two sentences, and every payload.find to the shortest unique run of text that identifies the spot, never a whole paragraph.
- Never suggest something already done.
- House rule: never use em dashes (—) in any text you write, including replaceWith content and titles. Use commas or colons instead.`;

/* ------------------------------------------------------------- brand links */

// Brand links need no model call: the company is named in the copy and its URL
// is in the PrBrand table. Written straight to the queue as appliable
// suggestions, each re-verified against the live post at apply time.
// Takes the scoped handle. Same fault as the Researcher's existingTitles(): it
// reached for a module-level `db` that has not existed since the multi-tenant
// split, so the SEO Expert threw "db is not defined" the moment it found any
// unlinked brand at all — the exact half of its job the goal in registry.js
// puts first.
async function fileBrandLinks(db, debt) {
  let filed = 0;
  const named = [];

  for (const post of debt) {
    for (const brand of post.unlinkedBrands) {
      if (filed >= MAX_BRAND_LINKS_PER_SWEEP) return { filed, named };

      const title = `Link "${brand.name}" to its own site: ${post.title.slice(0, 45)}`.slice(0, 120);
      // Dismissed counts as an answer and is not asked again. Applied cannot
      // recur anyway: once the link is in the post, the brand's domain is
      // present and the detection pass stops seeing it.
      const answered = await db.seoSuggestion.findFirst({
        where: { title, status: { in: ["pending", "dismissed"] } },
      });
      if (answered) continue;

      await db.seoSuggestion.create({
        data: {
          kind: "brand_link",
          wpPostId: post.id,
          targetUrl: post.url || null,
          title,
          detail: `This article names ${brand.name} but does not link it. Linking a named company on first mention helps the reader, and it is the mention the Backlink Manager then asks them to return. Applying this links the first mention that is not already inside a link.`,
          impact: 80,
          payload: JSON.stringify({ anchor: brand.name, url: brand.website }),
        },
      });
      filed++;
      named.push(brand.name);
    }
  }
  return { filed, named };
}

/* ------------------------------------------------- the audit reply shape */

// Enforced by the API rather than asked for in prose. The whole class of failure
// this agent kept hitting was "the model's JSON did not parse", and a schema
// removes it: no code fences to strip, no half-written object to salvage.
//
// payload carries every variant's fields as nullables because a strict schema
// cannot vary its shape per item; the nulls are stripped before anything is
// stored. anyOf rather than type: ["integer", "null"] — both are valid JSON
// Schema, but anyOf is the form the structured-outputs docs list as supported,
// and a schema the API rejects is a 400 that takes the whole sweep down, which
// would be worse than the truncation this replaces.
export const AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["site_score", "summary", "suggestions"],
  properties: {
    site_score: { type: "integer" },
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "wp_post_id", "title", "detail", "impact", "payload"],
        properties: {
          kind: { type: "string", enum: ["internal_link", "title_update", "content_edit", "advice"] },
          wp_post_id: { anyOf: [{ type: "integer" }, { type: "null" }] },
          title: { type: "string" },
          detail: { type: "string" },
          impact: { type: "integer" },
          payload: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["find", "replaceWith", "newTitle"],
                properties: {
                  find: { anyOf: [{ type: "string" }, { type: "null" }] },
                  replaceWith: { anyOf: [{ type: "string" }, { type: "null" }] },
                  newTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ audit */

export async function runSeoAudit(site, wp) {
  const db = forSite(site.id);
  // Callers that already hold the context pass `wp` in; the cron route and the
  // manual wake do not, so it is fetched here rather than made their problem.
  if (!wp) wp = await wordpressCredential(site.id);
  if (!isSeoAgentConfigured(wp)) throw new Error("SEO agent not configured");

  const posts = await fetchPosts(wp, AUDIT_POSTS);
  const brands = await db.prBrand.findMany({
    where: { website: { not: null } },
    select: { name: true, website: true },
  });

  // Deterministic work first. This part cannot fail on a bad model reply, and
  // it is the part the operation was actually losing ground on.
  const debt = linkDebt(posts, brands);
  const short = debt.filter((d) => d.shortBy > 0);
  const brandsFiled = await fileBrandLinks(db, debt);

  const digest = posts.slice(0, MODEL_POSTS).map((p) => ({
    id: p.id,
    url: p.link,
    title: decode(p.title?.rendered || ""),
    internal_links: internalLinkCount(p.content?.rendered || "", siteHost(site)),
    content: (p.content?.rendered || "").slice(0, MODEL_POST_CHARS),
  }));
  const seen = new Set(digest.map((d) => d.id));
  // Posts outside the digest are still valid destinations, so the model gets
  // their titles and URLs even though it is not reading their copy.
  const otherDestinations = debt
    .filter((d) => !seen.has(d.id))
    .map((d) => `- "${d.title}" ${d.url}`)
    .join("\n");
  const mustFix = short
    .filter((d) => seen.has(d.id))
    .map(
      (d) => `- post ${d.id} "${d.title}" has ${d.internalLinks} internal link(s), needs ${d.shortBy} more`
    )
    .join("\n");

  const client = new Anthropic();
  // STREAMED, and that is not a style choice. A non-streaming request is refused
  // outright past roughly 21k max_tokens ("streaming is required for operations
  // that may take longer than 10 minutes"), which is what made 32000 fail before
  // the call rather than at the ceiling. Streaming lifts that limit, so the
  // ceiling can be generous again and the work does not have to be shrunk to fit
  // a restriction that only ever applied to the non-streaming path.
  const res = await client.messages.stream({
    // Sonnet. The sweep reads 40 live posts and reports which ones breach the
    // internal-link floor and which brands are unlinked — matching content
    // against rules that are already written down, not deciding anything a
    // reader sees. Its output is a list of suggestions that JB approves by
    // hand before any of it touches the site, so a weaker judgement here costs
    // an approval click, not a published mistake.
    model: AUDIT_MODEL,
    // Was 3000, then 8000, then 20000, and it still truncated: a sweep on
    // 14 August burned $0.64 and returned nothing at all, because a reply cut
    // off at the ceiling is unparseable JSON and the whole audit is lost.
    // Adaptive thinking spends from this same budget, so on a sweep with
    // several MUST FIX gaps the model can think past the ceiling before it
    // writes a character.
    //
    // Raising the number is what failed all three times, and it cannot go
    // higher: past roughly 21k the SDK refuses a non-streaming request outright
    // ("streaming is required for operations that may take longer than 10
    // minutes"), so 32000 does not fail at the ceiling, it fails before the
    // call. The ceiling is not the lever.
    //
    // The WORK is bounded too — fewer posts per sweep, less content per post, a
    // hard cap on suggestions and short verbatim finds (see MODEL_POSTS, the
    // content slice below, and AUDIT_SYSTEM). That remains the right instinct;
    // it is just no longer compensating for a ceiling that cannot be raised.
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    // Adaptive thinking spends from the same budget as the reply, so the way to
    // stop it thinking past the ceiling is to bound the thinking, not to keep
    // enlarging the ceiling. This is the lever the previous three attempts were
    // missing. Medium is ample for an audit over fifteen posts.
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: AUDIT_SCHEMA },
    },
    system: AUDIT_SYSTEM(site),
    messages: [
      {
        role: "user",
        content:
          `MUST FIX, posts below the floor of ${MIN_INTERNAL_LINKS} internal links:\n${
            mustFix || "(none among the posts below, the floor is met)"
          }\n\n` +
          (otherDestinations
            ? `Other live posts you may link TO (title and URL only):\n${otherDestinations}\n\n`
            : "") +
          `Published posts (${digest.length}):\n${JSON.stringify(digest)}`,
      },
    ],
  }).finalMessage();
  try {
    (await import("./agents/meter")).recordUsage(res.model || AUDIT_MODEL, res.usage);
  } catch {}
  if (res.stop_reason === "refusal") throw new Error("audit refused");

  // A truncated or unparseable reply used to THROW here, which discarded the
  // brand links fileBrandLinks() had already committed above and left the agent
  // parked on "blocked" — a red light in the Engine Room for a sweep that half
  // succeeded. The deterministic linking pass is the half of this agent's job
  // the operation was losing ground on, so it is reported either way and the
  // model's contribution simply degrades to nothing.
  let parsed = null;
  let modelNote = null;
  if (res.stop_reason === "max_tokens") {
    modelNote = "the model's reply hit the token ceiling, so only the link work was filed";
  } else {
    let text = "";
    for (const b of res.content) if (b.type === "text") text += b.text;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      modelNote = "the model's reply did not parse, so only the link work was filed";
    }
  }

  let added = 0;
  let internalFiled = 0;
  for (const s of parsed?.suggestions || []) {
    if (!s.title || !s.kind) continue;
    if (s.kind === "brand_link") continue; // written in code, never taken from the model
    const dupe = await db.seoSuggestion.findFirst({
      where: { title: s.title, status: "pending" },
    });
    if (dupe) continue;
    // The schema has to declare every payload variant's fields on one object, so
    // an item carries nulls for the ones its kind does not use. Drop them, or
    // applySuggestion's `payload?.find && payload?.replaceWith` checks would be
    // reading keys that exist only to satisfy the schema.
    const payload = Object.fromEntries(
      Object.entries(s.payload || {}).filter(([, v]) => v != null && v !== "")
    );
    await db.seoSuggestion.create({
      data: {
        kind: s.kind,
        wpPostId: s.wp_post_id || null,
        title: s.title.slice(0, 120),
        detail: s.detail || "",
        impact: Math.min(100, Math.max(1, s.impact || 50)),
        payload: Object.keys(payload).length ? JSON.stringify(payload) : null,
      },
    });
    added++;
    if (s.kind === "internal_link") internalFiled++;
  }

  // Only overwrite the stored score when this sweep actually produced one. A
  // degraded sweep writing 0 would report the site's SEO health as rock bottom
  // on the strength of a truncated reply.
  const siteScore = parsed?.site_score == null ? null : Math.min(100, Math.max(0, parsed.site_score));
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

  // A degraded sweep still says what it did, so "1 blocked" is never the only
  // account of a run that filed real work.
  const summary =
    parsed?.summary ||
    `Filed ${brandsFiled.filed} brand link${brandsFiled.filed === 1 ? "" : "s"} across ` +
      `${debt.length} posts${modelNote ? ` — ${modelNote}` : ""}.`;

  const auditRecord = {
    at: new Date().toISOString(),
    summary,
    posts: digest.length,
    internalGaps: short.length,
    brandLinksFiled: brandsFiled.filed,
    ...(modelNote ? { degraded: modelNote } : {}),
  };
  await db.engineSetting.upsert({
    where: { key: "seo_last_audit" },
    update: { value: JSON.stringify(auditRecord) },
    create: { key: "seo_last_audit", value: JSON.stringify(auditRecord) },
  });

  return {
    siteScore,
    added: added + brandsFiled.filed,
    posts: digest.length,
    postsAudited: debt.length,
    internalGaps: short.length,
    internalFiled,
    brandLinksFiled: brandsFiled.filed,
    brandsNamed: brandsFiled.named,
    summary,
  };
}

/* ------------------------------------------------------------------ apply */

// Apply an approved suggestion via the WordPress REST API.
export async function applySuggestion(site, suggestion, wp) {
  const db = forSite(site.id);
  const { updatePost } = await import("./wordpress");
  if (!wp) wp = await wordpressCredential(site.id);
  if (!isWordPressConfigured(wp)) throw new Error("No WordPress credential for this title");
  const payload = suggestion.payload ? JSON.parse(suggestion.payload) : null;

  if (suggestion.kind === "title_update" && payload?.newTitle && suggestion.wpPostId) {
    await updatePost(wp, suggestion.wpPostId, { title: payload.newTitle });
    return;
  }

  // A brand link carries the company and its URL rather than a text diff, and
  // the insertion point is worked out against the live post at this moment. If
  // the copy has changed since the sweep, or someone has linked it in the
  // meantime, this fails loudly rather than writing the link somewhere odd.
  if (suggestion.kind === "brand_link" && payload?.anchor && payload?.url && suggestion.wpPostId) {
    const post = await fetchPost(wp, suggestion.wpPostId);
    if (!post) throw new Error("post not found");
    const content = post.content?.rendered || "";
    const r = linkify(content, payload.anchor, payload.url);
    if (!r.ok) throw new Error(`"${payload.anchor}" is no longer present outside an existing link`);
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
    const post = await fetchPost(wp, suggestion.wpPostId);
    if (!post) throw new Error("post not found");
    const content = post.content?.rendered || "";
    if (!content.includes(payload.find)) throw new Error("target text no longer present in post");
    await updatePost(wp, suggestion.wpPostId, {
      content: content.replace(payload.find, payload.replaceWith),
    });
    return;
  }
  // "advice" and anything without an appliable payload: approving just records it.
}
