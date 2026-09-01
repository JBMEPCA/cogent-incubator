// Quality gates. Nothing reaches a title's live site without passing these.
//
// The image gate is VISUAL: Claude is shown the actual downloaded pixels and
// must confirm the picture matches the article before it can be published.
// Metadata-only matching is what put a random train icon on a Copilot article.
import Anthropic from "@anthropic-ai/sdk";
import { titleBrief, siteHost, userAgent, countLinksTo, editorialStandard } from "./voice.js";
import { recordUsage } from "./agents/meter";

const MODEL = "claude-opus-4-8";
// The picture gate is not editorial judgement. It answers "is this photo of the
// thing the article is about, and is it free of misleading logos or text" —
// exactly the mechanical work lib/images.js already routes to Haiku for its
// query writing. It is also the most expensive kind of call to get wrong,
// because every retry sends a full image back through the model: one article in
// the first fleet batch burned 12 calls and $0.80 on repeated Opus vision
// checks and published nothing at all. The copy gate below stays on Opus.
const VISION_MODEL = "claude-haiku-4-5";

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
// When the picture came off the page the story was written from, provenance
// settles the two things this gate spends most of its effort guessing at.
// Relevance is not in question, and the branding on it is the RIGHT branding:
// a company photograph of its own product carries its own logo by design.
const SOURCE_NOTE = `

PROVENANCE: this photograph was taken from the page this article was written from - the company or body the story is about published it themselves, alongside the announcement. Relevance is therefore established: do NOT reject it for failing to illustrate the subject, for being the wrong product category, or for not demonstrating a feature. Any logo or product branding on it belongs to the organisation the article names, which is correct rather than a wrong-brand failure. It also does not have to be a photograph. A company announcing software publishes a screenshot of it, and a company announcing a product publishes its own illustration or render: for a launch story those ARE the picture, and a trade title runs them. Judge it ONLY on whether it is publishable at the top of the page: big and sharp enough to look deliberate, legible, not a spacer or a broken image, and nothing unsafe or embarrassing. Reject a screenshot only when it is unreadable at header size, never for being a screenshot. The watermark rule still applies here and applies absolutely: a source page that offers only a watermarked library preview has offered nothing.`;

export async function verifyImage({ site, imageUrl, title, keyphrase, fromSource = false }) {
  let buf, mediaType;
  try {
    const res = await fetch(imageUrl, {
      headers: { "user-agent": userAgent(site) },
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
    // Downscaling is an optimisation, not a gate. When sharp cannot load - as
    // on 20 August 2026, when the deployment lost libvips and every image on
    // every title "failed the gate" without ever being looked at - the check
    // must degrade to judging the original bytes, not reject the candidate.
    // The catch below used to wrap this too, so a broken native module read as
    // "image unreachable": an infrastructure fault reported as an image fault,
    // four attempts burned per article, and three titles missed their slots.
    const RAW_BYTES_CEILING = 4 * 1024 * 1024; // vision accepts ~5MB base64
    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(bytes, { density: 200 })
        .resize(900, 900, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 80 })
        .toBuffer();
      mediaType = "image/jpeg";
    } catch (sharpErr) {
      const rasterOk = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType);
      if (rasterOk && bytes.length <= RAW_BYTES_CEILING) {
        // Full price for the tokens, but the gate still LOOKS at the picture.
      } else if (String(imageUrl).includes("images.pexels.com")) {
        // Pexels serves resized variants from the URL, no sharp needed.
        const smallUrl = String(imageUrl).split("?")[0] + "?auto=compress&cs=tinysrgb&h=650&w=940";
        const small = await fetch(smallUrl, { headers: { "user-agent": userAgent(site) }, signal: AbortSignal.timeout(15000) });
        if (!small.ok) return { ok: false, score: 0, reason: `image fetch ${small.status}` };
        bytes = Buffer.from(await small.arrayBuffer());
        mediaType = mediaTypeOf(small.headers.get("content-type")) || "image/jpeg";
      } else {
        // Cannot be judged without processing (SVG, oversized). Say WHOSE
        // fault that is, so the failure reads as tooling, not as the image.
        return { ok: false, score: 0, reason: `picture gate cannot process this image (sharp unavailable: ${String(sharpErr.message).slice(0, 80)})` };
      }
    }
    buf = bytes.toString("base64");
  } catch (e) {
    return { ok: false, score: 0, reason: `image unreachable: ${e.message}` };
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 700,
    // Haiku 4.5 predates adaptive thinking: sending it returns a 400.
    system: `${titleBrief(site)}${fromSource ? SOURCE_NOTE : ""}

You are the picture editor, and your job is to let pictures THROUGH.

This gate used to argue about whether a photograph illustrated the subject well enough. That argument cost a fortune and published nothing: on Monday 31 August 2026 the fleet spent four pounds and put out ONE article, because finished, checked, scheduled pieces sat waiting on a picture this gate kept refusing. A sound photograph on the page beats a perfect one that never arrives. JB's instruction on 1 September was to dial the restrictions right back.

So DEFAULT TO YES. If you are hesitating, the answer is yes.

REJECT (verdict "no") for these four things ONLY:
1. A WATERMARK. Absolute, no exceptions, however good the picture. A stock library's mark, a tiled or diagonal agency name, Getty, Shutterstock, Alamy, iStock, Dreamstime, a photographer's signature across the frame, any sample or preview overlay. This is JB's one standing rule on imagery.
2. UNSAFE OR EMBARRASSING. Anything explicit, gory, offensive, or that would humiliate the person in it or embarrass the title.
3. NOT USABLE AS A PICTURE. Broken, corrupt, a blank or near-blank frame, a spacer, or so small or blurred it would look like a mistake at the top of a page.
4. A RIVAL'S LOGO. You can actually READ a company name or see a logo in the picture, and it belongs to a company OTHER than the one the article is about. Read this narrowly. Ask only: "can I read a brand name in this image?" If the answer is no, the rule does not apply and the picture passes. An unbranded photograph is ALWAYS fine, and "no branding" is never a fault - a server rack with no logo is the correct picture for a hosting story, an unbranded holiday flat is the correct picture for a short-let story. The article's own company logo is correct too.

Everything else passes. In particular NONE of the following is a reason to reject, and none should lower the score:
- it is generic, could be anywhere, or does not prove which organisation is involved
- it does not depict the policy, regulation, data or announcement (nothing does: no library holds a photograph of a consultation)
- it shows the trade rather than the specific story - a barbershop for a barbering story, a van for a fleet story, a fairway for a golf story is exactly right
- it is a different product category, or does not show the named product
- it is an illustration, render, graphic or screenshot rather than a photograph
- it is staged, corporate, or a bit dull
- it carries no branding at all, or does not show the company the article names

Score is a rough confidence, not a hurdle. Anything publishable scores 60 or more.

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
  recordUsage(res.model || VISION_MODEL, res.usage);
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
export async function reviewArticle({ site, title, body, type, keyphrase, metaDesc, brief }) {
  const plain = (body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(" ").filter(Boolean).length;

  // Hard mechanical checks first: cheap, deterministic, no model needed.
  const issues = [];
  if (/[—–]/.test(title + body)) issues.push("Contains em/en dashes (house rule violation)");
  // Per title, not per codebase. A trade weekly covering plant hire and a
  // consumer-facing SME title do not agree on how long a news piece has to be,
  // and Site.wordFloorNews/wordFloorGuide were columns nothing read.
  const minWords =
    type === "pr_rewrite" ? site?.wordFloorNews || 300 : site?.wordFloorGuide || 1100;
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
  const host = siteHost(site);
  const internalLinks = host ? countLinksTo(body, host) : 0;
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
      .filter((h) => h && (!host || !h.endsWith(host)));
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
    // Adaptive thinking spends from THIS budget, and the verdict is written
    // after the thinking. At 900 the gate could exhaust the whole allowance
    // reasoning and return no text at all: the reply parsed to score 0 and an
    // empty verdict, which then read as "held for no stated reason" and blamed
    // the article for a truncated reply. Passing the commissioning brief in
    // made it think harder and turned an occasional failure into a reliable
    // one. The reply itself is a few hundred tokens of JSON, so a roomy ceiling
    // costs nothing on a review that finishes early — same lesson as the draft
    // call and the SEO sweep, both of which had to learn it separately.
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: `${titleBrief(site)}
${editorialStandard(site)}
You are the editor. Review this article as if it publishes in ten minutes under your name.

Flag ONLY genuine problems: factual claims that look invented or unverifiable (especially specific statistics, prices, dates and quotes), claims about named companies that the source would not support, anything defamatory or legally risky, contradictions, repetition, broken HTML, robotic or padded writing, and advice that could harm a small business (tax, legal, security).

HOUSE STYLE YOU MUST NOT PUNISH: in the news-rewrite format, the first sentence
of the body deliberately repeats the standfirst almost verbatim. That
standfirst echo is instructed, and flagging it killed six finished articles in
one weekend while the writer was following its own brief. Only flag repetition
BEYOND that one echo - a third restatement, or duplicated sentences later in
the piece.

EVERY OBJECTION MUST BE ACTIONABLE BY A REWRITE. The repair pass cannot browse,
check a source, or confirm a date - it can only rewrite what is on the page. So
never ask for something to be 'verified' or 'checked': name the claim and
demand it be ATTRIBUTED to a source already linked in the article, or REMOVED.
Losing a detail is fine; an unactionable hold parks a finished article and
wastes everything it cost.

YOU CANNOT RULE ON WHETHER SOMETHING EXISTS. Your training has a cutoff; this is
a news publication, so much of what it covers is newer than that. A product,
company, URL, job title, price change or announcement you do not recognise is
far more likely to be new than invented. Never flag something as fabricated
because it is unfamiliar to you, and never ask for a URL to be "verified"
because you do not recognise it — you have no way to check, and the objection
cannot be acted on.

Flag a claim as invented ONLY when it is unsupported by anything in this article
or in the commissioning brief below: a statistic with no attribution, a quote
with no speaker, a price with no source. The test is "nothing here backs this
up", never "I have not heard of this".

Anything the brief states as verified has already been checked against a primary
source by the publisher. Treat it as fact. If the article contradicts the brief,
or adds specifics the brief does not contain, THAT is worth flagging.

Reply ONLY with JSON:
{"verdict": "publish"|"fix", "score": <0-100 editorial quality>, "issues": ["..."], "summary": "<one sentence>"}
Return an empty issues array when the piece is genuinely fine. Do not invent problems.
If you withhold a publish verdict you MUST say why, in issues or in summary. A
hold with no stated reason cannot be fixed by anyone and will be discarded.`,
    messages: [
      {
        role: "user",
        content: `Type: ${type}\nHeadline: ${title}\nKeyphrase: ${keyphrase || "n/a"}\nWords: ${words}\n${
          brief ? `\nCOMMISSIONING BRIEF (facts here are publisher-verified against a primary source):\n${brief}\n` : ""
        }\n${body.slice(0, 14000)}`,
      },
    ],
  });
  recordUsage(res.model || "claude-opus-4-8", res.usage);

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

  // And when there is no summary either, the hold is not a hold — it is a
  // malformed reply, and it used to deadlock the article for good.
  //
  // "nothing to repair: no recorded QA issues" is the most frequent failure in
  // the whole database: 61 occurrences. The sequence was always the same. The
  // gate returns {"verdict":"fix","summary":"","issues":[]}, repairArticle has
  // nothing to act on and throws, the article stays held, the next tick runs
  // the gate again at full Opus rate, and three rounds later team.js parks a
  // finished article having never once said what was wrong with it. The Claude
  // watermarking piece burned £0.60 that way on 17 August.
  //
  // So an unreasoned hold defers to the score, which is the one signal in the
  // reply that is still meaningful. Above the bar it publishes; below it, the
  // score itself becomes the stated reason so the next pass has something real
  // to work with and a human reading the queue can see what happened.
  // A reply with no verdict at all is a broken gate, not a bad article, and it
  // must not be reported as one. Blaming the copy for a truncated reply sends
  // the repair pass off to rewrite prose that was never the problem, and burns
  // an attempt doing it.
  if (!verdict) {
    throw new Error(
      res.stop_reason === "max_tokens"
        ? "editorial gate hit the token ceiling before writing its verdict"
        : "editorial gate returned no verdict"
    );
  }

  let unreasoned = false;
  if (verdict !== "publish" && !issues.length && !editorial.length && !summary) {
    unreasoned = true;
    if (modelScore < 70) {
      editorial = [
        `The editorial gate scored this ${modelScore} and withheld a publish verdict without itemising a fault. Tighten the writing: cut padding and repetition, make the opening earn the headline, and check every statistic and quote is attributed to something linked in the article.`,
      ];
    }
  }

  const allIssues = [...issues, ...editorial];
  const ok =
    allIssues.length === 0 && modelScore >= 70 && (verdict === "publish" || unreasoned);

  return {
    ok,
    score: modelScore,
    words,
    issues: allIssues,
    report: JSON.stringify({ score: modelScore, verdict, summary, mechanical: issues, editorial }, null, 1),
  };
}
