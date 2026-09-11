// Give every post an SEO title that survives Google's truncation.
//
//   node scripts/shorten-seo-titles.mjs --site=<slug> --dry
//   node scripts/shorten-seo-titles.mjs --all [--dry] [--force]
//
// THE PROBLEM, measured 11 September 2026. Across Smart SME, Fleet and Golf
// Resort, 99% to 100% of published posts produce a title tag longer than the
// roughly 60 characters Google shows. Medians are 89, 98 and 107 characters
// including the " - <Site Name>" Yoast appends. So on almost every result the
// reader sees a sentence cut off mid-clause, and on the longest ones the actual
// news never appears at all.
//
// That matters because the click gap is the biggest single number on these
// sites: Smart SME ranks on page one for 211 queries and takes 26 clicks from
// 3,798 impressions, against roughly 178 at normal rates. Title length is not
// proven to be the whole cause — AI Overviews and an unknown brand are both
// plausible and neither is measurable from here — but a truncated title is
// wrong regardless of what else is going on, and this is the cheap half.
//
// THE FIX. Set _yoast_wpseo_title explicitly. Two things happen: the title gets
// shorter, and Yoast stops appending the site name, because an explicit title is
// the whole template for that post rather than an input to `title-post`. On Golf
// that alone returns 22 characters per result.
//
// HOW THE SHORT VERSION IS DERIVED, and what it refuses to do. The house
// headline format is "news hook: explainer clause for the trade". The hook is
// the news, it is what the reader typed, and it is usually the right length on
// its own, so where a headline splits cleanly the hook becomes the SEO title.
// Where it does not split, a headline already short enough is used whole.
// Everything else is LEFT ALONE and listed, because truncating a sentence
// mid-thought to hit a character count produces a worse title than the long one
// it replaced. A human or the drafting agent fixes those.
//
// Never touches a post that already carries an SEO title, unless --force.
// Nothing is deleted and the visible headline on the page is untouched.
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
const FORCE = process.argv.includes("--force");
const ALL = process.argv.includes("--all");
const only = arg("site");
const SITES = ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business", "airport-business-magazine"];

if (!only && !ALL) {
  console.error("Usage: --site=<slug> | --all  [--dry] [--force]");
  process.exit(1);
}
const slugs = ALL ? SITES : [only];

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

let set = 0, skipped = 0, left = 0;

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
    execFileSync("ssh", [...base, c], { encoding: "utf8", timeout: 300000, maxBuffer: 60 * 1024 * 1024, input: i });

  const php = `<?php
$dry   = ${DRY ? "true" : "false"};
$force = ${FORCE ? "true" : "false"};

/*
 * Google shows roughly 60 characters. 70 is the working ceiling rather than 60,
 * because a title a few over still beats the same title with " - <Site Name>"
 * bolted on, and refusing those would leave the near misses unfixed.
 *
 * The floor and the word count are the quality guard, and they were raised
 * after a dry run. A colon split can produce a head that is short and generic
 * rather than short and specific: one barbering headline reduced to "Hair Loss
 * Awareness Month" and one to "Best Barbershop Loyalty App", both of which say
 * less than the truncation they were replacing. Thirty characters and four
 * words is where that stopped happening without throwing away good ones.
 */
$CEILING = 70;
$FLOOR   = 30;
$MIN_WORDS = 4;

$posts = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1000 ) );

$set = 0; $had = 0; $left = 0; $examples = array(); $leftovers = array();

foreach ( $posts as $p ) {
	$existing = (string) get_post_meta( $p->ID, '_yoast_wpseo_title', true );
	if ( '' !== trim( $existing ) && ! $force ) { $had++; continue; }

	// Strip the franchise eyebrow span and decode entities, so the length we
	// measure is the length a reader sees rather than the length of the markup.
	$full = trim( html_entity_decode( wp_strip_all_tags( $p->post_title ), ENT_QUOTES, 'UTF-8' ) );
	$candidate = '';

	if ( mb_strlen( $full ) <= $CEILING ) {
		// Already fits. Setting it explicitly still helps, because it stops
		// Yoast appending the site name and pushing it back over.
		$candidate = $full;
	} elseif ( preg_match( '/^(.{' . $FLOOR . ',}?)\\s*[:\\x{2014}\\x{2013}]\\s+\\S/u', $full, $m ) ) {
		$head = trim( $m[1] );
		$words = count( preg_split( '/\\\\s+/u', $head, -1, PREG_SPLIT_NO_EMPTY ) );
		if ( mb_strlen( $head ) >= $FLOOR && mb_strlen( $head ) <= $CEILING && $words >= $MIN_WORDS ) {
			$candidate = $head;
		}
	}

	if ( '' === $candidate ) {
		$left++;
		if ( count( $leftovers ) < 5 ) { $leftovers[] = mb_strlen( $full ) . ' | ' . mb_substr( $full, 0, 82 ); }
		continue;
	}

	if ( count( $examples ) < 4 ) {
		$examples[] = mb_strlen( $full ) . ' -> ' . mb_strlen( $candidate ) . ' | ' . $candidate;
	}
	if ( ! $dry ) { update_post_meta( $p->ID, '_yoast_wpseo_title', $candidate ); }
	$set++;
}

printf( "posts %d | %s %d | already had one %d | left for a human %d\\n",
	count( $posts ), $dry ? 'would set' : 'set', $set, $had, $left );
foreach ( $examples as $e ) { echo "     " . $e . "\\n"; }
if ( $leftovers ) {
	echo "  left alone, too long to shorten safely:\\n";
	foreach ( $leftovers as $e ) { echo "     " . $e . "\\n"; }
}
`;

  sshIn(`cat > /tmp/st.php`, php);
  const out = sshIn(`cd '${docroot}' && wp eval-file /tmp/st.php 2>&1 | tail -16; rm -f /tmp/st.php`).trim();
  console.log(`\n## ${site.name}`);
  console.log("  " + out.split("\n").join("\n  "));
  const m = out.match(/(?:would set|set) (\d+) \| already had one (\d+) \| left for a human (\d+)/);
  if (m) { set += +m[1]; skipped += +m[2]; left += +m[3]; }
}

console.log(`\n${DRY ? "DRY RUN. " : ""}${DRY ? "would set" : "set"} ${set}, already had one ${skipped}, left for a human ${left}`);
await prisma.$disconnect();
