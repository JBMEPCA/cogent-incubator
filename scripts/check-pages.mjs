// Sweep every public URL on a title and report anything that is not a healthy
// page. Written after the parent/child split, when a stale host cache left both
// homepages serving a pre-swap page that referenced a stylesheet with no rules
// in it — the site was "up" on every status code and visually dead.
//
//   node scripts/check-pages.mjs --site=fleet-magazine [--mobile]
//
// Requests carry a cache-busting query string and a no-cache header, so this
// reports what the SERVER builds, not what the edge happens to be holding.
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

const slug = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1];
const MOBILE = process.argv.includes("--mobile");
if (!slug) { console.error("Usage: node scripts/check-pages.mjs --site=<slug> [--mobile]"); process.exit(1); }

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug } });
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;
const origin = wp.url.replace(/\/$/, "");
const api = `${origin}/wp-json/wp/v2`;
const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
const AH = { authorization: `Basic ${auth}` };

const UA = MOBILE
  ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const j = async (u) => (await fetch(u, { headers: AH })).json().catch(() => []);
const [pages, posts, cats] = await Promise.all([
  j(`${api}/pages?per_page=100&status=publish&_fields=link,title`),
  j(`${api}/posts?per_page=100&status=publish&_fields=link,title`),
  j(`${api}/categories?per_page=100&_fields=link,name,count`),
]);

const urls = [
  { label: "homepage", url: origin + "/" },
  ...pages.map((p) => ({ label: "page", url: p.link })),
  ...cats.filter((c) => c.count > 0).map((c) => ({ label: "category", url: c.link })),
  ...posts.slice(0, 5).map((p) => ({ label: "article", url: p.link })),
  { label: "404", url: origin + "/definitely-not-a-real-url-" + Date.now() + "/" },
  { label: "feed", url: origin + "/feed/" },
];

console.log(`\n${site.name} — ${urls.length} URLs, ${MOBILE ? "mobile" : "desktop"} user agent\n`);

let bad = 0;
for (const u of urls) {
  const sep = u.url.includes("?") ? "&" : "?";
  let res, html = "";
  try {
    res = await fetch(`${u.url}${sep}cb=${Date.now()}`, { headers: { "user-agent": UA, "cache-control": "no-cache" } });
    html = await res.text();
  } catch (e) {
    console.log(`  FAIL  ${u.label.padEnd(9)} ${u.url}  ${e.message.slice(0, 40)}`);
    bad++;
    continue;
  }

  const expect404 = u.label === "404";
  const problems = [];
  if (expect404 ? res.status !== 404 : !res.ok) problems.push(`HTTP ${res.status}`);
  if (/Fatal error|critical error|Parse error/i.test(html)) problems.push("PHP ERROR");
  if (u.label !== "feed" && !expect404) {
    // A page that renders without the parent stylesheet is the failure mode
    // that started this script: every status code green, every layout gone.
    if (!/themes\/cogent-base\/style\.css/.test(html)) problems.push("parent CSS missing");
    if (!/<meta name="viewport"/i.test(html)) problems.push("no viewport meta");
    if (/\[(cogent|smartsme)_tool/.test(html)) problems.push("unrendered shortcode");
    if (html.length < 8000) problems.push(`thin (${html.length}b)`);
  }

  if (problems.length) {
    console.log(`  FAIL  ${u.label.padEnd(9)} ${u.url.replace(origin, "")}  ${problems.join("; ")}`);
    bad++;
  } else {
    console.log(`  ok    ${u.label.padEnd(9)} ${u.url.replace(origin, "")}`);
  }
}

console.log(`\n  ${urls.length - bad}/${urls.length} healthy`);
if (bad) process.exitCode = 1;
await prisma.$disconnect();
