// The Content Engine's drafting agent: turns shortlisted wire stories into
// rewritten articles and SEO ideas into original pieces. Requires
// ANTHROPIC_API_KEY; callers must check isDraftingConfigured() first.
import Anthropic from "@anthropic-ai/sdk";
import { forSite } from "./prisma";

export function isDraftingConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const HOUSE_STYLE = `You write for Smart SME Magazine — "The UK's publication for smart SMEs".
Audience: UK small and medium business owners adopting AI, software, technology and automation.
Voice: plain English, practical, optimistic but never breathless; UK spelling; short paragraphs;
explain jargon on first use; always answer "what does this mean for a small business?".
NEVER use em dashes (—) or en dashes (–) anywhere: not in headlines, body, or metadata.
Use commas, full stops, colons or brackets instead. Hyphens in compound words are fine.
LINKING RULES (mandatory): include 2-4 internal links to existing smartsme.co.uk articles
from the list provided, woven naturally into sentences with descriptive anchor text (never
"click here"). Include 1-2 outbound links: for news rewrites, always link the company's
website and the original announcement; for guides, link authoritative sources (gov.uk,
vendor sites). Internal links use the exact URLs given.

NAME THE PROVIDERS. Wherever an article touches software, tools, suppliers or
services, name the real companies rather than describing them in the abstract.
"Accounting software" is a wasted sentence; "Xero, QuickBooks, FreeAgent and Sage"
tells the reader where to look, and a named company is one we can approach for a
link afterwards. Aim for four or more named providers in any article where they
are genuinely relevant, each linked to its own site on first mention. Cover the
UK-relevant options a reader would actually shortlist, including the smaller
British ones, not only the largest American names.

At least two of the providers you name must be ones a reader might NOT already
know: a smaller competitor, a UK challenger, a specialist. A list of Google,
Microsoft, Adobe and Xero is the lazy answer and tells a business owner nothing
they had not already thought of — the useful half of any shortlist is the names
they had not considered. This is checked, and a piece that names only household
names comes back to be fixed.

This never outranks being right. If the honest answer to a question is one
dominant product, say so; do not pad a shortlist with weaker tools, and never
imply a smaller provider does something you are not sure it does. Naming a
worse tool to fill a quota is a worse failure than naming a famous one.

The line you must not cross: name real companies and describe what they are
generally known to do. Never invent a product, a feature, a price, a customer or
a statistic to make a brand fit. If you are unsure whether a company offers
something, say what it is known for and leave the specifics out. A named company
with nothing invented about it is exactly what is wanted; a plausible-sounding
fabrication about a real company is the worst possible outcome and will be
caught. Where a paragraph would need a fact you do not have, write the paragraph
without that fact.
Output format: return ONLY clean HTML ready for WordPress — <h2>/<h3> for subheadings,
<p> paragraphs, <ul>/<li> lists, <a href> links. No <html>/<head>/<body> wrapper, no markdown,
no code fences. Before the HTML, output exactly these five header lines:
TITLE: <the headline>
SCORE: <0-100 — this article's benefit to smartsme.co.uk: organic search potential, keyword demand, evergreen value, internal-linking usefulness, audience fit>
SCORE_WHY: <one sentence justifying the score>
IMAGE_QUERY: <2-4 generic stock-photo search words for a relevant photo, e.g. "laptop small business owner">
IMAGE_ALT: <descriptive, keyword-bearing alt text for that image, under 120 chars>
CATEGORY: <exactly one of: AI & Automation | Finance | Marketing | News | Operations | Case Studies>
KEYPHRASE: <the Yoast focus keyphrase, 2-5 words, present in the headline and first paragraph>
META_DESC: <compelling meta description, 120-155 chars, containing the keyphrase>`;

async function fetchSourceText(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SmartSMEBot/1.0)" },
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

function buildPrompt(article, sourceText, brandName) {
  if (article.type === "pr_rewrite") {
    return `Rewrite the following announcement from ${brandName || "the source"} as a news article for Smart SME Magazine (400-600 words).

This format is specified in docs/editorial-standard.md, format 2. It was taken
apart from the titles that beat us on news, so follow the shape closely.

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
- Open with why this matters to UK SMEs.
- Attribute the news clearly to ${brandName || "the source"} and include one link to the original: <a href="${article.sourceUrl}">${brandName || "source"}</a>.
- INTERNAL LINKS ARE MANDATORY IN THIS FORMAT TOO. Weave 2 to 4 links to existing smartsme.co.uk articles, taken from the list at the end of this message, into the body with descriptive anchor text. Every news piece published on 3 and 4 August 2026 went out with none, and it is the cheapest ranking win the site has. A news piece with fewer than 2 will be held by QA and written again.
- Link every company you name to its own website on first mention, ${brandName || "the source"} included.
- THE SME ANGLE IS THE ONLY ORIGINAL THING HERE. The titles we are competing with
  add commentary the original announcement did not have, and that addition is the
  entire reason their version deserves to exist. Give the reader the judgement:
  who this helps, who it does not, what it costs them, what to do about it.
- NEVER invent a quote, a commentator, an analyst or a statistic to fill that role.
  If the source carries no usable comment, the piece runs shorter without one.
  A fabricated source is a failure of the job, not a stylistic shortfall.
- Close with a short practical takeaway for small business owners.

Original title: ${article.title}

Source material:
${sourceText || "(Source page unavailable — write from the title alone, staying strictly factual and general; do not invent specific claims, figures or quotes.)"}`;
  }
  return `Write an original SEO article for Smart SME Magazine (1,200-1,800 words; depth wins rankings).
Cover the topic properly: practical detail, realistic examples with UK pricing, a comparison
table where tools are compared (<table> HTML), and end with an FAQ section of 4-5 real
questions (<h3> per question) before the "What to do next" steps.

Topic/working title: ${article.title}
${article.category ? `Commissioned for the ${article.category} section, so emit exactly that as CATEGORY. If the article you have actually written plainly does not belong there, emit the honest section instead and it will be filed correctly, but do not drift on a technicality.` : ""}
${article.keywords ? `Target keywords (work them in naturally, especially in the headline and first paragraph): ${article.keywords}` : ""}
${article.brief ? `COMMISSIONING BRIEF from the publisher. This is what was actually asked for, so it wins over any assumption you would otherwise make about the angle:\n${article.brief}` : ""}

Requirements:
- Structure for search: a keyword-bearing headline, a direct answer to the implied question in the first two paragraphs, then <h2> sections covering the details.
- Concrete and practical: UK-specific facts (HMRC, Companies House, UK pricing in £) where relevant; realistic examples for a small business.
- No fluff, no invented statistics; where a claim needs a source you don't have, phrase it generally.
- End with a short "What to do next" section of 3–4 action steps.`;
}

// Find a commercially usable image via Openverse (keyless). CC0/public-domain
// first (no attribution needed); falls back to any commercial licence with credit.
export async function findImage(query) {
  const search = async (params) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&per_page=10&filter_dead=true&${params}`,
        { headers: { "user-agent": "SmartSMEBot/1.0" }, signal: controller.signal }
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
        headers: { "user-agent": "SmartSMEBot/1.0" },
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
      system: `You write one meta description for an article in a UK small business publication.

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
    try { (await import("./agents/meter")).recordUsage(res.model || "claude-haiku-4-5", res.usage); } catch {}

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
async function siteLinkList() {
  try {
    const { fetchPosts, isWordPressConfigured } = await import("./wordpress");
    if (!isWordPressConfigured()) return "";
    const posts = await fetchPosts(40);
    const lines = posts.map((p) => `- "${p.title?.rendered}" ${p.link}`).join("\n");
    return `\n\nExisting site articles (pick 2-4 to link internally where genuinely relevant):\n${lines}`;
  } catch {
    return "";
  }
}

export async function draftArticle(site, articleId) {
  const db = forSite(site.id);
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { sourceItem: { include: { brand: true } } },
  });
  if (!article) throw new Error("article not found");

  const brandName = article.sourceItem?.brand?.name;
  const sourceText =
    article.type === "pr_rewrite" && article.sourceUrl
      ? await fetchSourceText(article.sourceUrl)
      : null;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    // Adaptive thinking spends from this same budget, so 4000 left nowhere near
    // enough for the house length of 2,300-2,600 words plus a table and a
    // five-question FAQ. Drafts were coming back cut off mid-sentence in the
    // last FAQ answer. Generation is billed on tokens actually produced, so a
    // roomy ceiling costs nothing extra on a draft that finishes early.
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: HOUSE_STYLE,
    messages: [
      {
        role: "user",
        content: buildPrompt(article, sourceText, brandName) + (await siteLinkList()),
      },
    ],
  });
  try { (await import("./agents/meter")).recordUsage(response.model || "claude-opus-4-8", response.usage); } catch {}

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
  let image = null;
  try {
    const { chooseSmartImage } = await import("./images");
    image = await chooseSmartImage({ title, keyphrase, category });
  } catch {}
  if (!image && imageQuery) image = await findImage(imageQuery);

  // Editorial QA gate: the result is recorded on the article so nothing can be
  // scheduled or published without a visible pass.
  let qa = { ok: false, issues: ["QA did not run"], report: null, score: 0 };
  try {
    const { reviewArticle } = await import("./qa");
    qa = await reviewArticle({ title, body, type: article.type, keyphrase, metaDesc });
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
export async function repairArticle(site, articleId) {
  const db = forSite(site.id);
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

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: HOUSE_STYLE,
    messages: [
      {
        role: "user",
        content: `An editor reviewed this article and listed the faults below. Fix exactly those and change nothing else: keep the structure, the headings, the table, the FAQ, the links and the wording that was not criticised.

On anything flagged as an unverified or unsupported statistic, claim or quote: you may NOT invent a source, a citation or a link to justify it. Either attribute it to a source already linked in the article, or remove the number and make the point without it. Losing a statistic is fine. Inventing provenance for one is not.

FAULTS TO FIX:
${issues.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Reply with the corrected article body as HTML and nothing else. No preamble, no explanation, no code fence.

CURRENT BODY:
${article.body}`,
      },
    ],
  });
  try { (await import("./agents/meter")).recordUsage(response.model || "claude-opus-4-8", response.usage); } catch {}

  if (response.stop_reason === "refusal") throw new Error("repair refused by model safety systems");
  if (response.stop_reason === "max_tokens") throw new Error("repair hit the token ceiling and was cut off mid-sentence");

  let text = "";
  for (const block of response.content) if (block.type === "text") text += block.text;
  let body = stripEmDashes(text.trim().replace(/^```(?:html)?\s*|\s*```$/g, "").trim());
  if (!body) throw new Error("empty repair");

  // A repair that returns a fraction of the article has not repaired it, it has
  // replaced it with a summary. Better to fail and let the retry counter run.
  if (body.length < article.body.length * 0.6) {
    throw new Error(`repair shrank the article from ${article.body.length} to ${body.length} chars`);
  }

  const metaDesc = await ensureMetaDesc(client, {
    metaDesc: issues.some((s) => /meta description/i.test(s)) ? null : article.metaDesc,
    title: article.title,
    keyphrase: article.keyphrase,
    body,
  });

  let qa = { ok: false, issues: ["QA did not run"], report: null, score: 0 };
  try {
    const { reviewArticle } = await import("./qa");
    qa = await reviewArticle({ title: article.title, body, type: article.type, keyphrase: article.keyphrase, metaDesc });
  } catch (e) {
    qa = { ok: false, issues: [`QA error: ${e.message}`], report: null, score: 0 };
  }

  await db.article.update({
    where: { id: article.id },
    data: { body, metaDesc, status: "review", qaPassed: qa.ok, qaReport: qa.report },
  });

  return { id: article.id, title: article.title, qaPassed: qa.ok, issues: qa.issues, fixed: issues.length };
}
