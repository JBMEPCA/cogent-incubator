// Smart image selection: Claude-written queries, Openverse + Wikimedia Commons
// candidates, Claude relevance pick, validated download, a hard never-repeat
// rule against every image already used by any article, and a second
// never-repeat rule at the level of the photo SHOOT (see shootKey).
import { userAgent, titleBrief } from "./voice.js";
import { recordUsage } from "./agents/meter";
import Anthropic from "@anthropic-ai/sdk";
import { forSite } from "./prisma";

// Set per title in chooseSmartImage: stock libraries see this.
let UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// These two calls are routing, not judgement: write three search queries, and
// pick an index from a list. Haiku does both at a fifth of the price. The
// picture gate in lib/qa.js looks at the actual pixels and is the check that
// stops a wrong logo reaching a published page; it moved to Haiku too on
// 17 Aug 2026, which is what makes MAX_GATE_ATTEMPTS below affordable.
const ROUTING_MODEL = "claude-haiku-4-5";

async function ask(system, user, maxTokens = 400) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: ROUTING_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  recordUsage(res.model || ROUTING_MODEL, res.usage);
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  return text.trim().replace(/^```json?\s*|\s*```$/g, "");
}

/*
 * A shoot key names the photo SET a candidate came from, not the file.
 *
 * Stock libraries sell shoots: search Pexels for anything AI-flavoured and the
 * top results are six frames of the same man at the same laptop with the same
 * glasses on the same fabric, each under its own URL. The old never-repeat rule
 * compared URLs, so all six were "different" images and three of them landed in
 * the AI & Automation section at once. Keying on the photographer collapses a
 * shoot to one entry, which is the unit a reader actually notices.
 */
function shootKey(c) {
  const who = String(c.creatorId || c.creator || "").trim().toLowerCase();
  return who ? `${c.source.toLowerCase()}:${who}` : null;
}

// Deterministic per-title seed, used to rotate result lists. Two articles on
// near-identical subjects write near-identical queries and get back the same
// ranked page from Pexels; without this they would keep meeting at the top of
// it. Not random, so a retry for the same article stays reproducible.
function seed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function rotate(list, n) {
  if (list.length < 2) return list;
  const at = n % list.length;
  return list.slice(at).concat(list.slice(0, at));
}

async function download(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return false;
    if (!(res.headers.get("content-type") || "").startsWith("image/")) return false;
    return (await res.arrayBuffer()).byteLength > 15000;
  } catch {
    return false;
  }
}

async function openverse(q, params) {
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&per_page=8&${params}`,
      { headers: UA }
    );
    if (!res.ok) return [];
    return ((await res.json()).results || []).map((r) => ({
      source: "Openverse",
      title: r.title || "",
      tags: (r.tags || []).map((t) => t.name).slice(0, 8).join(", "),
      url: r.url,
      thumb: r.thumbnail,
      width: r.width || 0,
      creator: r.creator,
      license: r.license,
      needsCredit: !["cc0", "pdm"].includes(r.license),
    }));
  } catch {
    return [];
  }
}

async function wikimedia(q) {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrlimit=8&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata`,
      { headers: UA }
    );
    if (!res.ok) return [];
    const pages = Object.values((await res.json()).query?.pages || {});
    return pages
      .map((p) => {
        const ii = p.imageinfo?.[0];
        if (!ii) return null;
        const meta = ii.extmetadata || {};
        return {
          source: "Wikimedia Commons",
          title: p.title.replace("File:", ""),
          tags: (meta.Categories?.value || "").slice(0, 100),
          url: ii.url,
          thumb: ii.url,
          width: ii.width || 0,
          creator: (meta.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 50),
          license: meta.LicenseShortName?.value || "",
          needsCredit: !/public domain|cc0/i.test(meta.LicenseShortName?.value || ""),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Pexels: primary source when PEXELS_API_KEY is set — modern commercial-grade
// stock, free license, no attribution required.
//
// 30 results rather than 10, then rotated by the caller's seed: a page of 10 is
// mostly one or two shoots, so once those are excluded there is nothing left to
// choose from and the picker falls back to whatever is nearly identical.
async function pexels(q, rot = 0) {
  if (!process.env.PEXELS_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=30&orientation=landscape`,
      { headers: { authorization: process.env.PEXELS_API_KEY, ...UA } }
    );
    if (!res.ok) return [];
    return rotate(
      ((await res.json()).photos || []).map((p) => ({
        source: "Pexels",
        title: p.alt || "",
        tags: "",
        url: p.src?.large2x || p.src?.large,
        thumb: p.src?.large,
        width: p.width || 0,
        creator: p.photographer,
        creatorId: p.photographer_id,
        license: "Pexels",
        needsCredit: false,
      })),
      rot
    );
  } catch {
    return [];
  }
}

// Each gate attempt is one vision call. That cap was set to three when the gate
// ran on Opus and a retry cost real money; the gate moved to Haiku on 17 Aug
// 2026 and an attempt is now about $0.002, so three was buying nothing but
// bare posts. Five is still under a cent per article and it is the difference
// between clearing a shortlist and giving up two candidates in.
const MAX_GATE_ATTEMPTS = 5;

/**
 * Source a header image.
 *
 * Returns `{ image, reason, tried }`. `image` is null when nothing could be
 * found, and then `reason` says WHICH stage failed and `tried` lists what the
 * picture gate actually said. It used to return a bare null, so every caller
 * reported the same invented sentence — "every candidate failed the visual
 * check" — whether the gate had rejected five photographs, the search had
 * returned none at all, or the downloads had 403'd. Twelve identical failures
 * on one Fleet article were logged that way before anyone could see that the
 * gate was rejecting perfectly good pictures for not depicting a named company.
 *
 * `attempt` is the number of previous goes at THIS article. Everything here is
 * deterministic — the seed comes from the title — so without it the Designer's
 * twelfth run reissued the tenth run's search, word for word, and lost again.
 */
export async function chooseSmartImage(site, { title, keyphrase, category, attempt = 0 }) {
  UA = { "user-agent": userAgent(site) };
  const db = forSite(site.id);
  const tried = [];
  const fail = (reason) => ({ image: null, reason, tried });
  // The archive is read before the queries are written, because what has
  // already run is an input to both: it tells the query writer which visual
  // ideas are spent, and it supplies the two exclusion sets below.
  const history = await db.article.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true, imageSource: true, imageAlt: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  const used = new Set(history.map((a) => a.imageUrl));
  // Shoots expire from the exclusion list; URLs never do. A photographer whose
  // work has not run in the last forty articles is no longer recognisable as a
  // repeat, and holding the whole archive against them would starve the picker
  // on a small site with a house style.
  const usedShoots = new Set(history.slice(0, 40).map((a) => a.imageSource).filter(Boolean));
  // Art direction for the query writer: what this section has been showing.
  //
  // Only on the first go. This is a soft "vary the look" nudge, and on a small
  // archive it steers hard: two aerial fairways in Development & Design was
  // enough to push every subsequent golf query away from aerials, which are the
  // one framing that reliably clears the gate. Actual repeats are still
  // impossible — `used` and `usedShoots` below are the rule, this is the taste.
  const nearby =
    attempt > 0
      ? []
      : history
          .filter((a) => !category || a.category === category)
          .slice(0, 5)
          .map((a) => a.imageAlt)
          .filter(Boolean);

  const queries = JSON.parse(
    await ask(
      // The brief, because the query writer was the one agent in the pipeline
      // that never got it. Reading only a headline, it searched "sports
      // complex" for a golf resort's reinvestment story and came back with
      // tennis courts, and every one of them was correctly thrown out.
      `${titleBrief(site)}\n\n` +
        "You choose stock/press photo search queries for news article headers on this title. Reply with ONLY a JSON array of 3 strings, most specific first. Queries should describe the VISUAL subject wanted (objects, scenes, screens), not abstract concepts.\n\n" +
        // Without this the writer asks for the obvious picture of the trade, and
        // on a vehicle title the obvious picture is a lorry in somebody's
        // livery. The gate then rejects it for showing a brand the article does
        // not name, which is correct and which no amount of retrying fixes:
        // three of Fleet's bare posts died on exactly that loop.
        "Two rules, and the second is the one that gets broken.\n\n" +
        "1. NEUTRAL. The photograph illustrates a story about an organisation it does not depict, so readable third-party branding gets it rejected outright: company liveries, fleet decals, shop fascias, hoardings, a product UI on screen, a recognisable named person. On vehicle, retail and technology subjects that is the commonest reason a search returns nothing usable, so write around it — unmarked equipment, close work on parts, materials and hands, empty infrastructure, wide or aerial views where no logo can be read.\n\n" +
        // The first version of rule 1 shipped without rule 2 and the writer
        // solved it by leaving the trade altogether: a company car tax story
        // got three searches for calculators and paperwork, and the gate threw
        // out all five candidates as having nothing to do with vehicles.
        "2. ON THE SUBJECT. Neutral does not mean unrelated. The picture must still show the trade this title covers. If the obvious subject is a branded object, ask for it unbranded — a plain white van rather than an office desk, an unmarked charger in a car park rather than a spreadsheet. A generic business scene that could illustrate any story in any industry is a failed query, not a safe one." +
        // Rule 2 kept being broken in one specific way, so it is now spelled
        // out. Barbering Business ran twenty failed image attempts in three
        // days while every other title ran nought or one, because its news is
        // regulatory - business rates, balloting rules, HMRC supervision - and
        // on those the writer reached for clipboards, boardrooms and, on 27
        // August, an estate agent holding property documents. The picture gate
        // then correctly threw all five out as having nothing to do with
        // barbering, and four finished articles sat unpublished for two days.
        "3. NO PHOTOGRAPHABLE SUBJECT? SHOOT THE WORKPLACE. Tax, consultations, licensing, employment law and survey findings cannot be photographed. Do NOT fall back on clipboards, contracts, handshakes, laptops or meeting rooms: a generic office is not this title's trade and will be rejected. Ask instead for the working setting of the trade itself - the shop floor, the chair, the counter, the tools, the yard, the course - which is what a trade editor actually runs above a policy story.",
        // A third rule was tried here and removed on the measurement. It told
        // the writer never to search for a named model, because a "BYD Sealion 7
        // company car tax" headline sends it hunting a car stock does not have
        // and the gate then throws out five photographs of the wrong one. It
        // fixed nothing and cost a lot: first-pass hits across the five articles
        // that had published bare went from four to two, because on every OTHER
        // headline it read as permission to leave the trade. That article is
        // genuinely unillustratable from a stock library, and the Designer's
        // four-attempt limit is the right way to say so.
      `Article: "${title}"\nKeyphrase: ${keyphrase || "n/a"}\n` +
        (nearby.length
          ? `\nRecent header images in this section, which you must NOT restate — pick visibly different subjects, settings and framing:\n${nearby
              .map((a) => `- ${a}`)
              .join("\n")}\n`
          : "") +
        (attempt > 0
          ? `\nEarlier searches for this article found nothing the picture desk would run. This is go ${attempt + 1}: change the subject, not the wording.\n`
          : "") +
        `\nWhat should the header photo show? 3 search queries.`,
      300
    )
  );

  // Offset by the attempt so a retry meets a different part of the result page.
  const rot = seed(title) + attempt * 7;
  let candidates = [];
  for (const q of queries) {
    candidates = candidates.concat(await pexels(q, rot));
    if (candidates.length >= 8) break;
  }
  if (candidates.length < 8) {
    for (const q of queries) {
      candidates = candidates.concat(await openverse(q, "license=cc0,pdm"));
      candidates = candidates.concat(await wikimedia(q));
      if (candidates.length < 6) candidates = candidates.concat(await openverse(q, "license_type=commercial"));
    }
  }

  // Never repeat an image any article has used before, never repeat a recent
  // shoot, and never offer two frames of one shoot inside a single shortlist —
  // if the picker is choosing between six views of the same desk, the shortlist
  // is one candidate wearing six hats.
  const offered = new Set();
  candidates = candidates
    .filter((c) => c.width >= 500 && !used.has(c.url))
    .filter((c) => {
      const key = shootKey(c);
      if (!key) return true;
      if (usedShoots.has(key) || offered.has(key)) return false;
      offered.add(key);
      return true;
    })
    .slice(0, 18);
  if (!candidates.length) {
    return fail(
      `no candidates survived the filters. Searched: ${queries.map((q) => `"${q}"`).join(", ")}`
    );
  }

  // Regex extraction — tolerant of truncated/unescaped JSON in the reply.
  const pickRaw = await ask(
      'You pick the most RELEVANT header image for an article from candidate metadata. Prefer clearly on-topic, professional, non-cluttered photos; avoid memes, maps, diagrams, identifiable-individual portraits, and anything off-topic. Reply ONLY with JSON: {"pick": <index or -1 if none fit>, "why": "..."}',
      `Article: "${title}"\n\nCandidates:\n${candidates
        .map((c, i) => `${i}. [${c.source}] "${c.title}" tags: ${c.tags} (${c.width}px)`)
        .join("\n")}`,
      300
    );
  const pick = parseInt((pickRaw.match(/"pick"\s*:\s*(-?\d+)/) || [])[1] ?? "-1", 10);

  // Try the metadata pick first, then work down the shortlist. Every candidate
  // must pass VISUAL verification (Claude looks at the actual pixels) before we
  // accept it. Publishing nothing beats publishing the wrong logo.
  const { verifyImage } = await import("./qa");
  const order = [pick, ...candidates.map((_, i) => i)].filter(
    (i, n, arr) => i >= 0 && i < candidates.length && arr.indexOf(i) === n
  );

  for (const idx of order.slice(0, MAX_GATE_ATTEMPTS)) {
    const chosen = candidates[idx];
    let fetched = false;
    for (const url of [chosen.url, chosen.thumb]) {
      if (!(await download(url))) continue;
      fetched = true;
      const check = await verifyImage({ site, imageUrl: url, title, keyphrase });
      if (!check.ok) {
        // A bad picture, not a bad URL: the thumbnail of a rejected photo is
        // the same photo, so move to the next candidate rather than the next
        // size. The verdict is kept — it is the only record of what the gate
        // objects to, and reading five of them together is how a systematic
        // fault shows up as a fault rather than as bad luck.
        tried.push(`"${(chosen.title || "untitled").slice(0, 40)}" — ${check.reason}`);
        break;
      }
      return {
        image: {
          url,
          alt: check.altText,
          score: check.score,
          source: shootKey(chosen),
          credit:
            chosen.needsCredit && chosen.creator
              ? `Image: ${chosen.creator} (${chosen.license}) via ${chosen.source}`
              : null,
        },
        reason: null,
        tried,
      };
    }
    if (!fetched) tried.push(`"${(chosen.title || "untitled").slice(0, 40)}" — could not be downloaded`);
  }
  return fail(
    `${tried.length} of ${candidates.length} shortlisted images were tried and none passed the picture gate`
  );
}

/* --------------------------------------------------- the source's own photo */

// Take the picture from where the story came from.
//
// JB, 28 August 2026: "ideally the images should come from the source where the
// article is found." He is right, and it is what the trade press does. A press
// release carries a photograph precisely so that it gets published, and it is
// always a better picture than a stock library's idea of the subject: the
// actual product, the actual site, the actual people.
//
// It also fixes what no amount of prompt work could. Nine finished articles
// were unpublishable on 28 August because no library stocks a photograph of a
// named shear, a named hair system or a named email tool - and every one of
// those companies had a photograph of it on their own page.
//
// PRIMARY sources only by default: the company's own newsroom, a trade body, a
// regulator. Those images are published to be reused. Another magazine's
// article is a different matter - its photographs are usually licensed stock,
// and lifting one from a title competing for the same readers is the case that
// actually bites - so publishers are opt-in per call, never the default.
const PUBLISHER_HOSTS = [
  "hoteldive.com", "barberevo.com", "hospitalityinvestor.com", "fleetnews.co.uk",
  "commercialfleet.org", "golfbusinessnews.com", "thecaterer.com", "bighospitality.co.uk",
];

// Junk that is never a header: logos, icons, avatars, spacers, tracking pixels.
const NOT_A_PHOTO =
  /(logo|icon|favicon|sprite|avatar|badge|button|spacer|pixel|tracking|placeholder|1x1|blank)/i;

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function absolutise(src, base) {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

/**
 * The best photograph on the page the article was written from.
 * Returns { url, host, publisher } or null.
 */
export async function sourceImage(site, sourceUrl, { allowPublishers = false } = {}) {
  if (!sourceUrl) return null;
  const host = hostOf(sourceUrl);
  if (!host) return null;
  const publisher = PUBLISHER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (publisher && !allowPublishers) return null;

  let html;
  try {
    const res = await fetch(sourceUrl, {
      headers: { "user-agent": userAgent(site) },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const candidates = [];
  // The page's own declared share image first: it is chosen by whoever
  // published the story to represent it, which is exactly the job here.
  for (const prop of ["og:image", "twitter:image", "twitter:image:src"]) {
    const m = html.match(
      new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    ) || html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i")
    );
    if (m) candidates.push(m[1]);
  }
  // Then any large in-article image, in document order.
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(m[1]);
    if (candidates.length > 25) break;
  }

  const seen = new Set();
  for (const raw of candidates) {
    const url = absolutise(raw, sourceUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (NOT_A_PHOTO.test(url)) continue;
    // No extension test. Every CDN a modern site puts in front of its images
    // serves them from an extensionless path - Buffer's Ghost storage, and
    // Hostinger's imagedelivery.net, were both discarded by one - and download()
    // already proves the thing is an image by its content-type and its size,
    // which is the check that actually matters.
    // Prove it is a real, header-sized image before offering it to the gate.
    const buf = await download(url);
    if (!buf || buf.length < 15000) continue;
    return { url, host, publisher };
  }
  return null;
}
