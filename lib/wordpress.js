// WordPress publishing arm — activates when WP_URL / WP_USERNAME /
// WP_APP_PASSWORD are set (application password from the WP admin).
export function isWordPressConfigured() {
  return Boolean(process.env.WP_URL && process.env.WP_USERNAME && process.env.WP_APP_PASSWORD);
}

function wpAuth() {
  return Buffer.from(
    `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`
  ).toString("base64");
}

function wpBase() {
  return `${process.env.WP_URL.replace(/\/$/, "")}/wp-json/wp/v2`;
}

// Sideload an external image into the WP media library with SEO alt text.
export async function uploadMedia({ imageUrl, alt, filename }) {
  const imgRes = await fetch(imageUrl, {
    headers: { "user-agent": "SmartSMEBot/1.0" },
  });
  if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const res = await fetch(`${wpBase()}/media`, {
    method: "POST",
    headers: {
      authorization: `Basic ${wpAuth()}`,
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}.${ext}"`,
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`WP media ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const media = await res.json();

  if (alt) {
    await fetch(`${wpBase()}/media/${media.id}`, {
      method: "POST",
      headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json" },
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
export async function categoryCounts() {
  if (!isWordPressConfigured()) return {};
  try {
    const res = await fetch(`${wpBase()}/categories?per_page=100&_fields=name,count,slug`, {
      headers: { authorization: `Basic ${wpAuth()}`, "user-agent": "SmartSMEBot/1.0" },
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
export async function resolveCategory(name) {
  if (!name) return null;
  const res = await fetch(
    `${wpBase()}/categories?per_page=100&_fields=id,name`,
    { headers: { authorization: `Basic ${wpAuth()}`, "user-agent": "SmartSMEBot/1.0" } }
  );
  if (res.ok) {
    const cats = await res.json();
    const clean = (s) => s.replace(/&amp;/g, "&").trim().toLowerCase();
    const hit = cats.find((c) => clean(c.name) === clean(name));
    if (hit) return hit.id;
  }
  const create = await fetch(`${wpBase()}/categories`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json", "user-agent": "SmartSMEBot/1.0" },
    body: JSON.stringify({ name }),
  });
  if (!create.ok) return null;
  return (await create.json()).id;
}

export async function publishToWordPress({
  title,
  body,
  status = "draft",
  featuredMediaId,
  categoryId,
  keyphrase,
  metaDesc,
}) {
  if (!isWordPressConfigured()) throw new Error("WordPress is not configured");
  const res = await fetch(`${wpBase()}/posts`, {
    method: "POST",
    headers: {
      authorization: `Basic ${wpAuth()}`,
      "content-type": "application/json",
      "user-agent": "SmartSMEBot/1.0",
    },
    body: JSON.stringify({
      title,
      content: body,
      status,
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      ...(categoryId ? { categories: [categoryId] } : {}),
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

export async function fetchPosts(limit = 20) {
  let lastPreview = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `${wpBase()}/posts?per_page=${limit}&orderby=date&order=desc&_fields=id,link,title,content,excerpt,date`,
      { headers: { authorization: `Basic ${wpAuth()}`, "user-agent": "SmartSMEBot/1.0" } }
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
export async function fetchPost(wpPostId) {
  const res = await fetch(
    `${wpBase()}/posts/${wpPostId}?_fields=id,link,title,content,excerpt,date`,
    { headers: { authorization: `Basic ${wpAuth()}`, "user-agent": "SmartSMEBot/1.0" } }
  );
  if (!res.ok) throw new Error(`WP post ${wpPostId} fetch failed (${res.status})`);
  return res.json();
}

// Update a post's title and/or content (for approved SEO suggestions).
export async function updatePost(wpPostId, data) {
  const res = await fetch(`${wpBase()}/posts/${wpPostId}`, {
    method: "POST",
    headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`WP update ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
