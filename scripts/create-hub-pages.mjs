// Create one topic hub page per title, as a WordPress DRAFT.
//
//   SP=<dir> node --import ./scripts/_register.mjs scripts/create-hub-pages.mjs --dry
//   SP=<dir> node --import ./scripts/_register.mjs scripts/create-hub-pages.mjs
//
// The SEO audit asked for a topic hub on every title, repeatedly: 13 of the 19
// real recommendations standing on 3 September were this one request restated.
// It is the gap the automated linker cannot close for itself, because a link
// needs a destination and the destination did not exist.
//
// These are created as DRAFTS and never published. That is the rule set on
// 2 September for the interview pipeline and it applies at least as strongly
// here: a machine-written page going live under the masthead is the move that
// cannot be taken back, so a human keeps the publish button.
//
// Every href is checked against that title's published slugs before anything is
// sent. A hub page full of 404s is worse than no hub page.
import fs from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const SP = process.env.SP;
if (!SP) { console.error("set SP to the directory holding hubs/ and posts-*.json"); process.exit(1); }
const DRY = process.argv.includes("--dry");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const manifest = JSON.parse(fs.readFileSync(`${SP}/hubs/manifest.json`, "utf8"));
const results = [];

for (const entry of manifest) {
  const content = fs.readFileSync(`${SP}/hubs/${entry.site}.html`, "utf8");
  const posts = JSON.parse(fs.readFileSync(`${SP}/posts-${entry.site}.json`, "utf8"));
  const known = new Set(posts.map((p) => p.slug));

  const hrefs = [...content.matchAll(/href="\/([^"]+?)\/"/g)].map((m) => decodeURIComponent(m[1]));
  const missing = hrefs.filter((h) => !known.has(h));
  if (missing.length) {
    console.log(`\n== ${entry.site}: REFUSED, ${missing.length} link(s) point at nothing`);
    for (const m of missing) console.log(`   /${m}/`);
    results.push({ site: entry.site, ok: false, reason: "broken links" });
    continue;
  }

  const site = await prisma.site.findUnique({ where: { slug: entry.site }, select: { id: true } });
  const { creds } = await siteCredentials(site.id);
  const wp = creds.wordpress;
  const origin = wp.url.replace(/\/$/, "");
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const headers = {
    authorization: `Basic ${auth}`,
    "content-type": "application/json",
    "user-agent": "CogentBot/1.0",
  };

  // Never create a second copy of a hub that is already there.
  const existing = await fetch(`${origin}/wp-json/wp/v2/pages?slug=${entry.slug}&status=publish,draft&_fields=id,status`, { headers });
  const found = existing.ok ? await existing.json() : [];
  if (found.length) {
    console.log(`\n== ${entry.site}: /${entry.slug}/ already exists as page ${found[0].id} [${found[0].status}], skipped`);
    results.push({ site: entry.site, ok: true, skipped: true, id: found[0].id });
    continue;
  }

  console.log(`\n== ${entry.site}: ${hrefs.length} links verified, ${content.length} bytes${DRY ? " (dry run)" : ""}`);
  console.log(`   ${entry.title}`);
  if (DRY) { results.push({ site: entry.site, ok: true, dry: true }); continue; }

  const res = await fetch(`${origin}/wp-json/wp/v2/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: entry.title,
      slug: entry.slug,
      content,
      status: "draft",
      meta: {
        _yoast_wpseo_focuskw: entry.keyphrase,
        _yoast_wpseo_metadesc: entry.metadesc,
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    console.log(`   FAILED ${res.status}: ${body}`);
    results.push({ site: entry.site, ok: false, reason: `${res.status} ${body}` });
    continue;
  }

  const page = await res.json();
  const meta = page.meta || {};
  console.log(`   created draft page ${page.id} at /${page.slug}/`);
  console.log(`   yoast metadesc stored: ${meta._yoast_wpseo_metadesc ? "yes" : "NO, set it in the editor"}`);
  results.push({ site: entry.site, ok: true, id: page.id, slug: page.slug, link: page.link });
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(`\n${JSON.stringify(results, null, 1)}`);
await prisma.$disconnect();
