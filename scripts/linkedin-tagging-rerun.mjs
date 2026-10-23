/**
 * Re-runs company tagging over posts that already went out, old rules against
 * new, and says how many tags each would have carried.
 *
 * Read-only against the database: the live URN cache is copied into memory and
 * never written back, and nothing is posted. "Before" is the rules as they
 * were on 22 Oct 2026 (exact host match, exact name in the post) over the
 * cache as it stands. "After" is lib/linkedin-mentions.js as it is now, which
 * re-checks the domains the old rules gave up on. Those re-checks are real
 * LinkedIn lookups through the Make bridge, so they are capped (--lookups) and
 * every answer is kept in --memo, so a second run costs nothing.
 *
 *   node --env-file=.env scripts/linkedin-tagging-rerun.mjs
 *   node --env-file=.env scripts/linkedin-tagging-rerun.mjs --days=14 --lookups=500 --memo=lookups.json
 *   node --env-file=.env scripts/linkedin-tagging-rerun.mjs --scan      (also try the Haiku brand scan)
 *
 * Posts are taken newest first, so when the lookup cap runs out it is the
 * oldest posts whose unknown domains go unchecked; the report says how many.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { mentionsForArticle, renderCommentary, lookupBudget, readCache, MAX_MENTIONS } from "../lib/linkedin-mentions.js";
import { lookupOrganisation } from "../lib/social-bridge.js";

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const DAYS = Number(arg("days", 14));
const LOOKUPS = Number(arg("lookups", 500));
const MEMO = arg("memo", null);
const SCAN = process.argv.includes("--scan");

const p = new PrismaClient();
const memo = MEMO && fs.existsSync(MEMO) ? JSON.parse(fs.readFileSync(MEMO, "utf8")) : {};
let live = 0;
const lookup = async (_token, vanity) => {
  if (vanity in memo) return memo[vanity];
  live++;
  const org = await lookupOrganisation(vanity);
  memo[vanity] = org ? { id: org.id, localizedName: org.localizedName, vanityName: org.vanityName, localizedWebsite: org.localizedWebsite } : null;
  if (MEMO && live % 20 === 0) fs.writeFileSync(MEMO, JSON.stringify(memo));
  return memo[vanity];
};

// Memoised answers are free, so only live calls count against the cap.
const budget = lookupBudget({ calls: Infinity, ms: Infinity, lookup });
const capped = { ...budget, get left() { return LOOKUPS - live; }, set left(_) {} };

const host = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

function linksOf(body) {
  const links = [];
  for (const m of body.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)) {
    links.push({ url: m[1], text: m[2].replace(/<[^>]+>/g, "").trim() || null });
  }
  for (const m of body.matchAll(/href=["']([^"']+)["']/gi)) {
    if (!links.some((l) => l.url === m[1])) links.push({ url: m[1], text: null });
  }
  return links;
}

/** The rules before 23 Oct 2026, over the cache as it is: exact host, exact name. */
function before(text, links, ownHost, cache) {
  const found = [];
  for (const l of links) {
    const h = host(l.url);
    if (!h || h === ownHost || h.endsWith(`.${ownHost}`)) continue;
    const e = cache[h];
    if (e?.urn && !found.some((f) => f.urn === e.urn)) found.push({ urn: e.urn, name: e.name, host: h });
    if (found.length >= MAX_MENTIONS) break;
  }
  return found.filter((m) => text.includes(m.name));
}

const since = new Date(Date.now() - DAYS * 864e5);
const sites = new Map((await p.site.findMany()).map((s) => [s.id, s]));
const posts = await p.linkedInPost.findMany({
  where: { status: "posted", postedAt: { gte: since }, articleId: { not: null } },
  orderBy: { postedAt: "desc" },
  select: { id: true, siteId: true, articleId: true, text: true, postedAt: true },
});
const articles = new Map(
  (await p.article.findMany({ where: { id: { in: posts.map((x) => x.articleId) } }, select: { id: true, body: true } })).map((a) => [a.id, a])
);

const snapshot = await readCache();
const mem = structuredClone(snapshot);
const store = { read: async () => mem, write: async () => {} };

const rows = [];
let cutOff = 0;
for (const post of posts) {
  const site = sites.get(post.siteId);
  const body = articles.get(post.articleId)?.body || "";
  const links = linksOf(body);
  const ownHost = String(site?.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const text = post.text.trim();

  const old = before(text, links, ownHost, snapshot);
  if (live >= LOOKUPS) cutOff++;
  const found = await mentionsForArticle(null, { links, ownHost, text, brandScan: SCAN, budget: capped, store });
  const out = renderCommentary(text, found);
  const now = found.filter((m) => out.includes(`](${m.urn})`));
  rows.push({ site: site?.slug, post: post.id, at: post.postedAt, before: old, after: now, resolvedNotInText: found.filter((m) => !now.includes(m)) });
}
if (MEMO) fs.writeFileSync(MEMO, JSON.stringify(memo));

const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
const bySite = {};
for (const r of rows) {
  const s = (bySite[r.site] ||= { posts: 0, before: 0, after: 0, postsTaggedBefore: 0, postsTaggedAfter: 0 });
  s.posts++;
  s.before += r.before.length;
  s.after += r.after.length;
  s.postsTaggedBefore += r.before.length ? 1 : 0;
  s.postsTaggedAfter += r.after.length ? 1 : 0;
}

const key = (m) => m.urn;
const gained = rows.flatMap((r) => r.after.filter((m) => !r.before.some((b) => key(b) === key(m))).map((m) => ({ site: r.site, ...m })));
const lost = rows.flatMap((r) => r.before.filter((m) => !r.after.some((a) => key(a) === key(m))).map((m) => ({ site: r.site, ...m })));

console.log(`\nPosts ${rows.length} (last ${DAYS} days)  live lookups ${live}  memoised ${Object.keys(memo).length}  posts after the cap ran out ${cutOff}`);
console.log(`Tags before ${sum((r) => r.before.length)}  after ${sum((r) => r.after.length)}`);
console.log(`Posts with a tag before ${sum((r) => (r.before.length ? 1 : 0))}  after ${sum((r) => (r.after.length ? 1 : 0))}`);
console.table(bySite);
console.log(`\nGained (${gained.length}):`);
for (const g of gained) console.log(`  ${g.site.padEnd(28)} ${g.name}  <- ${g.host} (${g.via})`);
console.log(`\nLost (${lost.length}):`);
for (const l of lost) console.log(`  ${l.site.padEnd(28)} ${l.name}  <- ${l.host}`);
const missed = rows.flatMap((r) => r.resolvedNotInText.map((m) => ({ site: r.site, ...m })));
console.log(`\nResolved but not named in the post (${missed.length}), first 25:`);
for (const m of missed.slice(0, 25)) console.log(`  ${m.site.padEnd(28)} ${m.name}  <- ${m.host}`);

if (arg("json", null)) fs.writeFileSync(arg("json"), JSON.stringify({ rows, bySite, gained, lost }, null, 1));
await p.$disconnect();
