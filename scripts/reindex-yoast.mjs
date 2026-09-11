// Make Yoast pick up SEO titles written straight to post meta.
//
//   node scripts/reindex-yoast.mjs --all [--dry]
//   node scripts/reindex-yoast.mjs --site=<slug>
//
// WHY THIS IS NEEDED, and it is not obvious. Yoast does not read
// _yoast_wpseo_title when it renders a page. It keeps its own copy in the
// wp_yoast_indexable table and serves that, rebuilding the row only when a post
// is saved through WordPress. So writing the meta with update_post_meta, as
// shorten-seo-titles.mjs does, leaves the meta correct, the front end unchanged,
// and nothing anywhere reporting an error.
//
// The tell is an indexable row whose `title` column is empty while the post meta
// has a value. Empty means "fall back to the title template", which is exactly
// the long title we were trying to replace. On Smart SME that was 175 rows of
// 187 after the meta had already been written successfully.
//
// WHY IT DELETES ROWS RATHER THAN RUNNING `wp yoast index --reindex`. Two
// reasons. That command prompts for confirmation, rejects wp-cli's global --yes
// as an unknown parameter, and does not take the answer over a piped stdin, so
// it cannot be run unattended. And it clears every indexed object on the site
// including terms and authors, which is far more than this change touches.
//
// Deleting a post's indexable row is the operation Yoast is built to survive:
// the row is a cache, and the next request for that URL rebuilds it from the
// post and its meta. Nothing is lost. Only rows for posts that actually carry a
// custom SEO title are touched.
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
const DRY = process.argv.includes("--dry");
const ALL = process.argv.includes("--all");
const only = arg("site");
const SITES = ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business", "airport-business-magazine"];
if (!only && !ALL) { console.error("Usage: --site=<slug> | --all [--dry]"); process.exit(1); }
const slugs = ALL ? SITES : [only];

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.log(`\n## ${slug}: no Site row`); continue; }
  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { console.log(`\n## ${site.name}: no sftp credential`); continue; }

  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const base = ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
    "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
  const sshIn = (c, i = "") =>
    execFileSync("ssh", [...base, c], { encoding: "utf8", timeout: 600000, maxBuffer: 60 * 1024 * 1024, input: i });

  const php = `<?php
global $wpdb;
$dry = ${DRY ? "true" : "false"};
$t = $wpdb->prefix . 'yoast_indexable';
if ( ! $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $t ) ) ) {
	echo "no yoast_indexable table, nothing to do\\n"; return;
}

// Only posts that carry a custom SEO title, and only where the cached row
// disagrees with it. Everything else is already correct and is left alone.
$rows = $wpdb->get_results(
	"SELECT i.id, i.object_id, i.title AS cached, m.meta_value AS wanted
	   FROM {$t} i
	   JOIN {$wpdb->postmeta} m
	     ON m.post_id = i.object_id AND m.meta_key = '_yoast_wpseo_title'
	  WHERE i.object_type = 'post'
	    AND m.meta_value <> ''
	    AND ( i.title IS NULL OR i.title = '' OR i.title <> m.meta_value )"
);

echo ( $dry ? "would clear " : "cleared " ) . count( $rows ) . " stale indexable rows\\n";
foreach ( array_slice( $rows, 0, 3 ) as $r ) {
	echo "     post " . $r->object_id . ": cached [" . mb_substr( (string) $r->cached, 0, 40 )
		. "] wanted [" . mb_substr( (string) $r->wanted, 0, 46 ) . "]\\n";
}

if ( ! $dry && $rows ) {
	$ids = array_map( function ( $r ) { return (int) $r->id; }, $rows );
	$wpdb->query( "DELETE FROM {$t} WHERE id IN (" . implode( ',', $ids ) . ")" );
	// Yoast keeps a count of indexables needing work; clearing its transients
	// stops the admin nagging about an incomplete index afterwards.
	delete_transient( 'wpseo_total_unindexed_posts' );
	wp_cache_flush();
	echo "  rows deleted, Yoast rebuilds each on the next request for that URL\\n";
}
`;

  sshIn(`cat > /tmp/ry.php`, php);
  const out = sshIn(`cd '${docroot}' && wp eval-file /tmp/ry.php 2>&1 | tail -8; rm -f /tmp/ry.php`).trim();
  console.log(`\n## ${site.name}`);
  console.log("  " + out.split("\n").join("\n  "));
}

await prisma.$disconnect();
