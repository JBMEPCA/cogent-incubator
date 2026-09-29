// Put clean internal links back into the posts the injected-copy revert touched.
//
//   node --import ./scripts/_register.mjs scripts/seo-relink.mjs --dry [--site=<slug>]
//   node --import ./scripts/_register.mjs scripts/seo-relink.mjs [--site=<slug>]
//
// seo-revert-injected.mjs took out the clauses the SEO sweep had written to carry
// its links, and the links went with them. Internal linking still matters to a
// title with no domain authority, so this puts links back the way they should
// have gone in the first time: on words already in the article, never new ones.
//
// The model only CHOOSES: an existing phrase and a destination from the list.
// Everything else is code. Each proposal must be found verbatim, sit outside a
// quote, a heading and an existing link, and the finished post must read
// exactly as it did (same visible text, character for character) with only
// <a> tags added. A post failing any of that is not written.
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
const TARGET = 3; // internal links a post should end up with, at least
const MAX_NEW = 3; // never more than this many added to one post
const WRITE_GAP_MS = 1300;
const MODEL = "claude-sonnet-5";
const ROOT = path.join(process.env.USERPROFILE || process.env.HOME, ".claude", "backups", "seo-revert-2026-09-29");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Anthropic = (await import("@anthropic-ai/sdk")).default;
const { prisma } = await import("../lib/prisma.js");
const { getSiteContext } = await import("../lib/site.js");
const { titleBrief } = await import("../lib/voice.js");
const { linkify, locate, insideBlockquote, hrefsIn } = await import("../lib/seo-agent.js");
const { fetchPost, updatePost, isWordPressConfigured } = await import("../lib/wordpress.js");
const client = new Anthropic();

const visible = (h) => h.replace(/<[^>]+>/g, "");
const plain = (h) =>
  h
    .replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–").replace(/&amp;|&#038;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["links"],
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["anchor", "destination_id"],
        properties: { anchor: { type: "string" }, destination_id: { type: "integer" } },
      },
    },
  },
};

const system = (site) => `${titleBrief(site)}

You add internal links to a published article. You may ONLY choose an anchor that already appears word for word in the article text you are given, and a destination from the list. You never write, add or change any words.

A good link:
- The anchor is 2 to 8 consecutive words copied exactly from the article (same spelling, same punctuation, same capitals).
- The anchor names the destination's subject, so a reader knows where it goes before clicking. A phrase that merely shares a word or sits near a related idea is not good enough.
- The destination is genuinely useful to a reader at that point in the article.
- Never link a company or person's name to an article about someone else.
- Different anchors for different destinations; each destination at most once.

Return the best links first, at most the number asked for. If nothing fits well, return fewer or none: a weak link is worse than no link.`;

async function allPosts(host) {
  const out = [];
  for (let page = 1; page < 40; page++) {
    const r = await fetch(`https://${host}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,link,title`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) break;
    const list = await r.json().catch(() => []);
    if (!list.length) break;
    out.push(...list);
    await sleep(800);
  }
  return out;
}

async function work(slug) {
  const dir = path.join(ROOT, slug);
  if (!fs.existsSync(dir)) return { slug, skipped: "no reverted posts" };
  const targets = fs.readdirSync(dir).filter((f) => /^\d+\.html$/.test(f)).map((f) => Number(f.split(".")[0]));
  const { site, creds } = await getSiteContext(slug);
  const wp = creds?.wordpress;
  if (!isWordPressConfigured(wp)) return { slug, skipped: "no WordPress credential" };
  const host = new URL(wp.url).hostname.replace(/^www\./, "");
  const posts = await allPosts(host);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const norm = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();

  const t = { posts: targets.length, linksAdded: 0, postsWritten: 0, alreadyEnough: 0, noGoodLink: 0, refused: 0, samples: [] };
  const outDir = path.join(ROOT, "relink", slug);

  for (const id of targets) {
    const post = await fetchPost(wp, id, { edit: true }).catch(() => null);
    const raw = post?.content?.raw;
    if (!raw) continue;
    const linked = new Set(hrefsIn(raw).map(norm));
    const internal = [...linked].filter((u) => u.startsWith(host)).length;
    if (internal >= TARGET) { t.alreadyEnough++; continue; }
    const want = Math.min(MAX_NEW, TARGET - internal);

    const dests = posts.filter((p) => p.id !== id && !linked.has(norm(p.link)));
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system: system(site),
      messages: [{
        role: "user",
        content:
          `Add up to ${want} internal link(s).\n\nARTICLE: ${post.title?.raw ?? ""}\n${plain(raw).slice(0, 7000)}\n\n` +
          `DESTINATIONS (id | title):\n${dests.map((d) => `${d.id} | ${visible(d.title?.rendered || "").replace(/&#8217;/g, "’").replace(/&amp;/g, "&")}`).join("\n")}`,
      }],
    }).catch((e) => ({ error: e }));
    try { (await import("../lib/agents/meter.js")).recordUsage(res.model || MODEL, res.usage); } catch {}
    let links = [];
    try {
      links = JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join("")).links || [];
    } catch {}

    let html = raw;
    const added = [];
    const usedDest = new Set();
    for (const l of links) {
      if (added.length >= want) break;
      const dest = byId.get(l.destination_id);
      if (!dest || dest.id === id || usedDest.has(dest.id) || linked.has(norm(dest.link))) continue;
      const n = String(l.anchor || "").trim().split(/\s+/).length;
      if (n < 2 || n > 8) continue;
      const anchor = locate(html, l.anchor);
      if (!anchor) continue;
      const r = linkify(html, anchor, dest.link);
      if (!r.ok) continue;
      let at = 0;
      while (at < html.length && html[at] === r.html[at]) at++;
      if (insideBlockquote(html, at)) continue;
      html = r.html;
      usedDest.add(dest.id);
      added.push(`"${visible(anchor)}" -> ${visible(dest.title?.rendered || "")}`);
    }
    if (!added.length) { t.noGoodLink++; continue; }

    // The guarantee: same words, only links added.
    const aBal = (h) => (h.match(/<a\b/gi) || []).length - (h.match(/<\/a>/gi) || []).length;
    if (visible(html) !== visible(raw) || aBal(html) !== aBal(raw)) { t.refused++; continue; }

    if (t.samples.length < 4) t.samples.push(`${id}: ${added.join(" | ")}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${id}.${DRY ? "preview" : "before"}.html`), raw);
    if (!DRY) {
      try {
        await updatePost(wp, id, { content: html });
      } catch (e) {
        if (e.retryable) { t.blocked = e.message.slice(0, 140); break; }
        continue;
      }
      await sleep(WRITE_GAP_MS);
    }
    t.postsWritten++;
    t.linksAdded += added.length;
  }
  return { slug, ...t };
}

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] }, ...(ONLY ? { slug: ONLY } : {}) },
  select: { slug: true },
});
const results = await Promise.all(sites.map(({ slug }) => work(slug).catch((e) => ({ slug, error: e.message }))));
console.log(DRY ? "DRY RUN, nothing written\n" : "");
for (const r of results) console.log(JSON.stringify(r, null, 1));
await prisma.$disconnect();
