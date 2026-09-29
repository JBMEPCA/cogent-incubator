// The SEO title: what Google shows in place of the headline.
//
// Measured 11 September 2026, the fleet's rendered title tags had a median of
// 89 to 107 characters against the ~60 Google shows, so nearly every result was
// cut off mid-clause. scripts/shorten-seo-titles.mjs fixed 228 posts on five
// titles by hand, but the publisher never set one, so by 29 September every
// post since and all five of the 18 September titles were back over: 80% of
// the fleet's recent posts. This is the same rule, applied at publish.
//
// Setting _yoast_wpseo_title explicitly does two things: the title is shorter,
// and Yoast stops appending " - <Site Name>", because an explicit title is the
// whole template for that post. Written through the REST API it also goes in on
// a real save, so Yoast rebuilds its indexable and the front end changes; the
// update_post_meta route did not, and wasted an hour on 11 September.
import Anthropic from "@anthropic-ai/sdk";

// Google shows roughly 60. 70 is the ceiling for a DERIVED title, because a
// title a few over still beats the same title with the site name bolted on.
// A written one is held to 60, since there is no reason to write it long.
const CEILING = 70;
const WRITTEN_MAX = 60;
// The quality guard. A colon split can produce a head that is short and
// generic rather than short and specific ("Hair Loss Awareness Month"), which
// says less than the truncation it replaces.
const FLOOR = 30;
const MIN_WORDS = 4;

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** The headline as a reader sees it: no eyebrow span, no entities. */
export function plainTitle(title = "") {
  return String(title)
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // The eyebrow span's emoji survives tag stripping; it has no place in a
    // search result.
    .replace(/^[^\p{L}\p{N}"'‘“£$€]+/u, "");
}

/**
 * The SEO title derivable from the headline alone, or null. The house format
 * is "news hook: explainer for the trade", and the hook is the news and what
 * the reader typed, so where a headline splits cleanly the hook is the title.
 * Never truncates: a headline that does not split is left for a writer.
 */
export function deriveSeoTitle(title = "") {
  const full = plainTitle(title);
  if (!full) return null;
  if (full.length <= CEILING) return full;
  const m = full.match(new RegExp(`^(.{${FLOOR},}?)\\s*[:—–]\\s+\\S`, "u"));
  if (!m) return null;
  const head = m[1].trim();
  if (head.length >= FLOOR && head.length <= CEILING && words(head) >= MIN_WORDS) return head;
  return null;
}

/** Whether a written title is fit to go live. */
export function acceptableSeoTitle(t = "") {
  const s = String(t).trim();
  return (
    s.length >= FLOOR &&
    s.length <= WRITTEN_MAX &&
    words(s) >= MIN_WORDS &&
    !/[—]/.test(s) && // house rule: no em dashes
    !/[<>]/.test(s) &&
    !/\.\.\.|…$/.test(s)
  );
}

const SYSTEM = `You write the search result title for trade magazine articles: the line Google shows, not the headline on the page.

Rules:
- ${FLOOR} to ${WRITTEN_MAX} characters including spaces. Count carefully.
- Lead with the news: the named company, person, place or number, then what happened. Keep the specific detail a searcher would type; drop the explanation of why it matters.
- Never add the magazine's name. Never end with "..." or cut a thought off.
- Plain text. British English. Never use an em dash; use a colon or comma.
- Keep any proper nouns and figures exactly as given.
- Match the headline's capitalisation: a Title Case headline gets a Title Case title, a sentence case one stays sentence case.
- Never add a fact, claim or angle that is not in the headline. Never change who did what. Shorten by dropping words, not by rewording the facts: if golfers bid through a platform, the platform does not bid.

Return one entry per id you are given.`;

const TITLES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titles"],
  properties: {
    titles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title"],
        properties: { id: { type: "string" }, title: { type: "string" } },
      },
    },
  },
};

/**
 * Written SEO titles for headlines that do not split, in one call. Returns a
 * map of id to title holding only the ones that pass acceptableSeoTitle, so a
 * caller can never write a bad one; anything missing is simply left alone.
 */
// Sonnet, not Haiku: a dry run on 29 September had Haiku inventing an angle
// ("BCC warns on barbershop pricing") and garbling a clause, and this text is
// the first thing a searcher reads. It is a hundred short titles, once.
export async function writeSeoTitles(items = [], { model = "claude-sonnet-5", onReject } = {}) {
  if (!items.length || !process.env.ANTHROPIC_API_KEY) return {};
  const client = new Anthropic();
  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    // Enforced rather than asked for: a headline with a quoted phrase in it
    // ("Feeling the Heat") came back as unescaped JSON and threw away the
    // whole batch of 25.
    output_config: { format: { type: "json_schema", schema: TITLES_SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify(items.map((i) => ({ id: String(i.id), headline: plainTitle(i.title) }))),
      },
    ],
  });
  try {
    (await import("./agents/meter")).recordUsage(res.model || model, res.usage);
  } catch {}
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  let parsed;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return {};
  }
  const out = {};
  for (const { id, title } of parsed?.titles || []) {
    const s = String(title || "").trim();
    if (acceptableSeoTitle(s)) out[id] = s;
    else onReject?.(id, s);
  }
  return out;
}

/**
 * The SEO title for a post about to be published: derived if the headline
 * allows it, otherwise written. Never throws: a publish must not fail over a
 * title tag, and a post without one simply falls back to Yoast's template.
 */
export async function seoTitleFor(title) {
  const derived = deriveSeoTitle(title);
  if (derived) return derived;
  try {
    return (await writeSeoTitles([{ id: "x", title }]))["x"] || null;
  } catch {
    return null;
  }
}
