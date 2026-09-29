// Give every live post on every title an SEO title Google will not cut off.
//
//   node --import ./scripts/_register.mjs scripts/backfill-seo-titles.mjs --dry [--site=<slug>]
//   node --import ./scripts/_register.mjs scripts/backfill-seo-titles.mjs [--site=<slug>]
//
// The successor to shorten-seo-titles.mjs, which ran once on 11 September over
// five titles by SSH and left 152 posts it could not split safely. By
// 29 September 80% of the fleet's recent posts were back over 65 characters,
// because the publisher never set the field; lib/wordpress.js now does, and
// this covers everything published before it did.
//
// Differences from the SSH version, both deliberate:
//   - REST, not update_post_meta. A REST update is a real save, so Yoast
//     rebuilds its indexable and the front end changes on the next request.
//   - Headlines that do not split are WRITTEN (lib/seo-title.js), in batches,
//     and only a title passing acceptableSeoTitle is ever stored. The rest are
//     left alone and listed, exactly as before.
//
// Never touches a post that already has an SEO title.
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
const WRITE_GAP_MS = 1300;
const BATCH = 10;
const REJECTS = process.argv.includes("--rejects");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { prisma } = await import("../lib/prisma.js");
const { getSiteContext } = await import("../lib/site.js");
const { updatePost, isWordPressConfigured } = await import("../lib/wordpress.js");
const { deriveSeoTitle, writeSeoTitles, plainTitle } = await import("../lib/seo-title.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] }, ...(ONLY ? { slug: ONLY } : {}) },
  select: { slug: true },
  orderBy: { createdAt: "asc" },
});

async function allPosts(wp) {
  const base = wp.url.replace(/\/$/, "") + "/wp-json/wp/v2";
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const out = [];
  for (let page = 1; page < 40; page++) {
    const r = await fetch(`${base}/posts?status=publish&per_page=50&page=${page}&context=edit&_fields=id,title,meta`, {
      headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
    });
    if (r.status === 400) break; // past the last page
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("json")) throw new Error(`list page ${page}: ${r.status}`);
    const list = await r.json();
    if (!list.length) break;
    out.push(...list);
    await sleep(800);
  }
  return out;
}

async function work(slug) {
  const { site, creds } = await getSiteContext(slug);
  const wp = creds?.wordpress;
  if (!isWordPressConfigured(wp)) return { slug, skipped: "no WordPress credential" };

  const posts = await allPosts(wp);
  const todo = posts.filter((p) => !String(p.meta?._yoast_wpseo_title || "").trim());
  const plan = new Map();
  const unsplit = [];
  for (const p of todo) {
    const t = deriveSeoTitle(p.title?.raw ?? p.title?.rendered ?? "");
    if (t) plan.set(p.id, { title: t, how: "derived" });
    else unsplit.push({ id: p.id, title: p.title?.raw ?? p.title?.rendered ?? "" });
  }
  // The model drops entries from a long batch without saying so, and a title
  // it wrote too long is refused. Three passes over whatever is still missing.
  for (let pass = 0; pass < 3; pass++) {
    const missing = unsplit.filter((u) => !plan.has(u.id));
    if (!missing.length) break;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const written = await writeSeoTitles(batch, {
        onReject: (id, t) => REJECTS && console.error(`  rejected ${slug} ${id} (${t.length}): ${t}`),
      }).catch((e) => (console.error(`${slug} batch ${i}: ${e.message.slice(0, 200)}`), {}));
      if (REJECTS) console.error(`  ${slug} pass ${pass}: asked ${batch.length}, kept ${Object.keys(written).length}`);
      for (const [id, t] of Object.entries(written)) plan.set(Number(id), { title: t, how: "written" });
    }
  }
  const left = unsplit.filter((u) => !plan.has(u.id));

  const samples = [...plan.entries()]
    .filter(([, v]) => v.how === "written")
    .slice(0, 4)
    .map(([id, v]) => `${plainTitle(todo.find((p) => p.id === id)?.title?.raw || "").slice(0, 90)}  =>  ${v.title}`);

  let set = 0;
  let blocked = null;
  if (!DRY) {
    for (const [id, v] of plan) {
      try {
        await updatePost(wp, id, { meta: { _yoast_wpseo_title: v.title } });
        set++;
      } catch (e) {
        if (e.retryable) { blocked = e.message.slice(0, 140); break; }
      }
      await sleep(WRITE_GAP_MS);
    }
  }
  return {
    slug,
    posts: posts.length,
    alreadyHad: posts.length - todo.length,
    derived: [...plan.values()].filter((v) => v.how === "derived").length,
    written: [...plan.values()].filter((v) => v.how === "written").length,
    leftAlone: left.length,
    ...(DRY ? {} : { set }),
    ...(blocked ? { blocked } : {}),
    samples,
  };
}

const results = await Promise.all(sites.map(({ slug }) => work(slug).catch((e) => ({ slug, error: e.message }))));
console.log(DRY ? "DRY RUN, nothing written\n" : "");
for (const r of results) console.log(JSON.stringify(r, null, 1));
await prisma.$disconnect();
