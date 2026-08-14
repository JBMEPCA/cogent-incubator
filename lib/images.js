// Smart image selection: Claude-written queries, Openverse + Wikimedia Commons
// candidates, Claude relevance pick, validated download, a hard never-repeat
// rule against every image already used by any article, and a second
// never-repeat rule at the level of the photo SHOOT (see shootKey).
import { userAgent } from "./voice.js";
import Anthropic from "@anthropic-ai/sdk";
import { forSite } from "./prisma";

// Set per title in chooseSmartImage: stock libraries see this.
let UA = { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" };

// These two calls are routing, not judgement: write three search queries, and
// pick an index from a list. Haiku does both at a fifth of the price. The
// picture gate in lib/qa.js stays on Opus, because that one looks at actual
// pixels and is the check that stops a wrong logo reaching a published page.
const ROUTING_MODEL = "claude-haiku-4-5";

async function ask(system, user, maxTokens = 400) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: ROUTING_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  try { (await import("./agents/meter")).recordUsage(res.model || ROUTING_MODEL, res.usage); } catch {}
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

export async function chooseSmartImage(site, { title, keyphrase, category }) {
  UA = { "user-agent": userAgent(site) };
  const db = forSite(site.id);
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
  const nearby = history
    .filter((a) => !category || a.category === category)
    .slice(0, 5)
    .map((a) => a.imageAlt)
    .filter(Boolean);

  const queries = JSON.parse(
    await ask(
      "You choose stock/press photo search queries for news article headers. Reply with ONLY a JSON array of 3 strings, most specific first. Queries should describe the VISUAL subject wanted (objects, scenes, screens), not abstract concepts.",
      `Article: "${title}"\nKeyphrase: ${keyphrase || "n/a"}\n` +
        (nearby.length
          ? `\nRecent header images in this section, which you must NOT restate — pick visibly different subjects, settings and framing:\n${nearby
              .map((a) => `- ${a}`)
              .join("\n")}\n`
          : "") +
        `\nWhat should the header photo show? 3 search queries.`,
      300
    )
  );

  const rot = seed(title);
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
  if (!candidates.length) return null;

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

  // Each attempt is a full vision call, so this cap is a direct cost lever.
  // Three is enough in practice: the metadata shortlist is already ranked, and
  // when three sensible candidates all fail it is usually the topic that is
  // unphotographable rather than the shortlist being unlucky.
  for (const idx of order.slice(0, 3)) {
    const chosen = candidates[idx];
    for (const url of [chosen.url, chosen.thumb]) {
      if (!(await download(url))) continue;
      const check = await verifyImage({ site, imageUrl: url, title, keyphrase });
      if (!check.ok) break; // bad picture, not a bad URL: move to the next candidate
      return {
        url,
        alt: check.altText,
        score: check.score,
        source: shootKey(chosen),
        credit:
          chosen.needsCredit && chosen.creator
            ? `Image: ${chosen.creator} (${chosen.license}) via ${chosen.source}`
            : null,
      };
    }
  }
  return null;
}
