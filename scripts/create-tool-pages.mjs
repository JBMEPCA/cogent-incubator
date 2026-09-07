// Create the /tools/ hub and one page per calculator a title publishes.
//
//   node scripts/create-tool-pages.mjs --all [--dry] [--force]
//   node scripts/create-tool-pages.mjs --site=<slug>
//
// A calculator is a shortcode on an ordinary page, so the framework can render
// it but cannot put it anywhere: something has to create the page. Smart SME's
// were made by hand, which is why the other titles never got any.
//
// The script does not carry a list of which title has which tool. It asks
// WordPress, through the same cogent_tools filter the theme uses, so the pages
// follow the child theme automatically and the two cannot drift apart. Add a
// tool to a child and re-run this; nothing else needs editing.
//
// Over SSH and wp-cli, because SiteGround's WAF 403s any wp-json request
// carrying an Authorization header on all five titles.
//
// Idempotent on slug. Existing pages are left alone unless --force.
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

const SITES = [
  "smart-sme",
  "fleet-magazine",
  "golf-resort-magazine",
  "barbering-business",
  "airport-business-magazine",
];

/*
 * A standfirst per calculator. Everything else on the page — the method note,
 * the sourced figures, the questions, the cross-links — the framework builds
 * from the same data as the arithmetic, so a page body only has to say why the
 * reader should care before the form appears.
 *
 * A tool with no entry here still gets a page, using its registry blurb. That
 * is the safe fallback rather than a blocker: a thin intro is fixable in
 * wp-admin, a missing page is not fixable by the reader.
 */
const INTRO = {
  "whole-life-cost-calculator": [
    "A monthly rental looks cheaper than a purchase price because it is a different kind of number. The only way to settle which is actually cheaper is to put everything either one costs you, over the same term, on the same line.",
    "Set the vehicle, the term and the mileage, choose how you are funding it, and this returns the whole-life cost, the cost per month and the cost per mile. That last one is the figure to quote when somebody asks what a job costs to run.",
  ],
  "grey-fleet-mileage-calculator": [
    "Pay a driver 45p a mile for using their own car and you are compliant, right up until they pass 10,000 business miles in the tax year. After that the approved rate is 25p, and everything above it is pay: taxed, and carrying National Insurance for both of you.",
    "This works out what you can reimburse tax-free, what your current rate is costing in tax if you are over, and how much relief your drivers are leaving unclaimed if you are under.",
  ],
  "operator-licence-checker": [
    "Over 3,500kg you need an operator licence. Which one depends on whether you are carrying your own goods or someone else's, and whether you leave Great Britain. The difference between a restricted and a standard licence is a qualified Transport Manager, which is the part that takes time to solve.",
    "Answer four questions and this returns the licence class and whether you need a Transport Manager. It is a guide to the class, not advice, and it deliberately does not quote financial standing figures because those are re-set every year.",
  ],
  "chair-rent-calculator": [
    "Rent, commission or employed is the argument every shop owner has, usually without the numbers in front of them. The honest answer depends almost entirely on what the chair takes, and it changes as the chair gets busier.",
    "Put in what the chair takes a week and what each arrangement would cost you, and this shows what the shop actually keeps under all three, plus the takings level at which the answer flips.",
  ],
  "vat-threshold-calculator": [
    "Ninety thousand pounds of rolling turnover and you have to register. For a barbershop that is expensive, because a haircut is almost entirely a service: nearly the whole price carries VAT and there is very little to reclaim against it.",
    "This shows how much headroom you have, roughly when you would cross at your current rate, and what crossing would actually cost, including whether the Flat Rate Scheme would help.",
  ],
  "price-rise-calculator": [
    "The question is never whether the price rise adds money if nothing changes. It is how many clients you could lose and still be no worse off, and that is arithmetic rather than a guess.",
    "Going from £20 to £22 means you could lose just over 9% of your clients and stand exactly still. Put your own numbers in and see where the line is for you.",
  ],
  "fit-out-cost-calculator": [
    "A fit-out is a per-chair number plus a building number, and the mistake is budgeting only for the first. Chairs and stations scale with how many positions you fit. The rewire, the plumbing and the floor mostly do not, which is why a three-chair shop can cost nearly as much as an eight-chair one.",
    "The defaults come from our own published bands. Change them the moment you have a real quote.",
  ],
};

if (!only && !ALL) {
  console.error("Usage: --site=<slug> | --all  [--dry] [--force]");
  process.exit(1);
}
const slugs = ALL ? SITES : [only];

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

let created = 0, skipped = 0, failed = 0;

for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) { console.log(`\n## ${slug}: no Site row`); failed++; continue; }

  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { console.log(`\n## ${site.name}: no sftp credential`); failed++; continue; }

  const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const base = ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
    "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
  const sshIn = (cmd, input = "") =>
    execFileSync("ssh", [...base, cmd], { encoding: "utf8", timeout: 180000, maxBuffer: 40 * 1024 * 1024, input });

  console.log(`\n## ${site.name}`);

  const php = `<?php
$intro = json_decode( file_get_contents( '/tmp/cogent-toolintro.json' ), true );
$force = ${FORCE ? "true" : "false"};
$dry   = ${DRY ? "true" : "false"};

if ( ! function_exists( 'cogent_tools_list' ) ) { echo "PARENT THEME TOO OLD, no cogent_tools_list\\n"; return; }

$tools = cogent_tools_list();
if ( ! $tools ) { echo "this title publishes no tools\\n"; return; }

function cogent_page( $slug, $title, $body, $parent, $force, $dry ) {
	$full = $parent ? ( get_post_field( 'post_name', $parent ) . '/' . $slug ) : $slug;
	$existing = get_page_by_path( $full, OBJECT, 'page' );
	if ( $existing && ! $force ) { return array( $existing->ID, 'exists' ); }
	if ( $dry ) { return array( $existing ? $existing->ID : 0, $existing ? 'would update' : 'would create' ); }
	$arr = array(
		'post_type' => 'page', 'post_title' => $title, 'post_name' => $slug,
		'post_status' => 'publish', 'post_content' => $body, 'post_parent' => $parent ? $parent : 0,
	);
	if ( $existing ) { $arr['ID'] = $existing->ID; $id = wp_update_post( $arr, true ); $was = 'updated'; }
	else { $id = wp_insert_post( $arr, true ); $was = 'created'; }
	if ( is_wp_error( $id ) ) { return array( 0, 'FAIL ' . $id->get_error_message() ); }
	return array( $id, $was );
}

$hub_body = '<!-- wp:paragraph --><p>Free calculators from ' . esc_html( get_bloginfo( 'name' ) )
	. '. Every one shows its workings, names the figures it uses and says when they were last checked.</p><!-- /wp:paragraph -->'
	. "\\n" . '<p>[cogent_tools_index]</p>';

list( $hub_id, $hub_was ) = cogent_page( 'tools', 'Tools', $hub_body, 0, $force, $dry );
echo str_pad( 'tools (hub)', 40 ) . $hub_was . "\\n";

foreach ( $tools as $tslug => $tool ) {
	$paras = isset( $intro[ $tslug ] ) ? $intro[ $tslug ] : array( $tool['blurb'] );
	$body = '';
	foreach ( $paras as $i => $para ) {
		$cls = ( 0 === $i ) ? ' class="article-standfirst"' : '';
		$body .= '<!-- wp:paragraph --><p' . $cls . '>' . $para . '</p><!-- /wp:paragraph -->' . "\\n";
	}
	$body .= '<p>[cogent_tool slug="' . $tslug . '"]</p>';
	list( $id, $was ) = cogent_page( $tslug, $tool['title'], $body, $hub_id, $force, $dry );
	echo str_pad( 'tools/' . $tslug, 40 ) . $was . "\\n";
}

if ( ! $dry ) { flush_rewrite_rules( false ); }
`;

  try {
    sshIn(`cat > /tmp/cogent-toolintro.json`, JSON.stringify(INTRO));
    sshIn(`cat > /tmp/cogent-toolpages.php`, php);
    const out = sshIn(`cd '${docroot}' && wp eval-file /tmp/cogent-toolpages.php; rm -f /tmp/cogent-toolpages.php /tmp/cogent-toolintro.json`);
    console.log("   " + out.trim().split("\n").join("\n   "));
    created += (out.match(/created/g) || []).length;
    skipped += (out.match(/exists/g) || []).length;
  } catch (e) {
    console.log("   FAILED " + ((e.stderr || e.stdout || e.message) + "").trim().split("\n")[0]);
    failed++;
  }
}

console.log(`\n${DRY ? "DRY RUN. " : ""}created ${created}, left alone ${skipped}, failed ${failed}`);
await prisma.$disconnect();
