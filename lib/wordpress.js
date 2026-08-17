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

// Sideload an external image into the WP media library with SEO alt text.
export async function uploadMedia(wp, { imageUrl, alt, filename }) {
  const imgRes = await fetch(imageUrl, {
    headers: { "user-agent": "CogentBot/1.0" },
  });
  if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(await imgRes.arrayBuffer());

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

  if (alt) {
    await fetch(`${wpBase(wp)}/media/${media.id}`, {
      method: "POST",
      headers: { authorization: `Basic ${wpAuth(wp)}`, "content-type": "application/json" },
      body: JSON.stringify({ alt_text: alt }),
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
 * Resolution is by search over /wp/v2/users, which an editor may call. It fails
 * SOFT and returns null: an unresolvable author must not stop a publish, it
 * must only fall back to the old behaviour of attributing to the authenticating
 * account. A title that cannot publish is a worse outcome than one whose byline
 * needs fixing in wp-admin.
 */
export async function resolveAuthor(wp, { name, email } = {}) {
  const needle = String(name || email || "").trim();
  if (!needle) return null;
  try {
    const res = await fetch(
      `${wpBase(wp)}/users?search=${encodeURIComponent(needle)}&per_page=20`,
      { headers: { authorization: `Basic ${wpAuth(wp)}`, "user-agent": "CogentBot/1.0" } }
    );
    if (!res.ok) return null;
    const users = await res.json();
    if (!Array.isArray(users) || !users.length) return null;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const exact = users.find((u) => norm(u.name) === norm(name) || norm(u.slug) === norm(name));
    return (exact || users[0]).id ?? null;
  } catch {
    return null;
  }
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

export async function fetchPosts(wp, limit = 20) {
  let lastPreview = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `${wpBase(wp)}/posts?per_page=${limit}&orderby=date&order=desc&_fields=id,link,title,content,excerpt,date`,
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
        `SiteGround bot protection challenged the WordPress API (${res.status}) on all 3 attempts. Not a code fault: the host is rate-limiting this request, which asks for ${limit} posts with full content. Publishing is unaffected because it makes far smaller calls.`
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
