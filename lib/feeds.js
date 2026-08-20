// Dependency-free RSS/Atom discovery and parsing for the feed-ingestion cron.

const UA =
  "Mozilla/5.0 (compatible; CogentBot/1.0)";

async function fetchText(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeFeed(text) {
  if (!text) return false;
  const head = text.slice(0, 500).trim().toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf");
}

// Find a feed for a news-hub URL: <link rel="alternate"> first, common paths second.
export async function discoverFeed(hubUrl) {
  const html = await fetchText(hubUrl);
  if (html) {
    const linkTags = html.match(/<link[^>]+>/gi) || [];
    for (const tag of linkTags) {
      if (!/application\/(rss|atom)\+xml/i.test(tag)) continue;
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      try {
        const abs = new URL(href, hubUrl).href;
        const feedText = await fetchText(abs);
        if (looksLikeFeed(feedText)) return { feedUrl: abs, xml: feedText };
      } catch {}
    }
  }
  const base = new URL(hubUrl);
  const candidates = [
    new URL("feed", hubUrl.endsWith("/") ? hubUrl : hubUrl + "/").href,
    `${base.origin}/feed`,
    `${base.origin}/rss`,
    `${base.origin}/rss.xml`,
    `${base.origin}/feed.xml`,
    `${base.origin}/atom.xml`,
    `${base.origin}/blog/feed`,
    `${base.origin}/news/feed`,
  ];
  // Concurrently, on a short timeout. These eight are independent guesses at
  // one host, and tried one after another on a 10s timeout a single dead host
  // could spend ninety seconds — twice the whole fleet's scan budget — proving
  // that a brand has no feed. Order still decides the winner; only the waiting
  // is shared.
  const unique = [...new Set(candidates)];
  const bodies = await Promise.all(unique.map((c) => fetchText(c, 5000)));
  for (let i = 0; i < unique.length; i++) {
    if (looksLikeFeed(bodies[i])) return { feedUrl: unique[i], xml: bodies[i] };
  }
  return null;
}

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function textOf(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return decodeEntities(stripCdata(m[1]).replace(/<[^>]+>/g, "").trim()) || null;
}

// Parse RSS 2.0 / RDF / Atom into [{title, link, summary, publishedAt}].
export function parseFeed(xml) {
  const items = [];
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const title = textOf(block, "title");
    const link = textOf(block, "link") || block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    const dateRaw = textOf(block, "pubDate") || textOf(block, "dc:date");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      summary: textOf(block, "description"),
      publishedAt: dateRaw ? new Date(dateRaw) : null,
    });
  }
  if (items.length === 0) {
    const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const block of entries) {
      const title = textOf(block, "title");
      const linkTag =
        block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
        block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
      const dateRaw = textOf(block, "published") || textOf(block, "updated");
      if (!title || !linkTag) continue;
      items.push({
        title,
        link: decodeEntities(linkTag),
        summary: textOf(block, "summary") || textOf(block, "content"),
        publishedAt: dateRaw ? new Date(dateRaw) : null,
      });
    }
  }
  return items
    .filter((i) => {
      try {
        new URL(i.link);
        return true;
      } catch {
        return false;
      }
    })
    .map((i) => ({
      ...i,
      publishedAt: i.publishedAt && !isNaN(i.publishedAt) ? i.publishedAt : null,
      summary: i.summary ? i.summary.slice(0, 500) : null,
      title: i.title.slice(0, 300),
    }));
}

const MAX_ITEMS_PER_FEED = 10;
const MAX_AGE_DAYS = 60;

/**
 * Ingest a list of parsed items for a brand.
 *
 * `baseline` records them as already-seen rather than as news. That exists for
 * the sitemap sources, whose first scan hands over the site's entire back
 * catalogue: without it the Researcher wakes up to ten arbitrary two-year-old
 * BVRLA posts and commissions from them.
 */
async function ingest(db, brand, items, { baseline = false } = {}) {
  let added = 0;
  for (const item of items) {
    try {
      await db.feedItem.create({
        data: {
          brandId: brand.id,
          title: item.title,
          link: item.link,
          summary: item.summary,
          publishedAt: item.publishedAt,
          status: baseline ? "dismissed" : "new",
        },
      });
      added++;
    } catch {
      // unique(siteId, link) collision — already ingested
    }
  }
  return added;
}

// A newsroom with no feed, read through lib/newsrooms.js. Returns {status, added}.
async function scanNewsroom(db, brand, spec) {
  const { readHtmlNewsroom, readSitemapNewsroom } = await import("./newsrooms.js");
  const items =
    spec.kind === "sitemap" ? await readSitemapNewsroom(spec) : await readHtmlNewsroom(spec);

  if (!items || !items.length) {
    await db.prBrand.update({
      where: { id: brand.id },
      data: { feedStatus: "error", lastScannedAt: new Date() },
    });
    return { status: "error", added: 0 };
  }

  // First contact with a sitemap source is a baseline, not a haul. Everything
  // it lists today is history; from the next scan on, anything new in the file
  // is a new article, which is the only signal this kind of source gives.
  const known = await db.feedItem.count({ where: { brandId: brand.id } });
  const baseline = spec.kind === "sitemap" && known === 0;

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000);
  const fresh = items.filter((i) => !i.publishedAt || i.publishedAt > cutoff);
  const added = await ingest(
    db,
    brand,
    baseline ? fresh : fresh.slice(0, MAX_ITEMS_PER_FEED),
    { baseline }
  );

  await db.prBrand.update({
    where: { id: brand.id },
    // No feedUrl to record — there isn't one, and writing the listing URL into
    // that column would send the next scan down the RSS path to a 200 of HTML.
    data: { feedStatus: "ok", lastScannedAt: new Date() },
  });
  return { status: "ok", added: baseline ? 0 : added, baselined: baseline ? added : undefined };
}

// Scan one brand: discover feed if unknown, parse, insert new items.
// Returns {status, added}.
export async function scanBrand(db, brand) {
  let feedUrl = brand.feedUrl;
  let xml = null;

  // Hand-verified sources first, because the whole point of the registry is
  // that the automatic path has already been tried and lost.
  if (!feedUrl) {
    const { newsroomFor } = await import("./newsrooms.js");
    const spec = newsroomFor(brand);
    if (spec && spec.kind !== "feed") return scanNewsroom(db, brand, spec);
    if (spec) feedUrl = spec.feedUrl;
  }

  if (!feedUrl) {
    const found = brand.newsHubUrl ? await discoverFeed(brand.newsHubUrl) : null;
    if (!found) {
      await db.prBrand.update({
        where: { id: brand.id },
        data: { feedStatus: "none", lastScannedAt: new Date() },
      });
      return { status: "none", added: 0 };
    }
    feedUrl = found.feedUrl;
    xml = found.xml;
  }

  if (!xml) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(feedUrl, {
        headers: { "user-agent": UA },
        signal: controller.signal,
      });
      xml = res.ok ? await res.text() : null;
    } catch {
      xml = null;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!looksLikeFeed(xml)) {
    await db.prBrand.update({
      where: { id: brand.id },
      data: { feedUrl, feedStatus: "error", lastScannedAt: new Date() },
    });
    return { status: "error", added: 0 };
  }

  const parsed = parseFeed(xml);

  // A valid feed carrying no items at all is its own state, not a success.
  // Logistics UK's /feed is exactly that — a well-formed WordPress channel with
  // an empty <channel>, because its news lives in a custom post type — and
  // recording it as "ok" is how a trade body sat in the source list for days
  // showing a green tick and zero items. "empty" puts it on the settings page
  // next to the errors, where somebody will go and find the real URL.
  if (!parsed.length) {
    await db.prBrand.update({
      where: { id: brand.id },
      data: { feedUrl, feedStatus: "empty", lastScannedAt: new Date() },
    });
    return { status: "empty", added: 0 };
  }

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000);
  const items = parsed
    .filter((i) => !i.publishedAt || i.publishedAt > cutoff)
    .slice(0, MAX_ITEMS_PER_FEED);

  const added = await ingest(db, brand, items);

  await db.prBrand.update({
    where: { id: brand.id },
    data: { feedUrl, feedStatus: "ok", lastScannedAt: new Date() },
  });
  return { status: "ok", added };
}
