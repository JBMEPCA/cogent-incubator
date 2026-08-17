// Post-launch smoke test for one title. Every check here is something that went
// wrong, silently, during the title #2 launch — see docs/new-title-playbook.md.
// A title that passes this is genuinely ready to run unattended.
//
//   node scripts/verify-title.mjs --site=fleet-magazine
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
if (!slug) { console.error("Usage: node scripts/verify-title.mjs --site=<slug>"); process.exit(1); }

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials, CREDENTIAL_KINDS } = await import("../lib/site.js");
const { authorForSite } = await import("../lib/wordpress.js");

const rows = [];
const check = (label, ok, detail) => rows.push({ label, ok, detail });

const site = await prisma.site.findUnique({ where: { slug } });
if (!site) { console.error(`No title "${slug}"`); process.exit(1); }
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);

// ---- engine ------------------------------------------------------------
check("Engine enabled", site.engineEnabled, site.engineEnabled ? "on" : "OFF — nothing will run");
check(
  "Status lets cron see it",
  ["live", "cold_start"].includes(site.status),
  `${site.status}${site.status === "setup" ? " — every scheduled job SKIPS this title" : ""}`
);
check("Daily spend cap set", site.dailySpendCapUsd != null, site.dailySpendCapUsd != null ? `$${site.dailySpendCapUsd}/day` : "UNCAPPED — one title can exhaust the fleet-wide API limit");
check("Article target sane", site.articlesPerDayTarget >= 1, `${site.articlesPerDayTarget}/day`);

// ---- credentials -------------------------------------------------------
for (const [kind, spec] of Object.entries(CREDENTIAL_KINDS)) {
  const has = Boolean(creds[kind] && Object.keys(creds[kind]).length);
  if (spec.required) check(`Credential: ${spec.label}`, has, has ? "stored" : "MISSING and required");
  else if (has) check(`Credential: ${spec.label}`, true, "stored (optional)");
}

// ---- wordpress ---------------------------------------------------------
const wp = creds.wordpress;
if (wp?.url) {
  const auth = Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64");
  const H = { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" };
  const base = `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2`;

  check("Site URL is https", wp.url.startsWith("https://"), wp.url);

  try {
    const me = await fetch(`${base}/users/me?context=edit`, { headers: H });
    const body = await me.text();
    const captcha = /sgcaptcha/i.test(body);
    check("REST authenticates", me.ok && !captcha, captcha ? "CAPTCHA INTERSTITIAL — publishes will fail while looking healthy" : `HTTP ${me.status}`);
    if (me.ok) {
      const u = JSON.parse(body);
      check("Engine is an editor, not an admin", (u.roles || []).includes("editor"), (u.roles || []).join(", ") || "unknown");
    }
  } catch (e) { check("REST authenticates", false, e.message.slice(0, 60)); }

  const settings = await fetch(`${base}/settings`, { headers: H }).catch(() => null);
  check("Settings correctly forbidden", settings?.status === 403, settings ? `HTTP ${settings.status}` : "unreachable");

  const authorId = await authorForSite(wp, site);
  check("Byline resolves", authorId != null, authorId ? `WP user #${authorId} (${site.authorName || site.bylineMode})` : "NULL — posts publish as the Engine account");

  // Categories must match the sections exactly or the Researcher's validation drops them.
  const cats = await (await fetch(`${base}/categories?per_page=100`, { headers: H })).json().catch(() => []);
  const catNames = new Set((Array.isArray(cats) ? cats : []).map((c) => c.name.replace(/&amp;/g, "&").toLowerCase()));
  const missing = (site.sections || []).map((s) => s.name).filter((n) => !catNames.has(n.toLowerCase()));
  check("Every section has a category", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${site.sections.length} matched`);

  // Live head check, cache-busted — meta silently vanishes without Yoast.
  const posts = await (await fetch(`${base}/posts?per_page=1&_fields=id,link,author`, { headers: H })).json().catch(() => []);
  if (Array.isArray(posts) && posts.length) {
    const html = await (await fetch(`${posts[0].link}?cb=${process.pid}`, { headers: { "cache-control": "no-cache" } })).text();
    check("Meta description renders", /<meta name="description"/i.test(html), /yoast/i.test(html) ? "Yoast active" : "no Yoast in head — meta keys are being discarded on publish");
    check("Latest post carries the byline", posts[0].author === authorId, `author #${posts[0].author}`);
  } else check("Has published posts", false, "none");
}

// ---- content and wire --------------------------------------------------
const [articles, sources, items, unread] = await Promise.all([
  db.article.count({ where: { status: "published" } }),
  db.prBrand.count(),
  db.feedItem.count(),
  db.feedItem.count({ where: { status: "new" } }),
]);
check("Published articles", articles > 0, String(articles));
check("Wire sources", sources >= 10, `${sources} sources`);
check("Wire has items", items > 0, `${items} items, ${unread} unread`);

const steps = await db.siteProvisioningStep.findMany();
const blocking = steps.filter((s) => s.blocking && !s.done);
check("No blocking provisioning left", blocking.length === 0, blocking.length ? blocking.map((s) => s.key).join(", ") : `${steps.filter((s) => s.done).length}/${steps.length} done`);

// ---- report ------------------------------------------------------------
const pad = Math.max(...rows.map((r) => r.label.length));
console.log(`\n${site.name} (${slug})\n`);
for (const r of rows) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.label.padEnd(pad)}  ${r.detail || ""}`);
const failed = rows.filter((r) => !r.ok);
console.log(`\n  ${rows.length - failed.length}/${rows.length} passed`);
if (failed.length) {
  console.log(`  NOT READY: ${failed.map((r) => r.label).join("; ")}`);
  process.exitCode = 1;
} else {
  console.log("  Ready to run unattended.");
}
await prisma.$disconnect();
