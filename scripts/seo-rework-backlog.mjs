// Re-run the SEO queue's failed pile through the fixed matcher, and clear the
// advice that was never advice.
//
//   node --import ./scripts/_register.mjs scripts/seo-rework-backlog.mjs --dry
//   node --import ./scripts/_register.mjs scripts/seo-rework-backlog.mjs
//
// On 29 September the dashboard showed ~520 open items across nine titles, 475
// of them failed. Sampling them against the live posts found three causes, none
// of them "the copy changed":
//
//   ALREADY LINKED  about two thirds. The audit re-proposed links an earlier
//                   sweep had already written, under a different sentence, and
//                   the exact-text check refused them as missing. They are done.
//   ENCODING        the model copied "’" as six literal characters out of
//                   the JSON digest, or wrote ’ where the post stores &#8217;.
//   GONE            the sentence really has been rewritten since.
//
// lib/seo-agent.js now resolves the first two (locate, alreadyLinked) and
// refuses both at filing time, so this is the one-off pass over what had
// already piled up. Nothing here trusts a suggestion: applySuggestion re-reads
// the stored post, still refuses quotes, and still refuses anything it cannot
// find character for character once encoding is allowed for.
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
const WRITE_GAP_MS = 1300; // same gap as the cron: reads as editing, not scraping
const KINDS = ["internal_link", "brand_link", "content_edit"];

// Addressed to the next sweep, not to a person. Same pattern the audit now
// refuses at filing.
const SWEEP_NOISE =
  /next sweep|queued for next|to close in next|carr(y|ies) (over )?to next|remaining must ?fix|must ?fix (link )?gaps?|still (need|owed|owe|outstanding|open)|second (internal )?link/i;
const SPAN_STRIP = /strip .*span|raw html span|decorative span/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { prisma, forSite } = await import("../lib/prisma.js");
const { getSiteContext } = await import("../lib/site.js");
const { applySuggestion, outcomeFor, locate, alreadyLinked, insideBlockquote, unescapeModelText } = await import(
  "../lib/seo-agent.js"
);
const { fetchPost, isWordPressConfigured } = await import("../lib/wordpress.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] }, ...(ONLY ? { slug: ONLY } : {}) },
  select: { slug: true },
  orderBy: { createdAt: "asc" },
});

// Dry run: the same decision applySuggestion would make, from one read per post.
async function predict(wp, s, cache) {
  const payload = JSON.parse(s.payload || "{}");
  if (!s.wpPostId) return "no post";
  if (!cache.has(s.wpPostId)) {
    const post = await fetchPost(wp, s.wpPostId, { edit: true }).catch((e) => ({ _err: e }));
    cache.set(s.wpPostId, post?._err ? null : post?.content?.raw ?? post?.content?.rendered ?? "");
    await sleep(400);
  }
  const content = cache.get(s.wpPostId);
  if (content == null) return "post unreadable";
  if (s.kind === "brand_link") {
    if (alreadyLinked(content, `href="${payload.url}"`)) return "already done";
    return content.includes(payload.anchor) ? "apply (if outside a link, heading and quote)" : "gone";
  }
  const rw = unescapeModelText(payload.replaceWith || "");
  if (s.kind === "internal_link" && alreadyLinked(content, rw)) return "already done";
  const find = locate(content, payload.find);
  if (!find) return "gone";
  if (insideBlockquote(content, content.indexOf(find))) return "quote (refused)";
  return "apply";
}

async function work(slug) {
  const log = [];
  const ctx = await getSiteContext(slug);
  if (!ctx) return { slug, log: ["no context"] };
  const { site, creds } = ctx;
  const db = forSite(site.id);
  const t = { applied: 0, alreadyDone: 0, stillFailed: 0, blocked: false, adviceCleared: 0, spanDismissed: 0 };

  // Advice addressed to the next sweep.
  const advice = await db.seoSuggestion.findMany({ where: { status: "pending", kind: "advice" } });
  for (const a of advice) {
    if (!SWEEP_NOISE.test(`${a.title} ${a.detail}`)) continue;
    t.adviceCleared++;
    if (!DRY)
      await db.seoSuggestion.update({
        where: { id: a.id },
        data: { status: "dismissed", error: "bookkeeping for the audit's own cap, addressed to the next sweep; the link work it names is done by the sweep itself" },
      });
  }

  // Titles the audit wants to "strip": the span is the Leaders hub eyebrow.
  const spans = await db.seoSuggestion.findMany({
    where: { status: "pending", kind: { in: ["title_update", "content_edit"] } },
  });
  for (const s of spans) {
    if (!SPAN_STRIP.test(s.title)) continue;
    t.spanDismissed++;
    if (!DRY)
      await db.seoSuggestion.update({
        where: { id: s.id },
        data: { status: "dismissed", error: "the span is the franchise eyebrow that files the interview in the Leaders hub; leaks are fixed with cogent_plain_title(), not by retitling" },
      });
  }

  if (!isWordPressConfigured(creds?.wordpress)) return { slug, t, log: ["no WordPress credential"] };

  const queue = await db.seoSuggestion.findMany({
    where: {
      kind: { in: KINDS },
      OR: [{ status: "pending" }, { status: "failed", NOT: { error: { contains: "inside a quote" } } }],
      ...(DRY ? {} : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  // A dry run cannot see that a link applied earlier in this pass makes a later
  // duplicate "already done", so its apply count is an upper bound.
  if (DRY) {
    const cache = new Map();
    const tally = {};
    for (const s of queue) {
      const k = await predict(creds.wordpress, s, cache);
      tally[k] = (tally[k] || 0) + 1;
    }
    return { slug, t, predicted: tally, queue: queue.length };
  }

  for (const s of queue) {
    try {
      await applySuggestion(site, s, creds.wordpress);
      await db.seoSuggestion.update({
        where: { id: s.id },
        data: { status: "applied", appliedAt: new Date(), error: null },
      });
      t.applied++;
    } catch (e) {
      if (e.retryable) {
        await db.seoSuggestion.update({ where: { id: s.id }, data: { error: e.message?.slice(0, 300) } });
        log.push(`BLOCKED by host, stopped: ${e.message?.slice(0, 140)}`);
        t.blocked = true;
        break;
      }
      const o = outcomeFor(e);
      await db.seoSuggestion.update({ where: { id: s.id }, data: o });
      if (o.status === "dismissed") t.alreadyDone++;
      else t.stillFailed++;
    }
    await sleep(WRITE_GAP_MS);
  }
  return { slug, t, queue: queue.length, log };
}

// Titles run side by side: each is its own host and its own WAF allowance,
// and the gap between writes is per title.
const results = await Promise.all(sites.map(({ slug }) => work(slug).catch((e) => ({ slug, error: e.message }))));
console.log(DRY ? "DRY RUN, nothing written\n" : "");
for (const r of results) console.log(JSON.stringify(r));
await prisma.$disconnect();
