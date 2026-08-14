// Add authoritative outbound citations to articles that have none, without
// rewriting the copy.
//
// The model proposes {anchor, url} pairs against text that already exists in the
// article. Every proposed URL is fetched and must return 200 before it is used,
// because models reliably invent plausible-looking gov.uk and ICO URLs. Anchors
// are only linked where they appear outside an existing <a> tag.
//
//   node scripts/add-sources.js            # every post with no outbound link
//   node scripts/add-sources.js 30 31      # specific post IDs
const { log, ask, livePosts, wpBase, wpHeaders, clean } = require("./publish-lib");

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function resolves(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": BROWSER }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

// Replace the first occurrence of `anchor` that sits outside an existing link.
function linkify(html, anchor, url) {
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
  for (let i = 0; i < parts.length; i++) {
    if (/^<a\b/i.test(parts[i])) continue; // never nest a link
    const at = parts[i].indexOf(anchor);
    if (at < 0) continue;
    // Do not link inside a heading or a tag attribute.
    const before = parts[i].slice(0, at);
    if (/<h[1-6][^>]*>[^<]*$/i.test(before)) continue;
    if (before.lastIndexOf("<") > before.lastIndexOf(">")) continue;
    parts[i] = parts[i].slice(0, at) + `<a href="${url}">${anchor}</a>` + parts[i].slice(at + anchor.length);
    return { html: parts.join(""), ok: true };
  }
  return { html, ok: false };
}

async function sourceOne(post) {
  const title = clean(post.title.rendered);
  const html = post.content.rendered;
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  log(`[${post.id}] proposing sources for "${title.slice(0, 50)}"`);

  const raw = await ask({
    maxTokens: 2000,
    system: `You add authoritative outbound citations to a UK small-business article that currently has none.

Pick 3 to 5 claims that genuinely benefit from a primary source, and for each give:
- "anchor": a SHORT phrase (3 to 8 words) copied EXACTLY, character for character, from the article text supplied. It must be a phrase a reader would naturally click. Do not invent or paraphrase it.
- "url": the canonical URL of an authoritative primary source that supports the claim.

Rules:
- Prefer gov.uk, hmrc, ico.org.uk, ncsc.gov.uk, companieshouse, the ASA, or the vendor's own official page.
- Use only URLs you are confident exist and are stable. Prefer a short canonical path over a deep one: a top-level guidance page that certainly exists beats a specific deep link that might not.
- Never cite a competing publication, a blog, or an aggregator.
- Do not pick an anchor that appears inside a heading.

Reply ONLY with JSON: [{"anchor":"...","url":"...","why":"..."}]`,
    user: `Article: "${title}"\n\nArticle text:\n${plain.slice(0, 14000)}`,
  });

  let proposals = [];
  try {
    proposals = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "").trim());
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) try { proposals = JSON.parse(m[0]); } catch {}
  }
  if (!Array.isArray(proposals) || !proposals.length) {
    log(`[${post.id}] no usable proposals`);
    return { id: post.id, added: 0 };
  }

  let updated = html;
  let added = 0;
  const rejected = [];
  for (const p of proposals) {
    if (!p?.anchor || !p?.url) continue;
    if (!(await resolves(p.url))) {
      rejected.push(`${p.url} (does not resolve)`);
      continue;
    }
    const r = linkify(updated, p.anchor, p.url);
    if (!r.ok) {
      rejected.push(`"${p.anchor}" (phrase not found in body)`);
      continue;
    }
    updated = r.html;
    added++;
    log(`[${post.id}]   + ${p.anchor}  ->  ${p.url}`);
  }
  rejected.forEach((r) => log(`[${post.id}]   rejected: ${r}`));

  if (!added) return { id: post.id, added: 0, rejected };

  const res = await fetch(`${wpBase()}/posts/${post.id}`, {
    method: "POST",
    headers: { ...wpHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ content: updated }),
  });
  if (!res.ok) throw new Error(`WP update ${res.status}: ${(await res.text()).slice(0, 200)}`);
  log(`[${post.id}] UPDATED with ${added} source(s)`);
  return { id: post.id, added, rejected, link: post.link };
}

(async () => {
  const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  const posts = await livePosts();

  const targets = posts.filter((p) => {
    if (only.length) return only.includes(p.id);
    const hrefs = [...new Set([...p.content.rendered.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
    return !hrefs.some((h) => /^https?:\/\//i.test(h) && !/smartsme\.co\.uk/i.test(h));
  });

  log(`${targets.length} post(s) with no outbound citation: ${targets.map((t) => "#" + t.id).join(", ")}`);

  const results = [];
  for (let i = 0; i < targets.length; i += 3) {
    const batch = targets.slice(i, i + 3);
    const settled = await Promise.allSettled(batch.map(sourceOne));
    settled.forEach((r, n) =>
      results.push(r.status === "fulfilled" ? r.value : { id: batch[n].id, added: 0, error: r.reason?.message })
    );
  }

  log("\n=== SUMMARY ===");
  results.forEach((r) => log(`#${String(r.id).padEnd(4)} +${r.added} source(s) ${r.error ? "ERROR " + r.error : ""}`));
  log(`total sources added: ${results.reduce((s, r) => s + r.added, 0)}`);
  const { prisma } = require("./publish-lib");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("FATAL", e);
  process.exit(1);
});
