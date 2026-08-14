// Quality gates. Nothing reaches smartsme.co.uk without passing these.
//
// The image gate is VISUAL: Claude is shown the actual downloaded pixels and
// must confirm the picture matches the article before it can be published.
// Metadata-only matching is what put a random train icon on a Copilot article.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

function textOf(res) {
  let out = "";
  for (const b of res.content) if (b.type === "text") out += b.text;
  return out.trim();
}

// Tolerant field extraction: never let a truncated reply crash a gate.
function field(text, key) {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*(?:"([^"]*)"|(-?\\d+)|(true|false))`, "i"));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

function mediaTypeOf(contentType) {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (Object.values(MIME).includes(ct)) return ct;
  return null;
}

/**
 * Visually verify an image against its article.
 * Returns {ok, score, reason, altText}. ok=false means DO NOT publish it.
 */
export async function verifyImage({ imageUrl, title, keyphrase }) {
  let buf, mediaType;
  try {
    const res = await fetch(imageUrl, {
      headers: { "user-agent": "SmartSMEBot/1.0 (smartsme.co.uk editorial)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, score: 0, reason: `image fetch ${res.status}` };
    let bytes = Buffer.from(await res.arrayBuffer());
    mediaType = mediaTypeOf(res.headers.get("content-type"));

    // ALWAYS downscale before sending to vision. A full-resolution header image
    // costs up to ~4,800 input tokens, and this gate tries several candidates
    // per article, which made image checking the single largest cost in the
    // whole system. At 900px the model still judges relevance, brand and
    // quality perfectly well, for roughly a quarter of the tokens.
    //
    // Rasterising here also covers SVGs, which vision cannot read at all: an
    // unverified image must never reach a published page.
    const sharp = (await import("sharp")).default;
    bytes = await sharp(bytes, { density: 200 })
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();
    mediaType = "image/jpeg";
    buf = bytes.toString("base64");
  } catch (e) {
    return { ok: false, score: 0, reason: `image unreachable: ${e.message}` };
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    thinking: { type: "adaptive" },
    system: `You are the picture editor for Smart SME Magazine, a UK business publication. You are shown a candidate header image and the article it would illustrate. Your job is to catch mistakes before publication.

REJECT (verdict "no") if ANY of these are true:
- The image does not clearly relate to the article's subject.
- The article names specific brands/products and the image shows a DIFFERENT brand, or shows a logo that is not the one named. Wrong logos are the most serious failure possible.
- The image contains text, watermarks or logos that would confuse or mislead a reader.
- It looks like a meme, clipart, a screenshot of a random webpage, a map, a chart with unreadable data, or an obviously staged 2000s stock photo.
- The subject is a recognisable named individual (we do not have permission).
- Quality is poor: blurry, distorted, badly cropped, or too dark to read at a glance.

ACCEPT (verdict "yes") only if a professional editor would be comfortable seeing this at the top of the article.

Reply ONLY with JSON:
{"verdict": "yes"|"no", "score": <0-100 relevance>, "reason": "<one sentence>", "alt": "<SEO alt text under 120 chars describing what is actually visible, including the keyphrase if it fits naturally>"}`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buf } },
          {
            type: "text",
            text: `Article headline: "${title}"\nTarget keyphrase: ${keyphrase || "n/a"}\n\nIs this image safe and appropriate to publish as this article's header?`,
          },
        ],
      },
    ],
  });
  try { (await import("./agents/meter")).recordUsage(res.model || "claude-opus-4-8", res.usage); } catch {}
  if (res.stop_reason === "refusal") return { ok: false, score: 0, reason: "image review refused" };

  const text = textOf(res);
  const verdict = (field(text, "verdict") || "").toLowerCase();
  const score = parseInt(field(text, "score") || "0", 10) || 0;
  return {
    ok: verdict === "yes" && score >= 60,
    score,
    reason: field(text, "reason") || "no reason given",
    altText: field(text, "alt") || null,
  };
}

/**
 * Editorial QA on article copy. Returns {ok, score, issues[], report}.
 */
export async function reviewArticle({ title, body, type, keyphrase, metaDesc }) {
  const plain = (body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(" ").filter(Boolean).length;

  // Hard mechanical checks first: cheap, deterministic, no model needed.
  const issues = [];
  if (/[—–]/.test(title + body)) issues.push("Contains em/en dashes (house rule violation)");
  const minWords = type === "pr_rewrite" ? 300 : 1100;
  if (words < minWords) issues.push(`Too short: ${words} words (minimum ${minWords} for ${type})`);
  if (!keyphrase) issues.push("Missing focus keyphrase");
  if (!metaDesc) issues.push("Missing meta description");
  else if (metaDesc.length < 100 || metaDesc.length > 160) issues.push(`Meta description ${metaDesc.length} chars (want 120-155)`);
  // News rewrites are held to this too. The old exemption is precisely why the
  // three pieces published on 3 and 4 August 2026 went out with zero internal
  // links between them: the house style calls 2 to 4 mandatory, lib/drafting.js
  // injects forty candidate URLs into every prompt including this format, and
  // then the gate waved news straight through without looking.
  //
  // The pattern also missed the www. form, so a perfectly good internal link
  // written as https://www.smartsme.co.uk/... counted as no link at all.
  const internalLinks = (body.match(/href="https?:\/\/(www\.)?smartsme\.co\.uk/gi) || []).length;
  if (internalLinks < 2) issues.push(`Only ${internalLinks} internal links (want 2 or more)`);
  if (/lorem ipsum|TODO|\[insert|XX%|placeholder/i.test(body)) issues.push("Contains placeholder text");

  // A guide that names only household names leaves us nobody to contact. The
  // house style has always asked for "the smaller British ones, not only the
  // largest American names" and it was quietly ignored: the first nine outreach
  // emails went to Google, Microsoft, Adobe, HMRC and the IPO, and won nothing.
  // An instruction nothing checks is a suggestion.
  //
  // Guides only. A news piece about Google should name Google and nobody else,
  // and holding it for that would repeat the mistake this file already made once
  // by waving news through the internal-link gate and then failing it elsewhere.
  if (type !== "pr_rewrite") {
    const { isUnreachable } = await import("./reachability");
    // Both forms are needed. The first label alone matches the brand list
    // ("google.com" canonicalises to "googlecom" and misses "google"), while the
    // whole host is what catches a public body ("gov.uk"). Testing only one of
    // them let every gov.uk citation count as a company we could email.
    const named = [...body.matchAll(/href="https?:\/\/(?:www\.)?([a-z0-9.-]+)/gi)]
      .map((m) => m[1])
      .filter((h) => h && !h.startsWith("smartsme."));
    const reachable = new Set(
      named.filter((h) => !isUnreachable(h.split(".")[0]) && !isUnreachable(h))
    );
    // Held only when there is nobody at all, not when there is merely one.
    // Replayed over the last 25 guides, a threshold of two would have held 16 of
    // them: the deficiency is systemic rather than occasional, and a gate that
    // fires on two thirds of output is churn, not quality. The house style is
    // where that gets fixed. Zero is different — an article citing gov.uk four
    // times and no company at all generates no outreach whatsoever, and it is
    // failing the "name the providers" rule outright.
    if (named.length >= 2 && reachable.size === 0) {
      issues.push(
        `Names no provider we could ever contact (${named.length} links, all household names or public bodies). Name real companies a reader would shortlist, including smaller or UK ones.`
      );
    }
  }
  // Say what the test actually is.
  //
  // "Keyphrase not present near the top" is true but unactionable, and it is
  // the single most common reason an article is held. The repair pass is handed
  // this line and told to fix exactly it, so it puts the phrase somewhere in
  // the intro, misses by a word order or by a hundred characters, fails again,
  // and on the third round a finished 1,800-word article is binned. Seven were
  // sitting parked on this one line, five of them with nothing else against
  // them and one carrying a "publish" verdict at 82.
  //
  // The check is narrow and mechanical, so the instruction can be too.
  if (keyphrase && !new RegExp(keyphrase.split(" ").slice(0, 3).join("\\s+"), "i").test(plain.slice(0, 700))) {
    const head = keyphrase.split(" ").slice(0, 3).join(" ");
    issues.push(
      `Keyphrase not present near the top of the article. The words "${head}" must appear consecutively, in that order, within the first 700 characters of the article text (roughly the opening two paragraphs). Case does not matter and any whitespace between them is fine, but a paraphrase or a reordering will not pass.`
    );
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    thinking: { type: "adaptive" },
    system: `You are the editor of Smart SME Magazine (UK SMEs adopting AI, software and automation). Review this article as if it publishes in ten minutes under your name.

Flag ONLY genuine problems: factual claims that look invented or unverifiable (especially specific statistics, prices, dates and quotes), claims about named companies that the source would not support, anything defamatory or legally risky, contradictions, repetition, broken HTML, robotic or padded writing, and advice that could harm a small business (tax, legal, security).

Reply ONLY with JSON:
{"verdict": "publish"|"fix", "score": <0-100 editorial quality>, "issues": ["..."], "summary": "<one sentence>"}
Return an empty issues array when the piece is genuinely fine. Do not invent problems.`,
    messages: [
      {
        role: "user",
        content: `Type: ${type}\nHeadline: ${title}\nKeyphrase: ${keyphrase || "n/a"}\nWords: ${words}\n\n${body.slice(0, 14000)}`,
      },
    ],
  });
  try { (await import("./agents/meter")).recordUsage(res.model || "claude-opus-4-8", res.usage); } catch {}

  const text = textOf(res);
  const modelIssues = [...text.matchAll(/"([^"]{15,240})"/g)]
    .map((m) => m[1])
    .filter((s) => !/^(publish|fix)$/i.test(s) && !/^(verdict|score|issues|summary)$/i.test(s));
  const summary = field(text, "summary") || "";
  const modelScore = parseInt(field(text, "score") || "0", 10) || 0;
  const verdict = (field(text, "verdict") || "").toLowerCase();

  // Editorial issues are the model's list minus its own summary line.
  let editorial = modelIssues.filter((s) => s !== summary);

  // A hold has to say why. When the verdict is anything but "publish" and the
  // model itemised nothing, its objection IS the summary, and the filter above
  // has just removed the only copy of it. That produced holds carrying an empty
  // issue list: they read as a gate glitch, they gave repairArticle nothing to
  // act on, and they let team.js park finished articles without a stated
  // reason. Five were parked that way in three days scoring 74 to 84.
  if (verdict !== "publish" && !issues.length && !editorial.length && summary) {
    editorial = [summary];
  }

  const allIssues = [...issues, ...editorial];
  const ok = allIssues.length === 0 && verdict === "publish" && modelScore >= 70;

  return {
    ok,
    score: modelScore,
    words,
    issues: allIssues,
    report: JSON.stringify({ score: modelScore, verdict, summary, mechanical: issues, editorial }, null, 1),
  };
}
