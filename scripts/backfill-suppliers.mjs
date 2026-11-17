// Tag a title's published articles with the suppliers they are about, so each
// supplier's page at /suppliers/<slug>/ collects them. Pilot: one title.
//
//   node scripts/backfill-suppliers.mjs --site=fleet-magazine            (dry run, writes a report)
//   node scripts/backfill-suppliers.mjs --site=fleet-magazine --apply
//
// The registry is scripts/suppliers/<site>.json: hand-curated company names
// plus the other exact names each goes by. See cogent-base/inc/suppliers.php
// in cogent-base-theme for the page side.
//
// THE RULE (JB, 17 Nov 2026). A supplier page is created only when an article
// is ABOUT that company. Here, "about" means one of:
//   - the company's name is in the headline, or
//   - the company is the article's feed source or its recorded subject, and
//     the name also appears in the article.
// A passing mention (the name at least twice in the body; once is usually a
// "see our piece on X" cross-reference) adds the article to a page
// that the "about" pass has already created, and never creates one. Names
// marked mentions:false in the registry (AX, Echoes, MAN...) never match on
// body text at all, because a two-letter or dictionary word cannot be trusted.
//
// Matching is on exact, case-sensitive names with letter-or-digit boundaries,
// so "Ford" does not match "Stratford" and "AXA" does not match "AX". Term
// fields (logo, website, LinkedIn, line) are never filled in here. They stay
// empty until somebody supplies a real value.
//
// Writes over SSH and wp-cli, like seed-directory.mjs, because SiteGround's WAF
// 403s wp-json requests carrying an Authorization header. Additive: it appends
// terms and never removes a tag a person has added.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const prisma = new PrismaClient();
async function siteSsh(slug) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) throw new Error(`No Site row for ${slug}`);
  const s = (await siteCredentials(site.id)).creds.sftp;
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
  const ssh = (cmd) => execFileSync("ssh", [...args, `cd '${docroot}' && ${cmd}`], { encoding: "utf8", timeout: 600000, maxBuffer: 256e6 }).trim();
  const put = (text, remote) => execFileSync("ssh", [...args, `base64 -d > '${remote}'`], { input: Buffer.from(text).toString("base64"), timeout: 300000, maxBuffer: 256e6 });
  return { site, ssh, put };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const SITE = arg("site");
const APPLY = process.argv.includes("--apply");
if (!SITE) { console.error("Usage: --site=<slug> [--apply]"); process.exit(1); }

const regPath = path.join(here, "suppliers", `${SITE}.json`);
const registry = JSON.parse(fs.readFileSync(regPath, "utf8")).suppliers;

const { site, ssh, put } = await siteSsh(SITE);

// 1. Every published post, as plain text.
const dumpPhp = `<?php
$out = array();
foreach ( get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => -1 ) ) as $p ) {
  $out[] = array( 'id' => $p->ID, 'title' => html_entity_decode( get_the_title( $p ), ENT_QUOTES ),
    'body' => html_entity_decode( wp_strip_all_tags( strip_shortcodes( $p->post_content ) ), ENT_QUOTES ) );
}
echo wp_json_encode( $out );`;
put(dumpPhp, "/tmp/sup-dump.php");
const posts = JSON.parse(ssh("wp eval-file /tmp/sup-dump.php; rm -f /tmp/sup-dump.php"));

// 2. What the publisher knows about each one: feed source and subject.
const arts = await prisma.article.findMany({
  where: { siteId: site.id, wpPostId: { not: null } },
  select: { wpPostId: true, subjectOrg: true, sourceItem: { select: { brand: { select: { name: true } } } } },
});
const known = new Map(arts.map((a) => [a.wpPostId, a]));

const clean = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/[‘’]/g, "'").replace(/\s+/g, " ");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B = "(?<![\\p{L}\\p{N}])", E = "(?![\\p{L}\\p{N}])";
for (const s of registry) {
  s.names = [s.name, ...(s.aliases || [])];
  s.re = new RegExp(B + "(?:" + s.names.map(esc).join("|") + ")" + E, "u");
  s.reAll = new RegExp(B + "(?:" + s.names.map(esc).join("|") + ")" + E, "gu");
  s.lower = new Set(s.names.map((n) => n.toLowerCase()));
}
// "Stellantis and Leapmotor", "FleetDue / Widersolutions Limited", "GRIDSERVE and Voltloader"
const parts = (s) => (s || "").split(/\s*(?:\/|,|\band\b|&|\(|\))\s*/i).map((x) => x.trim().toLowerCase()).filter(Boolean);

const about = new Map(); // slug-less: supplier name -> Set(post ids)
const mention = new Map();
const perPost = [];
for (const p of posts) {
  const title = clean(p.title), body = clean(p.body);
  const k = known.get(p.id);
  const sources = [...parts(k?.sourceItem?.brand?.name), ...parts(k?.subjectOrg)];
  const a = [], m = [];
  for (const s of registry) {
    const inTitle = s.re.test(title);
    const inBody = s.re.test(body);
    const isSource = sources.some((x) => s.lower.has(x));
    if (inTitle || (isSource && inBody)) a.push(s.name);
    // Twice or more: a lone name is usually a cross-reference to another story.
    else if (s.mentions !== false && (body.match(s.reAll) || []).length >= 2) m.push(s.name);
  }
  perPost.push({ id: p.id, title, about: a, mentions: m });
  a.forEach((n) => { if (!about.has(n)) about.set(n, new Set()); about.get(n).add(p.id); });
  m.forEach((n) => { if (!mention.has(n)) mention.set(n, new Set()); mention.get(n).add(p.id); });
}

// A mention only counts for a company that already has a page.
const pages = [...about.keys()].sort((x, y) => x.localeCompare(y));
const tags = new Map(); // post id -> names
for (const r of perPost) {
  r.mentions = r.mentions.filter((n) => about.has(n));
  const names = [...r.about, ...r.mentions];
  if (names.length) tags.set(r.id, names);
}

const unused = registry.filter((s) => !about.has(s.name)).map((s) => s.name);
const report = {
  site: SITE, posts: posts.length, suppliers: pages.length,
  taggedArticles: tags.size,
  aboutLinks: perPost.reduce((n, r) => n + r.about.length, 0),
  mentionLinks: perPost.reduce((n, r) => n + r.mentions.length, 0),
  perSupplier: pages.map((n) => ({ name: n, about: about.get(n).size, mentions: perPost.filter((r) => r.mentions.includes(n)).length }))
    .sort((x, y) => (y.about + y.mentions) - (x.about + x.mentions)),
  registryWithNoAboutArticle: unused,
  articles: perPost.filter((r) => r.about.length || r.mentions.length),
};
const reportPath = path.join(here, "suppliers", `${SITE}.report.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log(`${site.name}: ${posts.length} posts, ${pages.length} supplier pages, ${tags.size} articles tagged`);
console.log(`  ${report.aboutLinks} about-links, ${report.mentionLinks} mention-links`);
console.log(`  registry names with no article about them: ${unused.join(", ") || "none"}`);
console.log(`  report: ${reportPath}`);

if (!APPLY) {
  console.log("DRY RUN. Re-run with --apply to write.");
  await prisma.$disconnect();
  process.exit(0);
}

// 3. Write: terms, tags, the about-list per post, and the hub page.
const payload = {
  terms: pages,
  // The other names and the strict flag go onto the term too, so tagging at
  // publish time (lib/suppliers.js) matches exactly as this backfill did.
  match: Object.fromEntries(registry.filter((r) => about.has(r.name)).map((r) => [r.name, { aliases: (r.aliases || []).join(", "), strict: r.mentions === false ? "1" : "" }])),
  posts: [...tags.entries()].map(([id, names]) => ({ id, names, about: perPost.find((r) => r.id === id).about })),
};
const applyPhp = `<?php
$data = json_decode( file_get_contents( '/tmp/sup-payload.json' ), true );
$tax = 'cogent_supplier';
if ( ! taxonomy_exists( $tax ) ) { echo "NO TAXONOMY: deploy the parent theme first\\n"; return; }
$ids = array(); $made = 0;
foreach ( $data['terms'] as $name ) {
  $t = term_exists( $name, $tax );
  if ( ! $t ) { $t = wp_insert_term( $name, $tax ); $made++; }
  if ( is_wp_error( $t ) ) { echo "TERM FAIL {$name}: " . $t->get_error_message() . "\\n"; continue; }
  $ids[ $name ] = (int) $t['term_id'];
  $m = isset( $data['match'][ $name ] ) ? $data['match'][ $name ] : array( 'aliases' => '', 'strict' => '' );
  foreach ( array( 'aliases', 'strict' ) as $k ) {
    if ( '' === $m[ $k ] ) { delete_term_meta( $ids[ $name ], 'cogent_supplier_' . $k ); } else { update_term_meta( $ids[ $name ], 'cogent_supplier_' . $k, $m[ $k ] ); }
  }
}
$tagged = 0;
foreach ( $data['posts'] as $p ) {
  $tids = array();
  foreach ( $p['names'] as $n ) { if ( isset( $ids[ $n ] ) ) { $tids[] = $ids[ $n ]; } }
  if ( ! $tids ) { continue; }
  wp_set_object_terms( (int) $p['id'], $tids, $tax, true );
  $about = array();
  foreach ( $p['about'] as $n ) { if ( isset( $ids[ $n ] ) ) { $about[] = get_term( $ids[ $n ] )->slug; } }
  update_post_meta( (int) $p['id'], '_cogent_supplier_about', $about );
  $tagged++;
}
$hub = get_page_by_path( 'suppliers' );
if ( ! $hub ) {
  $id = wp_insert_post( array(
    'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Suppliers', 'post_name' => 'suppliers',
    'post_content' => "<!-- wp:group {\\"align\\":\\"wide\\",\\"layout\\":{\\"type\\":\\"default\\"}} -->\\n<div class=\\"wp-block-group alignwide\\"><!-- wp:paragraph -->\\n<p>Every company we have written about, and every article we have published about each one.</p>\\n<!-- /wp:paragraph --></div>\\n<!-- /wp:group -->\\n\\n<!-- wp:shortcode -->\\n[cogent_suppliers]\\n<!-- /wp:shortcode -->",
  ), true );
  if ( ! is_wp_error( $id ) ) { update_post_meta( $id, '_yoast_wpseo_meta-robots-noindex', '1' ); echo "hub page created: {$id}\\n"; }
}
echo "terms created {$made}, posts tagged {$tagged}\\n";
`;
put(JSON.stringify(payload), "/tmp/sup-payload.json");
put(applyPhp, "/tmp/sup-apply.php");
console.log(ssh("wp eval-file /tmp/sup-apply.php; rm -f /tmp/sup-apply.php /tmp/sup-payload.json"));
await prisma.$disconnect();
