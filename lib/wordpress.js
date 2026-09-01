// WordPress publishing arm.
//
// Every function takes the title's own `wp` credential — { url, username,
// appPassword } out of SiteCredential — instead of reading three environment
// variables. That is the whole multi-tenant change here: one fleet, many
// WordPress installs, and the only thing that decides which one gets written to
// is the argument passed in.
//
// The integration account behind these credentials is deliberately an EDITOR,
// not an administrator: it can publish posts and pages over REST but gets
// rest_forbidden on /wp/v2/settings. Site settings stay a human job in wp-admin.
export function isWordPressConfigured(wp) {
  return Boolean(wp?.url && wp?.username && wp?.appPassword);
}

function wpAuth(wp) {
  return Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
}

function wpBase(wp) {
  return `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2`;
}

/**
 * Find an image ALREADY in this title's media library, by its URL.
 *
 * Needed because the host blocks datacentre traffic. An image served from our
 * own WordPress answers every request from a laptop and 403s from Vercel, so
 * anything sideloaded or supplied by hand — a commissioned graphic, an original
 * illustration — could never be fetched back by the publisher that was about to
 * re-upload it. The picture gate failed it on "image fetch 403" and deferred the
 * article for ever, on an image that was sitting in the library the whole time.
 *
 * Returns the media id, or null when the URL is not ours.
 */
export async function findMediaByUrl(wp, url) {
  const file = String(url).split("/").pop()?.replace(/\.[a-z0-9]+$/i, "");
  if (!file) return null;
  const res = await fetch(`${wpBase(wp)}/media?search=${encodeURIComponent(file)}&per_page=20`, {
    headers: { authorization: `Basic ${wpAuth(wp)}` },
  });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items)) return null;
  const bare = (u) => String(u).split("?")[0];
  return items.find((m) => bare(m.source_url) === bare(url))?.id ?? null;
}

/** Write alt text onto an attachment already in the library. */
export async function setMediaAlt(wp, mediaId, alt) {
  if (!alt) return;
  await fetch(`${wpBase(wp)}/media/${mediaId}`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth(wp)}`, "content-type": "application/json" },
    body: JSON.stringify({ alt_text: alt }),
  });
}

// Sideload an external image into the WP media library with SEO alt text.
/**
 * Put an image in the media library, from a URL or from bytes we already hold.
 *
 * The bytes path exists for the interview franchise. A subject's photo arrives
 * as an email attachment, so there is no URL to fetch and nowhere to host one,
 * and the house rule is that supplied photos are the only ones we may use. Pass
 * `data` (a Buffer) with `contentType` instead of `imageUrl`.
 *
 * `caption` is worth setting on anything whose rights are not yet settled: it
 * shows in the editor next to the image, where a person about to hit publish
 * will actually see it.
 */
export async function uploadMedia(wp, { imageUrl, data, contentType: given, alt, caption, filename }) {
  let contentType = given || "image/jpeg";
  let buffer = data;

  if (!buffer) {
    const imgRes = await fetch(imageUrl, {
      headers: { "user-agent": "CogentBot/1.0" },
    });
    if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
    contentType = imgRes.headers.get("content-type") || "image/jpeg";
    buffer = Buffer.from(await imgRes.arrayBuffer());
  }
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

  const res = await fetch(`${wpBase(wp)}/media`, {
    method: "POST",
    headers: {
      authorization: `Basic ${wpAuth(wp)}`,
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}.${ext}"`,
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`WP media ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const media = await res.json();

  if (alt || caption) {
    await fetch(`${wpBase(wp)}/media/${media.id}`, {
      method: "POST",
      headers: { authorization: `Basic ${wpAuth(wp)}`, "content-type": "application/json" },
      body: JSON.stringify({ ...(alt ? { alt_text: alt } : {}), ...(caption ? { caption } : {}) }),
    });
  }
  return { id: media.id, url: media.source_url };
}

// Published post count per category, straight from WordPress.
//
// The live site is the authority here rather than the Article table: the
// homepage renders what WordPress holds, and several posts were published by
// hand or by an earlier script and have no app record at all. Counting our own
// rows would report sections as thin when they are not.
export async function categoryCounts(wp) {
  if (!isWordPressConfigured(wp)) return {};
  try {
    const res = await fetch(`${wpBase(wp)}/categories?per_page=100&_fields=name,count,slug`, {
      headers: { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" },
    });
    if (!res.ok) return {};
    const out = {};
    for (const c of await res.json()) {
      if (c.slug === "uncategorized") continue;
      out[c.name.replace(/&amp;/g, "&").trim()] = c.count || 0;
    }
    return out;
  } catch {
    return {};
  }
}

// Resolve a category name to its WP term id (creating it if missing).
export async function resolveCategory(wp, name) {
  if (!name) return null;
  const res = await fetch(
    `${wpBase(wp)}/categories?per_page=100&_fields=id,name`,
    { headers: { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" } }
  );
  if (res.ok) {
    const cats = await res.json();
    const clean = (s) => s.replace(/&amp;/g, "&").trim().toLowerCase();
    const hit = cats.find((c) => clean(c.name) === clean(name));
    if (hit) return hit.id;
  }
  const create = await fetch(`${wpBase(wp)}/categories`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth(wp)}`, "content-type": "application/json", "user-agent": "CogentBot/1.0" },
    body: JSON.stringify({ name }),
  });
  if (!create.ok) return null;
  return (await create.json()).id;
}

/**
 * The WordPress user a title's posts should be attributed to.
 *
 * Site.bylineMode was set by the new-title wizard and then read by nothing, so
 * all three modes published identically: as whoever owns the application
 * password, which is the `Engine` integration account. A masthead title and a
 * named-editor title came out with the same byline, and it was the wrong one.
 *
 * It fails SOFT and returns null: an unresolvable author must not stop a
 * publish, it must only fall back to attributing to the authenticating account.
 * A title that cannot publish is a worse outcome than one whose byline needs
 * fixing in wp-admin.
 *
 * `who=authors` is load-bearing and was learned the hard way. The Engine is an
 * editor, not an administrator, so it lacks `list_users` — and for a role
 * without it, /wp/v2/users is silently narrowed to users who have already
 * PUBLISHED something. A freshly created byline account has published nothing,
 * so `?search=James Burke` returned an empty array while the user plainly
 * existed. `?who=authors` asks for users with authoring capability instead, and
 * returns them regardless of post count. The search fallback stays for hosts
 * that reject `who`.
 */
export async function resolveAuthor(wp, { name, email } = {}) {
  const needle = String(name || email || "").trim();
  if (!needle) return null;
  const norm = (s) => String(s || "").trim().toLowerCase();
  const headers = { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" };

  for (const query of [`who=authors&per_page=100`, `search=${encodeURIComponent(needle)}&per_page=20`]) {
    try {
      const res = await fetch(`${wpBase(wp)}/users?${query}`, { headers });
      if (!res.ok) continue;
      const users = await res.json();
      if (!Array.isArray(users) || !users.length) continue;
      const hit = users.find((u) => norm(u.name) === norm(needle) || norm(u.slug) === norm(needle));
      if (hit?.id) return hit.id;
    } catch {
      // try the next strategy
    }
  }
  return null;
}

/**
 * The author id for a site, honouring its byline mode.
 *
 * masthead          — "The <Title> Team", a real WP user with no personal name
 * per_title_person  — this title's own named editor
 * shared_person     — one named editor across the fleet
 *
 * The last two resolve the same way; they differ in who is named on the Site
 * row, not in how publishing works.
 */
export async function authorForSite(wp, site) {
  if (!site) return null;
  if (site.bylineMode === "masthead") {
    return resolveAuthor(wp, { name: `The ${site.name} Team` });
  }
  return resolveAuthor(wp, { name: site.authorName, email: site.authorEmail });
}

export async function publishToWordPress(wp, {
  title,
  body,
  status = "draft",
  featuredMediaId,
  categoryId,
  keyphrase,
  metaDesc,
  authorId,
}) {
  if (!isWordPressConfigured(wp)) throw new Error("WordPress is not configured");
  const res = await fetch(`${wpBase(wp)}/posts`, {
    method: "POST",
    headers: {
      authorization: `Basic ${wpAuth(wp)}`,
      "content-type": "application/json",
      "user-agent": "CogentBot/1.0",
    },
    body: JSON.stringify({
      title,
      content: body,
      status,
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      ...(categoryId ? { categories: [categoryId] } : {}),
      ...(authorId ? { author: authorId } : {}),
      ...(metaDesc ? { excerpt: metaDesc } : {}),
      ...(keyphrase || metaDesc
        ? {
            meta: {
              ...(keyphrase ? { _yoast_wpseo_focuskw: keyphrase } : {}),
              ...(metaDesc ? { _yoast_wpseo_metadesc: metaDesc } : {}),
            },
          }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`WordPress ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const post = await res.json();
  return { id: post.id, link: post.link };
}

// Fetch published posts (for the SEO agent's audits).
/*
 * SiteGround challenges this one, so it retries.
 *
 * The host runs bot protection that answers with HTTP 202 and an HTML redirect
 * to /.well-known/sgcaptcha/ instead of the JSON. It only ever hits this call:
 * forty posts WITH full content is about half a megabyte in one request, where
 * publishing makes two small ones and is never touched. It blocked the SEO
 * sweep on 11 August while every article that day published normally.
 *
 * The challenge is transient and per-IP, so the fix is to wait and ask again
 * rather than to redesign the fetch. Three attempts with a widening gap; if it
 * is still challenging after that, say so in words rather than returning a
 * screenful of HTML as the agent's status.
 */
function isBotChallenge(status, contentType, body) {
  return (
    (status === 202 || status === 403 || status === 429) &&
    !contentType.includes("json") &&
    /sgcaptcha|captcha|challenge/i.test(body)
  );
}

// One 40-full-content-post request is the most bot-shaped call this app makes,
// and on 25 August SiteGround challenged it on two titles in the same cron
// minute - both SEO sweeps blocked while every smaller call sailed through.
// Paged fetches with a polite gap look like a reader, not a scraper, and a
// challenge on page 3 still leaves pages 1-2 usable rather than losing all 40.
const PAGE_SIZE = 10;
const PAGE_GAP_MS = 1500;

export async function fetchPosts(wp, limit = 20) {
  if (limit > PAGE_SIZE) {
    const all = [];
    for (let page = 1; all.length < limit && page <= Math.ceil(limit / PAGE_SIZE); page++) {
      if (page > 1) await new Promise((r) => setTimeout(r, PAGE_GAP_MS));
      try {
        const batch = await fetchPostsPage(wp, PAGE_SIZE, page);
        if (!batch.length) break;
        all.push(...batch);
      } catch (e) {
        // Partial beats nothing: a sweep over 20 posts is a smaller sweep, not
        // a failed one. Only an empty first page is a real failure.
        if (!all.length) throw e;
        break;
      }
    }
    return all.slice(0, limit);
  }
  return fetchPostsPage(wp, limit, 1);
}

async function fetchPostsPage(wp, perPage, page) {
  let lastPreview = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `${wpBase(wp)}/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=id,link,title,content,excerpt,date`,
      { headers: { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" } }
    );
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("json")) return res.json();

    const body = await res.text();
    lastPreview = body.slice(0, 120).replace(/\s+/g, " ");

    if (isBotChallenge(res.status, contentType, body)) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
        continue;
      }
      throw new Error(
        `SiteGround bot protection challenged the WordPress API (${res.status}) on all 3 attempts. Not a code fault: the host is rate-limiting this request, which asks for ${perPage} posts with full content. Publishing is unaffected because it makes far smaller calls.`
      );
    }
    throw new Error(`WP posts fetch failed (${res.status}, ${contentType}): ${lastPreview}`);
  }
  throw new Error(`WP posts fetch failed after 3 attempts: ${lastPreview}`);
}

// One post by id, for when we already know which one we want — the outreach
// engine needs the live permalink for an article it published itself.
export async function fetchPost(wp, wpPostId) {
  const res = await fetch(
    `${wpBase(wp)}/posts/${wpPostId}?_fields=id,link,title,content,excerpt,date`,
    { headers: { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" } }
  );
  if (!res.ok) throw new Error(`WP post ${wpPostId} fetch failed (${res.status})`);
  return res.json();
}

// Update a post's title and/or content (for approved SEO suggestions).
export async function updatePost(wp, wpPostId, data) {
  const res = await fetch(`${wpBase(wp)}/posts/${wpPostId}`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth(wp)}`, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`WP update ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
