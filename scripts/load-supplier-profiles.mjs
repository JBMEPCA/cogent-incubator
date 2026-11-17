// Load supplier page details (logo, website, one-line description, sector)
// into a title's cogent_supplier terms.
//
//   node scripts/load-supplier-profiles.mjs --site=fleet-magazine --logos=<dir> [--only="A|B"] [--dry]
//
// Reads scripts/suppliers/<site>.profiles.json, plus <dir>/logos.json mapping
// each supplier to a logo file in <dir>/logos/ (or {remote: url} for one the
// server should fetch itself). Logos go into the site's media library, so a
// company changing its own CDN never breaks our page.
//
// Every value comes from the company's own site, or our own published article,
// and an unconfirmed one stays empty. Re-running is safe: a logo already in the
// library for that supplier is reused, and fields are overwritten with the file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=");
const SITE = arg("site"), LOGOS = arg("logos"), DRY = process.argv.includes("--dry");
const ONLY = arg("only") ? arg("only").split("|") : null; // --only="Wayve|Ford" to redo a few
if (!SITE) { console.error("Usage: --site=<slug> [--logos=<dir>] [--dry]"); process.exit(1); }

const profiles = JSON.parse(fs.readFileSync(path.join(here, "suppliers", `${SITE}.profiles.json`), "utf8")).suppliers;
const logos = LOGOS ? JSON.parse(fs.readFileSync(path.join(LOGOS, "logos.json"), "utf8")) : {};

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: SITE } });
const s = (await siteCredentials(site.id)).creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
const ssh = (cmd) => execFileSync("ssh", [...args, `cd '${docroot}' && ${cmd}`], { encoding: "utf8", timeout: 600000, maxBuffer: 64e6 }).trim();
const put = (buf, remote) => execFileSync("ssh", [...args, `base64 -d > '${remote}'`], { input: Buffer.from(buf).toString("base64"), timeout: 300000, maxBuffer: 256e6 });

const rows = Object.entries(profiles).filter(([name]) => !ONLY || ONLY.includes(name)).map(([name, p]) => {
  const l = logos[name] || {};
  return { name, website: p.website || "", line: p.line || "", sector: p.sector || "", dark: p.dark ? "1" : "", file: l.f || "", remote: l.remote || "" };
});
console.log(`${site.name}: ${rows.length} suppliers, ${rows.filter((r) => r.file || r.remote).length} with logos`);
if (DRY) { await prisma.$disconnect(); process.exit(0); }

ssh("rm -rf /tmp/sup-logos && mkdir -p /tmp/sup-logos");
for (const r of rows) if (r.file) put(fs.readFileSync(path.join(LOGOS, "logos", r.file)), `/tmp/sup-logos/${r.file}`);
put(JSON.stringify(rows), "/tmp/sup-profiles.json");

const php = `<?php
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';
// SVG is not an allowed upload type by default. These files came from the
// companies' own sites and were checked by eye; allow it for this run only.
add_filter( 'upload_mimes', function ( $m ) { $m['svg'] = 'image/svg+xml'; $m['webp'] = 'image/webp'; return $m; } );
add_filter( 'wp_check_filetype_and_ext', function ( $d, $file, $filename ) {
  if ( preg_match( '/\\.svg$/i', $filename ) ) { return array( 'ext' => 'svg', 'type' => 'image/svg+xml', 'proper_filename' => $filename ); }
  return $d;
}, 10, 3 );
$rows = json_decode( file_get_contents( '/tmp/sup-profiles.json' ), true );
$done = 0; $logos = 0; $miss = array();
foreach ( $rows as $r ) {
  $t = get_term_by( 'name', $r['name'], 'cogent_supplier' );
  if ( ! $t ) { $miss[] = $r['name']; continue; }
  foreach ( array( 'website', 'line', 'sector' ) as $k ) {
    if ( '' === $r[ $k ] ) { delete_term_meta( $t->term_id, 'cogent_supplier_' . $k ); }
    else { update_term_meta( $t->term_id, 'cogent_supplier_' . $k, $r[ $k ] ); }
  }
  if ( $r['dark'] ) { update_term_meta( $t->term_id, 'cogent_supplier_logo_dark', '1' ); }
  else { delete_term_meta( $t->term_id, 'cogent_supplier_logo_dark' ); }

  $src = $r['file'] ? '/tmp/sup-logos/' . $r['file'] : $r['remote'];
  if ( $src ) {
    $existing = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 1,
      'meta_key' => '_cogent_supplier_logo_for', 'meta_value' => $t->slug ) );
    if ( $existing ) { wp_delete_attachment( $existing[0]->ID, true ); }
    $ext = $r['file'] ? pathinfo( $r['file'], PATHINFO_EXTENSION ) : pathinfo( parse_url( $r['remote'], PHP_URL_PATH ), PATHINFO_EXTENSION );
    $tmp = $r['file'] ? wp_tempnam( $r['file'] ) : download_url( $r['remote'] );
    if ( is_wp_error( $tmp ) ) { echo "LOGO FAIL {$r['name']}: " . $tmp->get_error_message() . "\\n"; }
    else {
      if ( $r['file'] ) { copy( $src, $tmp ); }
      $id = media_handle_sideload( array( 'name' => $t->slug . '-logo.' . $ext, 'tmp_name' => $tmp ), 0, $r['name'] . ' logo' );
      if ( is_wp_error( $id ) ) { echo "LOGO FAIL {$r['name']}: " . $id->get_error_message() . "\\n"; @unlink( $tmp ); }
      else {
        update_post_meta( $id, '_cogent_supplier_logo_for', $t->slug );
        update_post_meta( $id, '_wp_attachment_image_alt', $r['name'] . ' logo' );
        update_term_meta( $t->term_id, 'cogent_supplier_logo', wp_get_attachment_url( $id ) );
        $logos++;
      }
    }
  }
  $done++;
}
echo "updated {$done}, logos {$logos}" . ( $miss ? ', no term for: ' . implode( ', ', $miss ) : '' ) . "\\n";
`;
put(php, "/tmp/sup-load.php");
console.log(ssh("wp eval-file /tmp/sup-load.php; rm -rf /tmp/sup-load.php /tmp/sup-profiles.json /tmp/sup-logos; wp cache flush; wp sg purge 2>&1 | tail -1"));
await prisma.$disconnect();
