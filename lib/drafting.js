// The Content Engine's drafting agent: turns shortlisted wire stories into
// rewritten articles and SEO ideas into original pieces. Requires
// ANTHROPIC_API_KEY; callers must check isDraftingConfigured() first.
import Anthropic from "@anthropic-ai/sdk";
import { forSite } from "./prisma";
import { recordUsage } from "./agents/meter";
import { houseStyle, siteHost, userAgent, editorialStandard, untrustedBlock } from "./voice";

export function isDraftingConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Writing an article is Opus work and stays that way: the draft IS the product,
// and there is nothing to save by making it worse. Fixing a draft against a
// list of faults somebody else wrote is not the same job, so it does not pay
// the same rate. See repairArticle.
// The first draft is the largest block of output tokens in the whole pipeline —
// roughly 2,300 words — and output tokens are where the model choice actually
// costs. Measured over 8 days to 18 Aug 2026, the Editor was 71% of Smart SME's
// spend and 76% of Fleet's, and Smart SME was running at $0.610 per PUBLISHED
// article against a target of $0.20.
//
// So the draft moves to Sonnet and the QA gate in lib/qa.js STAYS on Opus. That
// is the deliberate shape of this change: the expensive model belongs where
// judgement happens, not where volume happens. The gate is what has caught
// fabricated sources and defunct companies, and it keeps full Opus reasoning.
// The repair pass was already Sonnet and is unchanged.
//
// This is shared code: it changes Smart SME, Fleet and Golf together. Reverting
// is this one line back to "claude-opus-4-8". If drafting quality drops, that is
// the first thing to undo — check the QA hold rate per title before concluding,
// because a rise in first-pass holds is the signal, not vibes.
const DRAFT_MODEL = "claude-sonnet-5";
const REPAIR_MODEL = "claude-sonnet-5";

// What counts as enough to write a news piece from. A direct feed fetches about
// 1,600 words of real article; a Google News link fetches two. That gap is not a
// judgement call, so it is a floor in code rather than a model decision.
const MIN_SOURCE_WORDS = 50;
const MIN_SUMMARY_WORDS = 25;

/** Visible words, tags stripped. Used by the pre-draft gate. */
function countWords(t) {
  return String(t || "")
    .replace(/<[^>]+>/g, " ")
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean).length;
}

/** This title's WordPress credential, for entry points handed only a site. */
async function wordpressCredential(siteId) {
  const { siteCredentials } = await import("./site");
  const { creds } = await siteCredentials(siteId);
  return creds.wordpress || null;
}

async function fetchSourceText(url, ua) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "user-agent": ua },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    // Crude readability: drop scripts/styles/tags, collapse whitespace.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 12000) || null;
  } catch {
    return null;
  }
}

function buildPrompt(site, article, sourceText, brandName) {
  const host = siteHost(site) || "this site";
  const readers = site?.audience || "the reader";
  if (article.type === "pr_rewrite") {
    return `Rewrite the following announcement from ${brandName || "the source"} as a news article for ${site?.name || "this publication"} (400-600 words).

This is the news-rewrite format in the editorial standard you were given. It was
taken apart from the titles that beat us on news, so follow the shape closely.

Structure:
- HEADLINE carries TWO hooks: the thing that happened AND a number. Not one or the other.
- Then a STANDFIRST: one sentence holding the whole story, naming who did what, and
  carrying a short quote fragment if the source gives you a real one.
- The first sentence of the body repeats the standfirst almost verbatim. That
  repetition is deliberate and correct, not an error to fix.
- The second sentence is concrete and physical: what the thing actually is, where
  it sits, what it costs, when it starts.
- Paragraphs of two to four sentences throughout.

Requirements:
- Fresh headline and structure. Do not copy sentences from the source.
- Open with why this matters to ${readers}.
- Attribute the news clearly to ${brandName || "the source"} and include one link to the original: <a href="${article.sourceUrl}">${brandName || "source"}</a>.
- INTERNAL LINKS ARE MANDATORY IN THIS FORMAT TOO. Weave 2 to 4 links to existing ${host} articles, taken from the article list you were given, into the body with descriptive anchor text. Every news piece published on 3 and 4 August 2026 went out with none, and it is the cheapest ranking win the site has. A news piece with fewer than 2 will be held by QA and written again.
- Link every company you name to its own website on first mention, ${brandName || "the source"} included.
- THE READER ANGLE IS THE ONLY ORIGINAL THING HERE. The titles we are competing with
  add commentary the original announcement did not have, and that addition is the
  entire reason their version deserves to exist. Give the reader the judgement:
  who this helps, who it does not, what it costs them, what to do about it.
- NEVER invent a quote, a commentator, an analyst or a statistic to fill that role.
  If the source carries no usable comment, the piece runs shorter without one.
  A fabricated source is a failure of the job, not a stylistic shortfall.
- Close with a short practical takeaway for ${readers}.

PRE-FLIGHT, before you emit. Every one of these killed a finished article last
weekend, at full cost, for an error thirty seconds of checking prevents:
- Recompute every percentage and fraction you state. 26% with a policy leaves
  74% without - not two-thirds. If your prose paraphrases a number, redo the
  arithmetic from the figure, never from the vibe.
- Every number and named thing in your HEADLINE must appear in the body. A
  seven-routes headline over a six-route list is a kill.
- Every date must match its weekday for the actual 2026 calendar; if the source
  gives a date you cannot reconcile, drop the weekday.
- A figure in a table must agree with the same figure in your prose.
- Never cite a preview, staging or noindex URL as the source; link the live page.
- If the source of a comparison is itself a competitor of the products compared,
  say so in the body.
- One standfirst echo only: the first body sentence repeats the standfirst, and
  nothing else in the piece repeats anything.

Original title: ${article.title}

${
  sourceText
    ? untrustedBlock(sourceText, "SOURCE MATERIAL, fetched from the announcement page")
    : "Source page unavailable. Write from the title alone, staying strictly factual and general; do not invent specific claims, figures or quotes."
}`;
  }
  return `Write an original SEO article for ${site?.name || "this publication"} (1,200-1,800 words; depth wins rankings).
Cover the topic properly: practical detail, realistic examples with UK pricing, a comparison
table where tools are compared (<table> HTML), and end with an FAQ section of 4-5 real
questions (<h3> per question) before the "What to do next" steps.

Topic/working title: ${article.title}
${article.category ? `Commissioned for the ${article.category} section, so emit exactly that as CATEGORY. If the article you have actually written plainly does not belong there, emit the honest section instead and it will be filed correctly, but do not drift on a technicality.` : ""}
${article.keywords ? `Target keywords (work them in naturally, especially in the headline and first paragraph): ${article.keywords}` : ""}
${article.brief ? `COMMISSIONING BRIEF from the publisher. This is what was actually asked for, so it wins over any assumption you would otherwise make about the angle:\n${article.brief}` : ""}

Requirements:
- Structure for search: a keyword-bearing headline, a direct answer to the implied question in the first two paragraphs, then <h2> sections covering the details.
- Concrete and practical: UK-specific facts (named authorities, official rates and thresholds, UK pricing in £) where relevant; realistic examples drawn from the working life of ${readers}.
- No fluff, no invented statistics; where a claim needs a source you don't have, phrase it generally.
- End with a short "What to do next" section of 3–4 action steps.

PRE-FLIGHT, before you emit. Every one of these killed a finished article last
weekend, at full cost, for an error thirty seconds of checking prevents:
- Recompute every percentage and fraction you state. 26% with a policy leaves
  74% without - not two-thirds. If your prose paraphrases a number, redo the
  arithmetic from the figure, never from the vibe.
- Every number and named thing in your HEADLINE must appear in the body. A
  seven-routes headline over a six-route list is a kill.
- Every date must match its weekday for the actual 2026 calendar; if the source
  gives a date you cannot reconcile, drop the weekday.
- A figure in a table must agree with the same figure in your prose.
- Never cite a preview, staging or noindex URL as the source; link the live page.
- If the source of a comparison is itself a competitor of the products compared,
  say so in the body.
- One standfirst echo only: the first body sentence repeats the standfirst, and
  nothing else in the piece repeats anything.`;
}

// Find a commercially usable image via Openverse (keyless). CC0/public-domain
// first (no attribution needed); falls back to any commercial licence with credit.
export async function findImage(query, ua = "Mozilla/5.0 (compatible; CogentBot/1.0)") {
  const search = async (params) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&per_page=10&filter_dead=true&${params}`,
        { headers: { "user-agent": ua }, signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) return [];
      return (await res.json()).results || [];
    } catch {
      return [];
    }
  };
  let results = await search("license=cc0,pdm");
  let needsCredit = false;
  if (!results.length) {
    results = await search("license_type=commercial");
    needsCredit = true;
  }
  // Provider URLs are frequently dead (Openverse's filter_dead is unreliable) —
  // only return a URL we have actually downloaded successfully. The
  // Openverse-proxied thumbnail is the dependable fallback per candidate.
  const validates = async (url) => {
    if (!url) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { "user-agent": ua },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      if (!(res.headers.get("content-type") || "").startsWith("image/")) return false;
      const buf = await res.arrayBuffer();
      return buf.byteLength > 15000;
    } catch {
      return false;
    }
  };
  const candidates = results
    .sort((a, b) => ((b.width || 0) >= 800 ? 1 : 0) - ((a.width || 0) >= 800 ? 1 : 0))
    .slice(0, 6);
  for (const pick of candidates) {
    for (const url of [pick.url, pick.thumbnail]) {
      if (await validates(url)) {
        return {
          url,
          credit: needsCredit && pick.creator
            ? `Image: ${pick.creator} (${(pick.license || "").toUpperCase()}) via Openverse`
            : null,
        };
      }
    }
  }
  return null;
}

function headerLine(text, key) {
  return text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || null;
}

// House rule: em dashes read as AI-generated. Strip them everywhere, always,
// even if the model slips one through.
// A missing META_DESC header used to cost the whole article. QA holds on it,
// a hold costs a full re-draft, and three holds park a finished piece as an
// "idea" that nothing ever picks up again: on 5 August four articles carrying
// 3 to 11 internal links each were parked on this alone, and seven finished
// articles scoring 74 to 82 were sitting unreachable.
//
// It is not worth re-writing two thousand words over one line. Only 4 of 65
// articles ever lost it, and every other header on those same drafts parsed
// fine, so this is an occasional dropped line rather than a broken prompt.
// Write the line instead, on the cheap tier: composing 150 characters from copy
// that already exists is not editorial judgement, and the Finance Manager's
// standing brief is that mechanical work belongs on the cheap model.
//
// It fails honestly. If the generated line is still outside the range QA wants,
// the original value is returned and QA holds the article exactly as before,
// rather than publishing something worse than nothing.
const META_MIN = 120;
const META_MAX = 155;

async function ensureMetaDesc(client, { metaDesc, title, keyphrase, body }) {
  if (metaDesc && metaDesc.length >= 100 && metaDesc.length <= 160) return metaDesc;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: `You write one meta description for an article in a UK B2B trade publication.

Rules:
- Between ${META_MIN} and ${META_MAX} characters. This is the whole job: count them.
- One sentence that reads naturally and says what the reader gets.
- Contain the focus keyphrase if one is given.
- UK spelling. NEVER use em dashes or en dashes, use commas or colons.
- Describe only what is actually in the copy supplied. Invent nothing.

Reply with the sentence alone: no quotation marks, no label, no preamble, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Headline: ${title}\nFocus keyphrase: ${keyphrase || "(none given)"}\n\nThe article opens:\n${body
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1200)}`,
        },
      ],
    });
    recordUsage(res.model || "claude-haiku-4-5", res.usage);

    let out = "";
    for (const b of res.content) if (b.type === "text") out += b.text;
    out = stripEmDashes(out.trim().replace(/^["'\s]+|["'\s]+$/g, ""));

    // Over-length is recoverable: trim at a word boundary rather than throwing
    // an otherwise good line away. Under-length is not, so it falls through.
    if (out.length > 160) {
      const cut = out.lastIndexOf(" ", META_MAX);
      if (cut > 100) out = out.slice(0, cut).replace(/[,;:]$/, "");
    }
    if (out.length >= 100 && out.length <= 160) return out;
  } catch {
    // A failed helper must never lose the draft it was helping.
  }
  return metaDesc;
}

export function stripEmDashes(text) {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*\)/g, ")");
}

// Draft one article: fills body (+ improved title), moves status to review.
// Site map for internal linking, injected into every drafting prompt.
/**
 * The list of live articles the Editor may link to.
 *
 * This has been returning an empty string since the multi-tenant split, and
 * silently: `isWordPressConfigured()` was called with no argument so it was
 * always false, and `fetchPosts(40)` passed the limit where the credential
 * goes, which the catch then swallowed. So every draft since has been written
 * with no idea what else exists on the site — which is why the house rule to
 * include 2-4 internal links could not be followed, and why the SEO agent has
 * had to retrofit internal links onto 77 articles after the fact.
 */
async function siteLinkList(wp) {
  try {
    const { fetchPosts, isWordPressConfigured } = await import("./wordpress");
    if (!isWordPressConfigured(wp)) return "";
    const posts = await fetchPosts(wp, 40);
    const lines = posts.map((p) => `- "${p.title?.rendered}" ${p.link}`).join("\n");
    return `\n\nExisting site articles (pick 2-4 to link internally where genuinely relevant):\n${lines}`;
  } catch {
    return "";
  }
}

/**
 * The Editor's cached prefix: house style, then the site's article list.
 *
 * Order is the whole point. Caching is a prefix match, so the stable material
 * has to come BEFORE anything that changes per article — the link list used to
 * be appended to the end of the user message, which is the one position where
 * it can never be cached. Both blocks are identical between drafts, and the
 * breakpoint on the last one covers everything above it.
 *
 * A one-hour TTL rather than the default five minutes: the engine ticks every
 * thirty minutes and the median gap between Editor runs is exactly that, so a
 * five-minute cache would expire before every single reuse and pay the write
 * premium for nothing. One hour costs 2x to write and survives to the next run.
 */
async function editorPrefix(site, wp) {
  const links = await siteLinkList(wp);
  return [
    { type: "text", text: houseStyle(site) },
    // The tier rules, in the prompt rather than as a file path the model cannot
    // open. Sits inside the cached prefix because it is byte-identical between
    // drafts, so after the first call it bills at a tenth of the input rate.
    { type: "text", text: editorialStandard(site) || "(No editorial standard set for this title.)" },
    {
      type: "text",
      text: links || "\n\n(No article list available for this title.)",
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
}

export async function draftArticle(site, articleId, wp) {
  const db = forSite(site.id);
  if (!wp) wp = await wordpressCredential(site.id);
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { sourceItem: { include: { brand: true } } },
  });
  if (!article) throw new Error("article not found");

  const brandName = article.sourceItem?.brand?.name;
  const sourceText =
    article.type === "pr_rewrite" && article.sourceUrl
      ? await fetchSourceText(article.sourceUrl, userAgent(site))
      : null;

  // PRE-DRAFT MATERIAL GATE. Cut here, before the expensive call, not after.
  //
  // A news rewrite off a Google News link has nothing behind it. Measured on 18
  // August across both titles: fetchSourceText returns the literal string
  // "Google News" - two words - because the link is a JavaScript shell with no
  // publisher URL anywhere in it, and the RSS summary alongside it has a median
  // of 13 words. The writer was being handed about fifteen words and asked for a
  // 500-word article, with the string "Google News" going into the prompt as the
  // source material.
  //
  // Every one of those drafts came back thin and the gate said so every time:
  // "thin source with no figures limits depth", four times out of four on Fleet,
  // scoring 42 to 71. Then the repair loop paid full rate twice more trying to
  // fix a shortage of facts, which no amount of rewriting can supply.
  //
  // Parked, not thrown. A throw leaves the article in "drafting", the Editor
  // takes the oldest "drafting" piece every tick, and the queue stops behind it
  // - the failure already documented in team.js runEditor.
  if (article.type === "pr_rewrite" && !article.brief) {
    const haveSource = countWords(sourceText);
    const haveSummary = countWords(article.sourceItem?.summary);
    if (haveSource < MIN_SOURCE_WORDS && haveSummary < MIN_SUMMARY_WORDS) {
      await db.article.update({
        where: { id: article.id },
        data: { status: "idea", scheduledFor: null },
      });
      return {
        id: article.id,
        title: article.title,
        qaPassed: false,
        parked: true,
        issues: [
          `Nothing to write from: ${haveSource} words of source, ${haveSummary} words of summary. Parked before drafting.`,
        ],
      };
    }
  }

  const client = new Anthropic();
  const response = await client.messages.stream({
    model: DRAFT_MODEL,
    // Adaptive thinking spends from this same budget, so 4000 left nowhere near
    // enough for the house length of 2,300-2,600 words plus a table and a
    // five-question FAQ. Drafts were coming back cut off mid-sentence in the
    // last FAQ answer. Generation is billed on tokens actually produced, so a
    // roomy ceiling costs nothing extra on a draft that finishes early.
    //
    // Raised 16000 -> 32000 on 26 Aug 2026, after a Fleet draft was killed by
    // the ceiling. The longest pieces run to 2,550 words of prose plus HTML,
    // which is most of 5,000 tokens before the model has thought at all, and
    // on a hard subject adaptive thinking can want the rest. Since the bill
    // follows real output, headroom is only ever insurance.
    //
    // A ceiling this high is why the call below streams: the SDK refuses a
    // non-streaming request whose worst case could exceed ten minutes, and at
    // 32000 it does. Raising the ceiling without streaming blocked the Editor
    // on three titles at 12:36 the same day. finalMessage() waits for the whole
    // reply and hands back the ordinary Message, so nothing downstream changes.
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: await editorPrefix(site, wp),
    messages: [
      // Only the per-article brief lives here now. Everything stable moved into
      // the cached prefix above.
      { role: "user", content: buildPrompt(site, article, sourceText, brandName) },
    ],
  }).finalMessage();
  recordUsage(response.model || DRAFT_MODEL, response.usage);

  if (response.stop_reason === "refusal") {
    throw new Error("draft refused by model safety systems");
  }
  // A truncated draft used to be saved like any other. QA then held it for
  // ending mid-sentence, and a held article never publishes, so it sat in
  // review for ever waiting for a human who is not supposed to be in this loop.
  // Failing here instead means the run is marked failed and simply drafts again.
  if (response.stop_reason === "max_tokens") {
    throw new Error("draft hit the token ceiling and was cut off mid-sentence");
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  if (!text.trim()) throw new Error("empty draft");

  let body = text.trim();
  // Free fixes no model should be paid for: an empty heading or paragraph tag
  // killed a finished Golf article on 23 August after its one repair attempt
  // failed to remove it. Code removes it for nothing, every time.
  body = body.replace(/<(h[1-6]|p|em|strong)>[s]*<[/](h[1-6]|p|em|strong)>/gi, "");
  const title = stripEmDashes(headerLine(body, "TITLE") || article.title);
  const score = parseInt(headerLine(body, "SCORE") || "", 10);
  const scoreRationale = headerLine(body, "SCORE_WHY");
  const imageQuery = headerLine(body, "IMAGE_QUERY");
  const imageAlt = stripEmDashes(headerLine(body, "IMAGE_ALT"));
  // The commissioned section is the fallback, not the override: if the Editor
  // names a section it stands, because it has read the finished article and the
  // Researcher only ever read a title.
  const category = headerLine(body, "CATEGORY") || article.category;
  const keyphrase = headerLine(body, "KEYPHRASE");
  let metaDesc = stripEmDashes(headerLine(body, "META_DESC"));
  // Strip the header lines; HTML starts at the first tag.
  const htmlStart = body.indexOf("<");
  if (htmlStart > 0) body = body.slice(htmlStart).trim();
  body = stripEmDashes(body);

  // Before QA, not after: the point is that QA never sees a draft that is only
  // failing on a line we can write ourselves.
  metaDesc = await ensureMetaDesc(client, { metaDesc, title, keyphrase, body });

  // Smart image selection with a global never-repeat rule; falls back to the
  // simple validated search if the smart path finds nothing.
  //
  // The catch used to be empty. A throw in here — a malformed JSON array back
  // from the query writer is the usual one — was therefore indistinguishable
  // from "searched properly and found nothing", and the article went to the
  // Designer with no record that anything had gone wrong. Keep the article
  // moving, but leave the reason where the Designer's report can pick it up.
  let image = null;
  let imageNote = null;

  // Before the stock search: try for a photograph of the thing itself.
  //
  // Only on news. A guide about tee-sheet pricing has no named subject to
  // photograph, so this would spend four page fetches to learn what we already
  // know, and the stock search is the right answer for it anyway.
  //
  // The headline is passed as the subject rather than extracting the entity
  // separately: the vision gate reads it perfectly well, and an extraction call
  // per article is a cost we do not need to carry.
  if (article.type === "pr_rewrite" && article.sourceUrl) {
    try {
      const { subjectImage } = await import("./subject-image");
      const found = await subjectImage(site, {
        title,
        body,
        sourceUrl: article.sourceUrl,
        subject: title,
      });
      if (found) {
        image = found;
        console.log(`[images] ${site.slug}: subject photo from ${found.source} for "${title.slice(0, 60)}"`);
      }
    } catch (e) {
      // Never a reason not to publish. Fall through to stock.
      imageNote = `subject image errored: ${e.message?.slice(0, 120)}`;
    }
  }

  if (!image) {
    try {
      const { chooseSmartImage } = await import("./images");
      const picked = await chooseSmartImage(site, { title, keyphrase, category });
      image = picked.image;
      imageNote = picked.reason;
    } catch (e) {
      imageNote = `image search errored: ${e.message?.slice(0, 160)}`;
    }
  }
  if (!image && imageQuery) image = await findImage(imageQuery);
  if (!image && imageNote) console.warn(`[images] ${site.slug}: "${title.slice(0, 60)}" — ${imageNote}`);

  // Editorial QA gate: the result is recorded on the article so nothing can be
  // scheduled or published without a visible pass.
  let qa = { ok: false, issues: ["QA did not run"], report: null, score: 0 };
  try {
    const { reviewArticle } = await import("./qa");
    // The brief goes to the gate as well as to the writer. Without it the gate
    // judges unfamiliar facts on its own knowledge and calls new things
    // fabricated: on 17 August it demanded someone "verify" the real Anthropic
    // announcement the brief had supplied, and called two real products
    // invented. The brief is where "this was checked against a primary source"
    // is recorded, so the gate has to see it.
    qa = await reviewArticle({ site, title, body, type: article.type, keyphrase, metaDesc, brief: article.brief });
  } catch (e) {
    qa = { ok: false, issues: [`QA error: ${e.message}`], report: null, score: 0 };
  }

  await db.article.update({
    where: { id: article.id },
    data: {
      title,
      body,
      status: "review",
      seoScore: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : null,
      scoreRationale,
      imageUrl: image?.url || null,
      // Prefer the alt text written from the actual pixels.
      imageAlt: image?.alt || imageAlt || null,
      imageCredit: image?.credit || null,
      imageSource: image?.source || null,
      category,
      keyphrase,
      metaDesc,
      qaPassed: qa.ok,
      qaReport: qa.report,
    },
  });
  return { id: article.id, title, score, qaPassed: qa.ok, issues: qa.issues };
}

/**
 * Repair a draft QA held, instead of writing it again from nothing.
 *
 * The gate answers "publish" or "fix", and "fix" nearly always meant a good
 * article with a small fault: a missing meta description, a keyphrase absent
 * from the first 700 characters, "royal Mail". Nothing could act on that, so a
 * held piece was redrafted from scratch, came back with a different small
 * fault, and was binned on the third round. Five went that way in three days
 * scoring 74 to 82, at roughly 60p of drafting each.
 *
 * So: apply the listed fixes to the existing body and change nothing else,
 * then re-run the same gate. One focused call rather than a full rewrite.
 */
export async function repairArticle(site, articleId, wp) {
  const db = forSite(site.id);
  if (!wp) wp = await wordpressCredential(site.id);
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) throw new Error("article not found");
  if (!article.body) throw new Error("nothing to repair: article has no body");

  // The summary counts as a fault. When the gate withholds a publish verdict it
  // often puts its whole objection in the summary line and itemises nothing:
  // qa.js builds `editorial` by filtering the summary back out of the model's
  // list, so a reply whose only complaint IS the summary arrives here with two
  // empty arrays and a real reason sitting in a field nothing read.
  //
  // That threw, the throw failed the Editor's whole run, the article stayed in
  // "drafting", and the next tick picked the same one. The engine published
  // nothing from Saturday 13:35 to Monday morning on exactly this: 40-odd runs,
  // zero tokens, one article. Read the summary before giving up.
  let issues = [];
  let summary = null;
  try {
    const r = JSON.parse(article.qaReport || "{}");
    issues = [...(r.mechanical || []), ...(r.editorial || [])];
    summary = r.summary || null;
  } catch {}
  if (!issues.length && summary) issues = [summary];
  if (!issues.length) throw new Error("nothing to repair: no recorded QA issues");

  // Sonnet, not Opus. Composition is Opus work; this is not composition. The
  // instruction is "fix exactly these listed faults and change nothing else",
  // which is copy-editing against a checklist someone else wrote.
  //
  // It is also the single most repeated call in the engine. Over 1-17 August
  // repair passes came to £5.51 of a £32 bill, and £3.24 of that went on
  // articles that were still held afterwards and never published. Paying the
  // top rate three times to fix the same draft is where the money went.
  const client = new Anthropic();
  const response = await client.messages.stream({
    model: REPAIR_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: await editorPrefix(site, wp),
    messages: [
      {
        role: "user",
        content: `An editor reviewed this article and listed the faults below. Fix exactly those and change nothing else: keep the structure, the headings, the table, the FAQ, the links and the wording that was not criticised.

On anything flagged as an unverified or unsupported statistic, claim or quote: you may NOT invent a source, a citation or a link to justify it. Either attribute it to a source already linked in the article, or remove the number and make the point without it. Losing a statistic is fine. Inventing provenance for one is not.

FAULTS TO FIX:
${issues.map((s, i) => `${i + 1}. ${s}`).join("\n")}

If a fault concerns the HEADLINE or the META DESCRIPTION, you may correct those too.
To do that, emit them as header lines before the HTML, exactly like this:
TITLE: the corrected headline
META_DESC: the corrected meta description
Emit a header line ONLY for something you are actually changing, and only when a
fault above concerns it. Then the corrected article body as HTML, and nothing
else: no preamble, no explanation, no code fence.

CURRENT BODY:
${article.body}`,
      },
    ],
  }).finalMessage();
  recordUsage(response.model || REPAIR_MODEL, response.usage);

  if (response.stop_reason === "refusal") throw new Error("repair refused by model safety systems");
  if (response.stop_reason === "max_tokens") throw new Error("repair hit the token ceiling and was cut off mid-sentence");

  let text = "";
  for (const block of response.content) if (block.type === "text") text += block.text;
  let body = stripEmDashes(text.trim().replace(/^```(?:html)?\s*|\s*```$/g, "").trim());
  if (!body) throw new Error("empty repair");

  // Drop anything before the first HTML tag, exactly as draftArticle does.
  //
  // The prompt asks for the corrected body and nothing else, and this trusted
  // the model to comply. It complied right up until the call moved off Opus,
  // then came back with the whole TITLE/SCORE/IMAGE_QUERY/KEYPHRASE/META_DESC
  // header re-emitted above the article — which was stored as the body, so the
  // metadata block became the opening words of the piece. It also pushed the
  // real first paragraph out of the first 700 characters, which is the window
  // the keyphrase check reads, so the article then failed a mechanical test it
  // actually passed.
  //
  // draftArticle has always guarded this. The repair path never did, and the
  // model was the only thing standing in for it.
  // REPAIR MAY CHANGE THE HEADLINE, and until now it could not.
  //
  // repairArticle only ever wrote body and metaDesc, and handed the ORIGINAL
  // title back to the gate. So an objection about the headline was unfixable by
  // construction: it survived every rewrite, failed three times and parked a
  // finished article. On 18 August that binned an 80-scoring evergreen guide
  // whose only fault was "the metadata headline contradicts the article's own
  // accurate framing" - a one-line fix the repair pass was not allowed to make.
  const newTitle = stripEmDashes(headerLine(body, "TITLE"));
  const newMeta = stripEmDashes(headerLine(body, "META_DESC"));
  const title = newTitle || article.title;
  const htmlStart = body.indexOf("<");
  if (htmlStart > 0) body = body.slice(htmlStart).trim();
  if (!body) throw new Error("repair returned no HTML");

  // A repair that returns a fraction of the article has not repaired it, it has
  // replaced it with a summary. Better to fail and let the retry counter run.
  if (body.length < article.body.length * 0.6) {
    throw new Error(`repair shrank the article from ${article.body.length} to ${body.length} chars`);
  }

  const metaDesc = await ensureMetaDesc(client, {
    metaDesc: newMeta || (issues.some((s) => /meta description/i.test(s)) ? null : article.metaDesc),
    title,
    keyphrase: article.keyphrase,
    body,
  });

  let qa = { ok: false, issues: ["QA did not run"], report: null, score: 0 };
  try {
    const { reviewArticle } = await import("./qa");
    qa = await reviewArticle({ site, title, body, type: article.type, keyphrase: article.keyphrase, metaDesc, brief: article.brief });
  } catch (e) {
    qa = { ok: false, issues: [`QA error: ${e.message}`], report: null, score: 0 };
  }

  // A repair that changed nothing will not change anything next time either.
  //
  // Two articles on 18 August each took three full passes against the same
  // single objection and were then parked: same fault, same wording, three
  // times, about £0.55 each. When the gate comes back with exactly the issues it
  // raised before, the pass has failed to move it and another round is spending
  // money to be told the same thing. Park it for a human instead.
  const sig = (list) => (list || []).map((x) => String(x).slice(0, 120)).sort().join("|");
  const before = (() => {
    try {
      const r = JSON.parse(article.qaReport || "{}");
      return sig([...(r.mechanical || []), ...(r.editorial || [])]);
    } catch {
      return "";
    }
  })();
  const unmoved = !qa.ok && before && sig(qa.issues) === before;

  await db.article.update({
    where: { id: article.id },
    data: {
      body,
      metaDesc,
      ...(newTitle ? { title } : {}),
      status: unmoved ? "idea" : "review",
      ...(unmoved ? { scheduledFor: null } : {}),
      qaPassed: qa.ok,
      qaReport: qa.report,
    },
  });

  return {
    id: article.id,
    title,
    qaPassed: qa.ok,
    issues: qa.issues,
    fixed: issues.length,
    ...(unmoved ? { parked: true, unmoved: true } : {}),
    ...(newTitle ? { retitled: true } : {}),
  };
}
