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
const BACKUP_DIR = path.join(process.env.USERPROFILE || process.env.HOME, ".claude", "backups", "seo-revert-2026-09-29");

// Every rule a reverted post has to pass before it is written. Removing the
// injected clauses should only ever take words OUT of body paragraphs, so
// anything else changing means the unwind went somewhere it should not have.
const FRAGMENTS = process.argv.includes("--fragments");

// The inserted middle of a replacement: what is left of it once the longest
// run it shares with the original text at each end is taken off.
function fragmentCut(content, rws, finds) {
  for (let k = 0; k < rws.length; k++) {
    const rw = rws[k], f = finds[k];
    if (!rw || !f) continue;
    let p = 0;
    while (p < f.length && p < rw.length && f[p] === rw[p]) p++;
    let s = 0;
    while (s < f.length - p && s < rw.length - p && f[f.length - 1 - s] === rw[rw.length - 1 - s]) s++;
    const mid = rw.slice(p, rw.length - s);
    if (mid.length < 20 || !/<a\s[^>]*>[\s\S]*<\/a>/i.test(mid)) continue;
    if ((mid.match(/<a\b/gi) || []).length !== (mid.match(/<\/a>/gi) || []).length) continue;
    if (/<\/?(p|h\d|blockquote|li|ul|ol)\b/i.test(mid)) continue;
    // Matched on a normalised spelling (entities, curly quotes, link
    // attributes, whitespace all folded to one form), then mapped back to the
    // exact characters stored, so what is cut is precisely the stored copy of
    // the inserted words and nothing either side of them.
    const C = normMap(content), M = normMap(mid).n.trim();
    const hit = C.n.indexOf(M);
    if (hit < 0 || C.n.indexOf(M, hit + 1) >= 0) continue;
    const at = C.start[hit], end = C.end[hit + M.length - 1];
    const out = content.slice(0, at) + content.slice(end);
    const seam = visibleText(out.slice(Math.max(0, at - 40), at + 40));
    if (/,\s*,|\s[,.;:]|\s{2,}|\.\s*\./.test(seam)) continue;
    return out;
  }
  return null;
}
const visibleText = (h) => h.replace(/<[^>]+>/g, "");

// A folded spelling of some HTML, with each folded character's span in the
// original, so a match in the folded text maps back to exact stored bytes.
const CHAR = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " " };
const ENT = { "&#8217;": "'", "&#8216;": "'", "&#8220;": '"', "&#8221;": '"', "&#8211;": "-", "&#8212;": "-", "&amp;": "&", "&#038;": "&", "&nbsp;": " ", "&quot;": '"', "&#039;": "'" };
function normMap(s) {
  const n = [], start = [], end = [];
  const push = (str, a, b) => { for (const ch of str) { n.push(ch); start.push(a); end.push(b); } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "<") {
      const j = s.indexOf(">", i);
      if (j < 0) { push(c, i, i + 1); i++; continue; }
      const tag = s.slice(i, j + 1);
      const href = tag.match(/^<a\b[^>]*\bhref="([^"]*)"/i);
      const canon = href ? `<a href="${href[1].replace(/\/$/, "")}">` : tag.toLowerCase().replace(/\s+/g, " ");
      push(canon, i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "&") {
      const m = s.slice(i).match(/^&(#\d+|#x[0-9a-f]+|[a-z]+);/i);
      if (m) {
        const e = m[0];
        const v = ENT[e] ?? (/^&#\d+;$/.test(e) ? String.fromCharCode(+e.slice(2, -1)) : e);
        push(CHAR[v] ?? v, i, i + e.length);
        i += e.length;
        continue;
      }
    }
    if (/\s/.test(c) || c === " ") {
      let j = i;
      while (j < s.length && (/\s/.test(s[j]) || s[j] === " ")) j++;
      push(" ", i, j);
      i = j;
      continue;
    }
    push(CHAR[c] ?? c, i, i + 1);
    i++;
  }
  return { n: n.join(""), start, end };
}

const words = (h) => h.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const all = (h, re) => [...h.matchAll(re)].map((m) => m[0]);
const BALANCED = ["a", "p", "strong", "em", "b", "i", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "figure", "table", "tr", "td"];
const HEADING = /<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi;
function unsafe(before, after, { headings = true } = {}) {
  if (after.length >= before.length) return "did not get shorter";
  // Quotes are somebody's words and headings are structure: neither may move.
  if (all(before, /<blockquote\b[\s\S]*?<\/blockquote>/gi).join("|") !== all(after, /<blockquote\b[\s\S]*?<\/blockquote>/gi).join("|")) return "a quote changed";
  if (headings && all(before, HEADING).join("|") !== all(after, HEADING).join("|")) return "a heading changed";
  if (all(before, HEADING).length !== all(after, HEADING).length) return "a heading was added or lost";
  if (all(before, /<img\b[^>]*>/gi).length !== all(after, /<img\b[^>]*>/gi).length) return "an image changed";
  for (const tag of BALANCED) {
    const bal = (h) => (h.match(new RegExp(`<${tag}\\b`, "gi")) || []).length - (h.match(new RegExp(`</${tag}>`, "gi")) || []).length;
    if (bal(after) !== bal(before)) return `unbalanced <${tag}>`;
  }
  if ((after.match(/<p\b/gi) || []).length !== (before.match(/<p\b/gi) || []).length) return "paragraph count changed";
  const wb = words(before), wa = words(after);
  if (wa < wb * 0.6) return `would remove ${wb - wa} of ${wb} words`;
  return null;
}

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
    if (i < 0) {
      // Second chance, --fragments only: the sentence around the insertion has
      // changed since, so the whole replacement is no longer there, but the
      // inserted part itself (the words the sweep added, carrying its link)
      // may still be. Removed only when it appears exactly once, holds a whole
      // link, and taking it out leaves no stray punctuation behind.
      const cut = FRAGMENTS ? fragmentCut(w.content, rws, fs_) : null;
      if (cut && !unsafe(w.content, cut, { headings: false })) {
        if (all(w.content, HEADING).join("|") !== all(cut, HEADING).join("|")) w.headingFixed = true;
        w.content = cut; w.ids.push(s.id); t.fragments = (t.fragments || 0) + 1; continue; }
      t.notFound++;
      if (t.notFoundIds.length < 5) t.notFoundIds.push(s.wpPostId);
      continue;
    }
    const next = w.content.replace(rws[i], () => fs_[i] ?? unescapeModelText(p.find));
    // Each step is checked on its own, so one bad edit costs only itself and
    // not every other revert in the same post. A heading may change here, and
    // only here: this step is exactly the inserted clause coming back out of
    // it. Three Barbering posts on 29 Sep had an edit whose "original" was a
    // link an earlier edit had cut in half; reverting that one would put the
    // broken link back, so it is the one skipped.
    const why = unsafe(w.content, next, { headings: false });
    if (why) { t.stepSkipped = (t.stepSkipped || 0) + 1; continue; }
    if (all(w.content, HEADING).join("|") !== all(next, HEADING).join("|")) w.headingFixed = true;
    w.content = next;
    w.ids.push(s.id);
  }

  t.unsafe = 0;
  t.unsafeReasons = [];
  t.writeMismatch = 0;
  for (const [postId, w] of posts) {
    if (!w.ids.length || w.content === w.original) continue;
    const problem = unsafe(w.original, w.content, { headings: !w.headingFixed });
    if (problem) {
      t.unsafe++;
      if (t.unsafeReasons.length < 6) t.unsafeReasons.push(`${postId}: ${problem}`);
      continue;
    }
    if (DRY) {
      const dir = path.join(BACKUP_DIR, "preview", slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${postId}.before.html`), w.original);
      fs.writeFileSync(path.join(dir, `${postId}.after.html`), w.content);
    }
    if (!DRY) {
      // A copy of every post as it was, before anything is written. WordPress
      // revisions are on as well; this is the one that does not depend on it.
      fs.mkdirSync(path.join(BACKUP_DIR, slug), { recursive: true });
      // Never overwrite an earlier pass's copy: the first one is the post as it
      // stood before any of this.
      const first = path.join(BACKUP_DIR, slug, `${postId}.html`);
      fs.writeFileSync(fs.existsSync(first) ? path.join(BACKUP_DIR, slug, `${postId}.pass2.html`) : first, w.original);
      try {
        await updatePost(wp, postId, { content: w.content });
      } catch (e) {
        if (e.retryable) { t.blocked = e.message.slice(0, 140); break; }
        continue;
      }
      // Read it back: kses or a plugin rewriting the content on save would
      // otherwise go unnoticed.
      const back = await fetchPost(wp, postId, { edit: true }).catch(() => null);
      if (back?.content?.raw !== w.content) t.writeMismatch++;
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
