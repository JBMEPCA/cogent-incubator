// Seed a title's directory collection from a JSON file of rows.
//
//   node scripts/seed-directory.mjs --site=<slug> --collection=<slug> --file=<path> [--dry] [--force]
//
// Rows are created as cogent_entry posts, assigned to the collection taxonomy,
// with the whole row stored in one _cogent_entry meta object. See
// cogent-base/inc/directory.php for why the type looks the way it does.
//
// THE DATA RULE. Every value here came out of an article the title itself
// published and an editor passed, extracted verbatim. Nothing is inferred,
// averaged, converted or filled in from general knowledge, and an unstated
// value stays an empty string so the parent can render it as "not published"
// rather than as a number somebody might act on. A directory is only worth
// having if a buyer can trust a row, and one invented figure under a masthead
// costs more than the whole table earns. If you extend this, keep that rule.
//
// Runs over SSH and wp-cli rather than the REST API, because SiteGround's WAF
// 403s any wp-json request carrying an Authorization header on all five titles.
// The whole batch goes in one round trip: a per-row ssh call costs a second
// each and forty rows is a minute of nothing.
//
// Idempotent on post_name. An existing entry is updated in place, never
// duplicated, so re-running after fixing one cell is safe.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const SITE = arg("site");
const COLLECTION = arg("collection");
const FILE = arg("file");
const TITLE_FIELD = arg("titleField") || "name";
const DRY = process.argv.includes("--dry");

if (!SITE || !COLLECTION || !FILE) {
  console.error("Usage: --site=<slug> --collection=<slug> --file=<path> [--titleField=name] [--dry]");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(rows) || !rows.length) {
  console.error(`${FILE} holds no rows.`);
  process.exit(1);
}

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug: SITE } });
if (!site) { console.error(`No Site row for ${SITE}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);
const sftp = creds?.sftp;
if (!sftp?.host) { console.error(`No sftp credential for ${SITE}`); process.exit(1); }

const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const base = ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
  "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
const sshIn = (cmd, input = "") =>
  execFileSync("ssh", [...base, cmd], { encoding: "utf8", timeout: 300000, maxBuffer: 60 * 1024 * 1024, input });

const today = new Date().toISOString().slice(0, 10);

// Normalise: title out of the row, everything else into the meta object, and a
// checked date on every entry so the index can show its oldest one.
const payload = rows
  .map((r) => {
    const title = String(r[TITLE_FIELD] || "").trim();
    if (!title) return null;
    const meta = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === TITLE_FIELD) continue;
      meta[k] = v === null || v === undefined ? "" : String(v).trim();
    }
    meta.checked = today;
    return { title, meta };
  })
  .filter(Boolean);

console.log(`${site.name} → ${COLLECTION}: ${payload.length} rows from ${path.basename(FILE)}`);
if (DRY) {
  payload.slice(0, 5).forEach((p) =>
    console.log(`   ${p.title.padEnd(34)} ${Object.entries(p.meta).filter(([, v]) => v).length} populated fields`)
  );
  const blanks = {};
  for (const p of payload) for (const [k, v] of Object.entries(p.meta)) if (!v) blanks[k] = (blanks[k] || 0) + 1;
  console.log("   empty-field counts:", JSON.stringify(blanks));
  console.log("   DRY RUN, nothing written.");
  await prisma.$disconnect();
  process.exit(0);
}

/*
 * The remote pass. Reads the payload from a file rather than an argument
 * because a forty-row JSON blob is far past the Windows argv limit, and builds
 * every post in one PHP process so the taxonomy term is resolved once.
 *
 * The body is composed only from fields that were actually extracted. It is
 * deliberately thin: the facts table the parent renders above it is the page,
 * and padding an entry with generated prose is how a directory turns into the
 * content farms these pages are meant to beat.
 */
const php = `<?php
$data = json_decode( file_get_contents( '/tmp/cogent-dir-payload.json' ), true );
$collection = ${JSON.stringify(COLLECTION)};

$term = term_exists( $collection, 'cogent_collection' );
if ( ! $term ) {
	$term = wp_insert_term( $collection, 'cogent_collection', array( 'slug' => $collection ) );
}
if ( is_wp_error( $term ) ) { echo "TERM FAIL: " . $term->get_error_message() . "\\n"; return; }

$created = 0; $updated = 0; $failed = 0;

foreach ( $data as $item ) {
	$title = $item['title'];
	$meta  = $item['meta'];
	$slug  = sanitize_title( $title );

	// Resolve the source article to a real permalink, and drop the reference
	// entirely if the slug does not match a published post. A directory whose
	// provenance links 404 is worse than one that cites nothing.
	if ( ! empty( $meta['source'] ) ) {
		$src_slugs = array_map( 'trim', explode( ',', $meta['source'] ) );
		$src = get_page_by_path( $src_slugs[0], OBJECT, 'post' );
		if ( $src && 'publish' === $src->post_status ) {
			$meta['source_url']   = get_permalink( $src );
			$meta['source_title'] = $src->post_title;
		}
		unset( $meta['source'] );
	}

	$existing = get_page_by_path( $slug, OBJECT, 'cogent_entry' );

	$body = '';
	foreach ( array( 'supplies', 'what_it_is', 'best_for' ) as $k ) {
		if ( ! empty( $meta[ $k ] ) ) { $body = $meta[ $k ]; break; }
	}
	$excerpt = $body;

	$postarr = array(
		'post_type'    => 'cogent_entry',
		'post_title'   => $title,
		'post_name'    => $slug,
		'post_status'  => 'publish',
		'post_excerpt' => $excerpt,
		'post_content' => $body ? '<!-- wp:paragraph --><p>' . esc_html( $body ) . '</p><!-- /wp:paragraph -->' : '',
	);

	if ( $existing ) {
		$postarr['ID'] = $existing->ID;
		$id = wp_update_post( $postarr, true );
		$was = 'updated';
	} else {
		$id = wp_insert_post( $postarr, true );
		$was = 'created';
	}

	if ( is_wp_error( $id ) ) { echo "FAIL {$title}: " . $id->get_error_message() . "\\n"; $failed++; continue; }

	wp_set_object_terms( $id, $collection, 'cogent_collection', false );
	update_post_meta( $id, '_cogent_entry', $meta );

	if ( 'created' === $was ) { $created++; } else { $updated++; }
}

echo "created {$created}, updated {$updated}, failed {$failed}\\n";
flush_rewrite_rules( false );
`;

sshIn(`cat > /tmp/cogent-dir-payload.json`, JSON.stringify(payload));
sshIn(`cat > /tmp/cogent-dir-seed.php`, php);
const out = sshIn(
  `cd '${docroot}' && wp eval-file /tmp/cogent-dir-seed.php; rm -f /tmp/cogent-dir-seed.php /tmp/cogent-dir-payload.json`
);
console.log("   " + out.trim().split("\n").join("\n   "));

await prisma.$disconnect();
