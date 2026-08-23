// The subject photograph: the actual place, or the actual person.
//
// WHY THIS EXISTS
//
// Everything in lib/images.js is a stock search. That is the right answer for
// "what does dynamic pricing require", and the wrong answer for "Paul Stuart
// wins the PGA Award for Excellence" or "Legacy Golf Properties buys Achasta".
// A trade reader looking at an appointment wants the person, and looking at an
// acquisition wants the course. A representative fairway is a visible admission
// that nobody went and got the picture.
//
// WHAT THE FIRST VERSION GOT WRONG, measured over two live days on golf with
// ZERO subject images found:
//
//  1. It sized images in BYTES, copied from the stock helper. The Golf Wire's
//     picture of Achasta is a 4.8KB thumbnail at 167x118 — correctly unusable,
//     but the floor rejected it for the wrong reason and would equally have
//     rejected a well-compressed 900px press shot. Now it measures PIXELS.
//  2. It only looked at pages the article already linked, and the subject's own
//     website is almost never among them. Achasta's story linked the newswire
//     and nothing else, while achastagolf.com sat there with an aerial as its
//     og:image. Now the subject's own domain is resolved and tried FIRST.
//  3. It logged only watermark rejections, so every other failure was silent
//     and had to be hand-traced. Now every rejection states its reason.
//
// THE ONE HARD RULE
//
// The Paul Stuart photograph on golfmanagement.online has GOLF MANAGEMENT burnt
// into the frame. Running it would print a rival trade title's masthead on our
// own article. Any third-party mark is an outright reject, and that check is
// asked separately from whether the picture is on subject.
//
// APPLICABILITY, so nobody expects too much
//
// Roughly one news story in five names a single photographable thing. The rest
// are studies, trends and multi-company announcements where a representative
// image is genuinely correct. This path is meant to win that one, not all five.
//
// FAIL-SAFE
//
// Every failure returns null and the caller drops through to the existing stock
// search untouched. This can never be the reason an article fails to publish.
import Anthropic from "@anthropic-ai/sdk";

async function brief(site) {
  try {
    const { titleBrief } = await import("./voice");
    return titleBrief(site);
  } catch {
    return `You are the picture editor for ${site?.name || "this title"}.`;
  }
}

const VISION_MODEL = "claude-haiku-4-5";
const EXTRACT_MODEL = "claude-haiku-4-5";

// 700, not 800. Club + Resort Business serves every og:image at 770px wide and
// they are perfectly good headers - the Orchard Valley aerial we wanted is one
// of them. An 800 floor silently excluded one of the better sources on the wire
// while still catching the real thumbnails: The Golf Wire's Achasta picture is
// 167x118.
const MIN_WIDTH = 700;
const MIN_HEIGHT = 380;
const MAX_BYTES = 4_500_000; // the vision API's practical ceiling
const MAX_PAGES = 4;
const MAX_GUESSES = 3;

// An overall wall-clock budget, because the failure mode here is latency, not
// error. Landscapes Golf Management alone spent a 10s timeout on one domain and
// a failed DNS lookup on another before finding its picture. Four pages plus
// three domain guesses, each able to hang to its own timeout, is over a minute
// of a serverless invocation spent on a header image. Past the budget we stop
// and take stock, which is the outcome we were heading for anyway.
const BUDGET_MS = 40000;

const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SKIP_HOST = /(^|\.)(google|googleusercontent|facebook|twitter|linkedin|instagram|youtube|youtu|pinterest|doubleclick|gravatar|w3|schema|cloudflare|hubspot|adobe)\.[a-z.]+$/i;

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

/* ------------------------------------------------------------ dimensions */

/**
 * Pixel dimensions straight from the file header.
 *
 * Hand-parsed rather than handed to sharp: this runs inside the serverless
 * request path, and a native binary that is fine in a local script is not a
 * dependency worth taking on for four integers.
 */
function imageSize(b) {
  try {
    // PNG
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // GIF
    if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49) {
      return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    }
    // WebP (VP8X / VP8 / VP8L)
    if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const fmt = b.toString("ascii", 12, 16);
      if (fmt === "VP8X") return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
      if (fmt === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (fmt === "VP8L") {
        const n = b.readUInt32LE(21);
        return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
      }
    }
    // JPEG: walk the segments to the start-of-frame
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        const len = b.readUInt16BE(i + 2);
        if (len < 2) break;
        i += 2 + len;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/* ----------------------------------------------------------------- fetch */

async function fetchText(url, ua) {
  const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "follow", signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  if (!(res.headers.get("content-type") || "").toLowerCase().includes("html")) return null;
  return (await res.text()).slice(0, 400000);
}

function metaImage(html, pageUrl) {
  const pick = (re) => { const m = String(html).match(re); return m ? m[1] : null; };
  const raw =
    pick(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!raw) return null;
  try { return new URL(raw, pageUrl).href; } catch { return null; }
}

async function fetchImage(url, ua) {
  const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "follow", signal: AbortSignal.timeout(9000) });
  if (!res.ok) return { reject: `image HTTP ${res.status}` };
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!OK_TYPES.has(type)) return { reject: `not an image (${type || "no type"})` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return { reject: `too large (${Math.round(buf.byteLength / 1024)}KB)` };

  const size = imageSize(buf);
  if (!size || !size.w) return { reject: "could not read dimensions" };
  if (size.w < MIN_WIDTH || size.h < MIN_HEIGHT) {
    return { reject: `thumbnail, ${size.w}x${size.h}` };
  }

  let filename = "";
  try { filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch {}
  return { base64: buf.toString("base64"), type, filename, size };
}

/* --------------------------------------------------- the subject's own site */

/**
 * The one named thing this story is about, if there is one.
 *
 * Worth a cheap call: the alternative is regexing capitalised phrases out of a
 * headline, which turns "Three Golf Bodies Fund Global CO2 Study" into a hunt
 * for a company called Global CO2 Study.
 */
async function namedSubject(title, body) {
  const res = await client().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 150,
    system: `You identify whether a trade news headline is about ONE specific, photographable thing.

Reply ONLY with JSON: {"name":"...","kind":"venue|person|company|none"}

"venue" for a named golf course, resort, club or hotel. "person" for a named individual. "company" for a single named business. "none" when the story is a study, a trend, a market report, or names three or more organisations equally: those have nothing single to photograph and a stock image is correct for them.

For a person, give the person's name. For a venue, give the venue's name WITHOUT words like "Golf Club" removed - keep it as written. Never invent a name that is not in the text.`,
    messages: [{ role: "user", content: `Headline: ${title}\n\nFirst part of the article:\n${String(body || "").replace(/<[^>]+>/g, " ").slice(0, 700)}` }],
  });
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  const name = (text.match(/"name"\s*:\s*"([^"]*)"/i) || [])[1] || "";
  const kind = (text.match(/"kind"\s*:\s*"([^"]*)"/i) || [])[1] || "none";
  return { name: name.trim(), kind: kind.trim().toLowerCase() };
}

/** Domain guesses for a named venue or company. */
function domainGuesses(name) {
  const words = String(name).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const stop = new Set(["the", "at", "of", "and", "resort", "hotel", "club", "course", "golf", "links", "country"]);
  const core = words.filter((w) => !stop.has(w));
  const base = (core.length ? core : words).join("");
  if (base.length < 4) return [];
  const all = words.join("");
  const out = [`${base}.com`, `${base}golf.com`, `${all}.com`, `${base}.co.uk`];
  return [...new Set(out)].slice(0, MAX_GUESSES);
}

/** A guess is only accepted if the page repeats the name back at us. */
async function resolveOwnSite(name, ua, log, deadline) {
  for (const d of domainGuesses(name)) {
    if (Date.now() > deadline) { log("domain guessing: out of time"); return null; }
    try {
      const html = await fetchText(`https://${d}/`, ua);
      if (!html) continue;
      const needle = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
      const hay = html.toLowerCase().replace(/[^a-z0-9]/g, "");
      const first = (String(name).toLowerCase().match(/[a-z]{4,}/) || [])[0];
      if (!needle || (!hay.includes(needle) && !(first && hay.includes(first)))) {
        log(`${d}: reachable but does not name the subject`);
        continue;
      }
      log(`${d}: resolved as the subject's own site`);
      return { url: `https://${d}/`, html };
    } catch {
      // next guess
    }
  }
  return null;
}

/* ------------------------------------------------------------------ gate */

async function verify(site, { title, subject, image, pageUrl }) {
  const res = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: 400,
    system: `${await brief(site)}

You are the picture editor checking ONE candidate photograph, taken either from the organisation an article is about or from the outlet that reported it.

Unlike a stock photograph, this picture is SUPPOSED to show the specific place, building, course or person the article names. A recognisable named individual is correct here, not a fault.

1. ON SUBJECT. Weigh PROVENANCE, not just pixels. You are told the page it came from and the image filename. Nobody can identify a particular golf course from an aerial by eye, and being unable to is not a reason to reject: the lead image on a page about this story, or the hero image on the subject's own website, is that subject. Accept unless the picture CONTRADICTS the story - a person where the story is about a venue, an obviously different industry, a stock scene that could be anywhere with no provenance. Reject on mismatch of KIND, not of certainty.

2. THIRD-PARTY MARK. Does it carry a watermark, masthead, byline bar or logo belonging to some OTHER publication, agency or stock library? Publishing a rival trade title's branded image puts their logo on our page. Any burnt-in publication name, agency credit bar or stock watermark is a reject. The subject's OWN logo, on their own building, signage or clothing, is fine.

3. USABLE. A real photograph of adequate quality, not a logo, poster, graphic, map, chart, screenshot or collage.

Reply ONLY with JSON:
{"onSubject":true|false,"thirdPartyMark":true|false,"usable":true|false,"alt":"under 120 chars, plain description","note":"a few words"}`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
        { type: "text", text: `Article headline: "${title}"\nNamed subject: ${subject}\nImage came from: ${pageUrl}\nImage filename: ${image.filename || "unknown"}\nDimensions: ${image.size.w}x${image.size.h}\n\nJudge the photograph.` },
      ],
    }],
  });
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  const bool = (k) => new RegExp(`"${k}"\\s*:\\s*true`, "i").test(text);
  const str = (k) => (text.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`, "i")) || [])[1] || null;
  return { onSubject: bool("onSubject"), thirdPartyMark: bool("thirdPartyMark"), usable: bool("usable"), alt: str("alt") };
}

/* ------------------------------------------------------------------ main */

export async function subjectImage(site, { title, body, sourceUrl }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const ua = `Mozilla/5.0 (compatible; CogentBot/1.0; +https://${site.domain || "cogentmultimedia.co.uk"})`;
  const deadline = Date.now() + BUDGET_MS;
  const tag = `[subject-image] ${site.slug}`;
  const log = (m) => console.log(`${tag}: ${m}`);

  let subject;
  try {
    subject = await namedSubject(title, body);
  } catch (e) {
    log(`subject extraction failed: ${String(e.message).slice(0, 80)}`);
    return null;
  }
  if (!subject.name || subject.kind === "none") {
    log(`no single photographable subject ("${title.slice(0, 48)}") - stock is correct`);
    return null;
  }
  log(`subject: ${subject.name} (${subject.kind})`);

  // Candidate pages, best first: the subject's own website, then anything the
  // article linked, then the outlet that reported it.
  const pages = [];
  const seen = new Set();
  const push = (u, html = null) => {
    const h = hostOf(u);
    if (!h || seen.has(h) || SKIP_HOST.test(h)) return;
    if (site.domain && h.endsWith(String(site.domain).replace(/^www\./, ""))) return;
    seen.add(h);
    pages.push({ url: u, html });
  };

  if (subject.kind === "venue" || subject.kind === "company") {
    try {
      const own = await resolveOwnSite(subject.name, ua, log, deadline);
      if (own) push(own.url, own.html);
    } catch { /* keep going */ }
  }
  for (const m of String(body || "").matchAll(/href="(https?:\/\/[^"]+)"/gi)) push(m[1]);
  if (sourceUrl) push(sourceUrl);

  for (const page of pages.slice(0, MAX_PAGES)) {
    if (Date.now() > deadline) { log("out of time, falling back to stock"); break; }
    const host = hostOf(page.url);
    try {
      const html = page.html || (await fetchText(page.url, ua));
      if (!html) { log(`${host}: page not readable`); continue; }
      const imgUrl = metaImage(html, page.url);
      if (!imgUrl) { log(`${host}: no og:image`); continue; }

      const image = await fetchImage(imgUrl, ua);
      if (image.reject) { log(`${host}: ${image.reject}`); continue; }

      const v = await verify(site, { title, subject: subject.name, image, pageUrl: page.url });
      if (v.thirdPartyMark) { log(`${host}: rejected, carries another publication's mark`); continue; }
      if (!v.usable) { log(`${host}: rejected, not a usable photograph`); continue; }
      if (!v.onSubject) { log(`${host}: rejected, does not show ${subject.name}`); continue; }

      log(`${host}: ACCEPTED ${image.size.w}x${image.size.h} for ${subject.name}`);
      return {
        url: imgUrl,
        alt: v.alt || subject.name,
        credit: `Photo: ${host}`,
        source: `subject:${host}`,
      };
    } catch (e) {
      log(`${host}: ${String(e.message).slice(0, 70)}`);
    }
  }

  log(`no usable subject photo for ${subject.name} - falling back to stock`);
  return null;
}
