// Take out the words the SEO sweep wrote into live articles.
//
//   node --import ./scripts/_register.mjs scripts/seo-revert-injected.mjs --dry [--site=<slug>] [--since=2026-09-29T00:00Z]
//   node --import ./scripts/_register.mjs scripts/seo-revert-injected.mjs [--site=<slug>] [--since=...]
//
// Measured 29 September 2026: about 2,600 of the ~2,900 auto-applied
// "internal links" added a model-written clause or sentence to carry the link,
// 39,000 words across 538 published articles on nine titles. lib/seo-agent.js
// now refuses any internal link that changes the visible text (linkOnly), so
// this only has to deal with what is already live.
//
// For each applied suggestion whose replacement added words, newest first (so
// an edit made on top of an earlier edit comes off before the one underneath),
// the replacement is found in the stored post and swapped back for the original
// text. The link goes with it: it was hung on words nobody wrote. Anything the
// script cannot find verbatim, because the copy has been edited since, is left
// alone and listed rather than guessed at. The suggestion is marked dismissed
// with "reverted" in its error so a rerun skips it.
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry");
const ONLY = process.argv.find((a) => a.startsWith("--site="))?.slice(7);
const SINCE = process.argv.find((a) => a.startsWith("--since="))?.slice(8);
const WRITE_GAP_MS = 1300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { prisma, forSite } = await import("../lib/prisma.js");
const { getSiteContext } = await import("../lib/site.js");
const { linkOnly, spellings, unescapeModelText } = await import("../lib/seo-agent.js");
const { fetchPost, updatePost, isWordPressConfigured } = await import("../lib/wordpress.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] }, ...(ONLY ? { slug: ONLY } : {}) },
  select: { slug: true },
});

async function work(slug) {
  const { site, creds } = await getSiteContext(slug);
  const wp = creds?.wordpress;
  if (!isWordPressConfigured(wp)) return { slug, skipped: "no WordPress credential" };
  const db = forSite(site.id);
  const applied = await db.seoSuggestion.findMany({
    where: {
      status: "applied",
      kind: "internal_link",
      wpPostId: { not: null },
      ...(SINCE ? { appliedAt: { gte: new Date(SINCE) } } : {}),
    },
    orderBy: { appliedAt: "desc" },
  });
  const injected = applied.filter((s) => {
    const p = JSON.parse(s.payload || "{}");
    return p.find && p.replaceWith && !linkOnly(p.find, p.replaceWith);
  });

  const t = { injected: injected.length, reverted: 0, notFound: 0, blocked: null, notFoundIds: [] };
  const posts = new Map(); // post id -> working copy, so stacked edits unwind in memory
  for (const s of injected) {
    const p = JSON.parse(s.payload);
    if (!posts.has(s.wpPostId)) {
      const post = await fetchPost(wp, s.wpPostId, { edit: true }).catch(() => null);
      posts.set(s.wpPostId, { original: post?.content?.raw ?? null, content: post?.content?.raw ?? null, ids: [] });
      await sleep(300);
    }
    const w = posts.get(s.wpPostId);
    if (w.content == null) { t.notFound++; continue; }
    const rws = spellings(p.replaceWith);
    const fs_ = spellings(p.find);
    const i = rws.findIndex((v) => v && w.content.includes(v));
    if (i < 0) { t.notFound++; if (t.notFoundIds.length < 5) t.notFoundIds.push(s.wpPostId); continue; }
    w.content = w.content.replace(rws[i], () => fs_[i] ?? unescapeModelText(p.find));
    w.ids.push(s.id);
  }

  for (const [postId, w] of posts) {
    if (!w.ids.length || w.content === w.original) continue;
    if (!DRY) {
      try {
        await updatePost(wp, postId, { content: w.content });
      } catch (e) {
        if (e.retryable) { t.blocked = e.message.slice(0, 140); break; }
        continue;
      }
      await db.seoSuggestion.updateMany({
        where: { id: { in: w.ids } },
        data: { status: "dismissed", error: "reverted 29 Sep 2026: added words as well as a link" },
      });
      await sleep(WRITE_GAP_MS);
    }
    t.reverted += w.ids.length;
  }
  return { slug, ...t, posts: [...posts.values()].filter((w) => w.ids.length).length };
}

const results = await Promise.all(sites.map(({ slug }) => work(slug).catch((e) => ({ slug, error: e.message }))));
console.log(DRY ? "DRY RUN, nothing written\n" : "");
for (const r of results) console.log(JSON.stringify(r));
await prisma.$disconnect();
