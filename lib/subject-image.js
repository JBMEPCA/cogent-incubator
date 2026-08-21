// The subject photograph: the actual place, or the actual person.
//
// WHY THIS EXISTS
//
// Everything in lib/images.js is a stock search. That is the right answer for
// "what does dynamic pricing require", and the wrong answer for "Paul Stuart
// wins the PGA Award for Excellence" or "Orchard Valley reopens after an $8.8m
// renovation". A trade reader looking at an appointment story wants the person,
// and looking at a reopening wants the course. A representative fairway is a
// visible admission that nobody went and got the picture.
//
// Measured on those two live articles on 18 Aug 2026: BOTH source pages carried
// a correct, subject-specific og:image, and going one step further to the
// venue's own website produced a better one again. Retrieval is not the hard
// part.
//
// THE ONE HARD RULE
//
// The Paul Stuart photograph on golfmanagement.online has GOLF MANAGEMENT burnt
// into the bottom of the frame. Running it would print a rival trade title's
// masthead on our article. That is why the vision gate below asks about
// third-party marks separately from whether the picture is on subject, and why
// a mark is an outright reject rather than a score penalty.
//
// ORDER
//
// The subject's own site first, the publisher that reported it second. Not for
// provenance: the organisation being written about has better, larger and
// unmarked photography of itself, and it is the party that actively wants the
// coverage. Orchard Valley's own hero shot beat the trade press copy on every
// measure in testing.
//
// FAIL-SAFE
//
// Every failure path returns null and the caller drops through to the existing
// stock search untouched. This module can never be the reason an article does
// not publish.
import Anthropic from "@anthropic-ai/sdk";

// Lazily imported so a failure in the voice module degrades the gate rather
// than taking the whole image path down with it.
async function brief(site) {
  try {
    const { titleBrief } = await import("./voice");
    return titleBrief(site);
  } catch {
    return `You are the picture editor for ${site?.name || "this title"}.`;
  }
}

const VISION_MODEL = "claude-haiku-4-5";
const MAX_PAGES = 4;
const MIN_BYTES = 15000;
const MAX_BYTES = 4_500_000; // the vision API's practical ceiling

const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Hosts that never hold a usable subject photograph: social embeds, trackers,
// aggregators and our own titles. Google News in particular is a redirect stub.
const SKIP_HOST = /(^|\.)(google|googleusercontent|facebook|fb|twitter|x|t|linkedin|instagram|youtube|youtu|pinterest|doubleclick|gravatar|wp|w3|schema|cloudflare)\.[a-z.]+$/i;

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** Outbound links the drafter put in the body, best candidates first. */
function pagesFrom({ body, sourceUrl, siteDomain }) {
  const out = [];
  const seen = new Set();
  const add = (u) => {
    const h = hostOf(u);
    if (!h || seen.has(h)) return;
    if (SKIP_HOST.test(h)) return;
    if (siteDomain && h.endsWith(siteDomain.replace(/^www\./, ""))) return;
    seen.add(h);
    out.push(u);
  };

  // The editorial standard requires every news piece to link the company it is
  // about, so the subject's own URL is already sitting in the copy we just
  // wrote. No search needed, and no guessing at a domain.
  for (const m of String(body || "").matchAll(/href="(https?:\/\/[^"]+)"/gi)) add(m[1]);

  // The publisher who reported it goes last: it is the most likely to be a
  // watermarked composite, and the least likely to be the best frame.
  const srcHost = hostOf(sourceUrl);
  if (sourceUrl && srcHost && !seen.has(srcHost)) out.push(sourceUrl);

  return out.slice(0, MAX_PAGES);
}

async function fetchText(url, ua) {
  const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "follow", signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("html")) return null;
  return (await res.text()).slice(0, 400000);
}

/** og:image, then twitter:image. Absolute-ised against the page. */
function metaImage(html, pageUrl) {
  const pick = (re) => {
    const m = String(html).match(re);
    return m ? m[1] : null;
  };
  const raw =
    pick(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!raw) return null;
  try { return new URL(raw, pageUrl).href; } catch { return null; }
}

async function fetchImage(url, ua) {
  const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!OK_TYPES.has(type)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < MIN_BYTES || buf.byteLength > MAX_BYTES) return null;
  let filename = "";
  try { filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch {}
  return { base64: buf.toString("base64"), type, filename, pageUrl: null };
}

/**
 * The gate. Deliberately NOT the stock picture gate in lib/images.js, which
 * rejects "a recognisable named individual" because on a stock photograph that
 * is a permissions problem. Here a recognisable named individual is the entire
 * point, so that rule must not apply.
 */
async function verify(site, { title, subject, image }) {
  const res = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: 400,
    system: `${await brief(site)}

You are the picture editor checking ONE candidate photograph supplied by the organisation an article is about, or by the outlet that reported it.

Unlike a stock photograph, this picture is SUPPOSED to show the specific place, building, course or person the article names. A recognisable named individual is correct here, not a fault.

Answer three things.

1. ON SUBJECT. Weigh PROVENANCE, not just pixels.

This image was published as the lead photograph on a page specifically about this story, and you are told the page and the image filename. That is strong evidence it depicts the subject, and it is the same evidence a human picture desk works from: nobody can identify a particular golf course from an aerial by eye, and being unable to is not a reason to reject. Filenames naming the venue are especially strong.

So: accept unless the picture CONTRADICTS the story. Reject for a mismatch of kind, not of certainty. A person where the story is about a venue, a venue where the story is about a named person, an obviously different sport or industry, an interior where the story is plainly about a course. If it is the right KIND of subject and the provenance points at this story, that is a pass.

2. THIRD-PARTY MARK. Does it carry a watermark, masthead, byline bar or logo belonging to some OTHER publication, agency or stock library? This is the most important question. Publishing another trade title's branded image puts a competitor's logo on our page. Any burnt-in publication name, agency credit bar or stock-library watermark is a reject. The subject organisation's OWN logo on their own building, signage or clothing is fine and is not a third-party mark.

3. USABLE. Is it a real photograph of adequate quality, not a logo, poster, graphic, map, chart, screenshot or collage?

Reply ONLY with JSON:
{"onSubject":true|false,"thirdPartyMark":true|false,"usable":true|false,"alt":"under 120 chars, plain description of what is shown","note":"a few words"}`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
        { type: "text", text: `Article headline: "${title}"\nNamed subject: ${subject}\nPublished as the lead image on: ${image.pageUrl || "unknown"}\nImage filename: ${image.filename || "unknown"}\n\nJudge the photograph.` },
      ],
    }],
  });

  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  const bool = (k) => new RegExp(`"${k}"\\s*:\\s*true`, "i").test(text);
  const str = (k) => (text.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`, "i")) || [])[1] || null;
  return {
    onSubject: bool("onSubject"),
    thirdPartyMark: bool("thirdPartyMark"),
    usable: bool("usable"),
    alt: str("alt"),
    note: str("note"),
    cost: res.usage,
  };
}

/**
 * Try to find a photograph of what the article is actually about.
 *
 * @returns {{url,alt,credit,source}|null} null means "carry on with stock".
 */
export async function subjectImage(site, { title, body, sourceUrl, subject }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const ua = `Mozilla/5.0 (compatible; CogentBot/1.0; +https://${site.domain || "cogentmultimedia.co.uk"})`;
  const tried = [];

  // No named subject means there is nothing for this path to look for, and the
  // stock search is the correct answer rather than a fallback.
  const named = String(subject || "").trim();
  if (!named) return null;

  for (const page of pagesFrom({ body, sourceUrl, siteDomain: site.domain })) {
    try {
      const html = await fetchText(page, ua);
      if (!html) continue;
      const imgUrl = metaImage(html, page);
      if (!imgUrl) continue;
      const host = hostOf(page);
      if (tried.includes(imgUrl)) continue;
      tried.push(imgUrl);

      const image = await fetchImage(imgUrl, ua);
      if (!image) continue;
      image.pageUrl = page;

      const v = await verify(site, { title, subject: named, image });
      if (v.thirdPartyMark) {
        console.warn(`[subject-image] ${host}: rejected, carries another publication's mark`);
        continue;
      }
      if (!v.onSubject || !v.usable) continue;

      return {
        url: imgUrl,
        alt: v.alt || `${named}`,
        // Credit the site it came from. imageCredit is already rendered under
        // the image by lib/actions.js, so this needs no template work.
        credit: `Photo: ${host}`,
        source: `subject:${host}`,
      };
    } catch {
      // Any page can fail for any reason. Try the next one.
    }
  }
  return null;
}
