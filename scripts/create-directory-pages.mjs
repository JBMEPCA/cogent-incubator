// Create the hub and index pages that carry the directory shortcodes.
//
//   node scripts/create-directory-pages.mjs --all [--dry] [--force]
//   node scripts/create-directory-pages.mjs --site=<slug>
//
// The index is an ordinary WordPress page, exactly like a tool page, so the
// body copy around the table stays editable in wp-admin and the URL is a real
// page rather than a taxonomy archive. Each collection page is a CHILD of a
// page at /directory/, which is what makes /directory/<collection>/ resolve
// natively; the rewrite rule in the parent theme is belt and braces for the
// case where somebody deletes the hub.
//
// Over SSH and wp-cli, not the REST API: SiteGround's WAF 403s any wp-json
// request carrying an Authorization header on all five titles.
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

const p = (s) => `<p class="wp-block-paragraph">${s}</p>`;
const h2 = (s) => `<h2 class="wp-block-heading">${s}</h2>`;

/*
 * The hub blurb is the same promise on every title, because it is the same
 * promise: these are structured, dated, sourced tables rather than articles.
 */
const hubBody = (name) =>
  [
    p(
      `Reference tables from ${name}, built out of our own reporting. Every row links back to the piece it came from, carries the date it was last checked, and leaves a cell blank rather than guessing at a number nobody published.`
    ),
    "<p>[cogent_directories_index]</p>",
  ].join("\n");

const TITLES = {
  "airport-business-magazine": {
    name: "Airport Business Magazine",
    email: "jb@airportbusinessmagazine.com",
    pages: [
      {
        slug: "airport-suppliers",
        title: "Airport supplier directory",
        body: [
          p(
            "Who supplies what to airports, by operational area. Baggage handling, screening, biometrics, common-use passenger processing, ground support, de-icing, parking, operations software, retail and food concessions, and the architects, engineers and contractors delivering capital programmes."
          ),
          p(
            "This exists because there is nowhere free and operator-facing to do the first hour of a procurement shortlist. The data that comes closest is sold by the report, and the trade titles that could publish it run directory listings as paid placements instead."
          ),
          "<p>[cogent_directory collection=\"airport-suppliers\"]</p>",
          h2("How this was built"),
          p(
            "Every entry is drawn from a comparison or news article this title published and an editor passed, and each supplier page links back to it. Nothing has been added from elsewhere, and nothing has been estimated."
          ),
          p(
            "That is why the cost column is mostly empty. Very few suppliers publish a price, and the industry planning ranges that do circulate, cost per gate for biometrics or per square metre for a terminal, belong to the category rather than to a named company. Attaching one to a supplier would be inventing a quote. Where an airport or a contractor has published a contract value we carry it as published, and where a party has explicitly declined to disclose one the entry says so."
          ),
          h2("Two categories are empty, on purpose"),
          p(
            "Airfield lighting and air traffic systems carry no entries yet, because no article on this site names a supplier in either. They will fill as we cover them. An empty category is more honest than a padded one."
          ),
          h2("Tell us what we have wrong"),
          p(
            `If your company is listed and something is out of date, or you are missing from a category you belong in, write to <a href="mailto:jb@airportbusinessmagazine.com">jb@airportbusinessmagazine.com</a>. Corrections are free and always will be. So is inclusion.`
          ),
        ].join("\n"),
      },
    ],
  },

  "golf-resort-magazine": {
    name: "Golf Resort Magazine",
    email: "jb@golfresortmagazine.com",
    pages: [
      {
        slug: "course-projects",
        title: "Course project tracker",
        body: [
          p(
            "Every named course build, renovation, expansion, reopening and transaction this title has reported, with the spend, the architect, the contractor and the current status where they have been published."
          ),
          p(
            "A golf project is news once and a reference for years. An owner deciding whether to reinvest, a supplier chasing a renovation and a tour operator planning an itinerary all want the same table, and until now it did not exist anywhere. The nearest equivalent in the sector is a development round-up compiled by hand, twice a year."
          ),
          "<p>[cogent_directory collection=\"course-projects\"]</p>",
          h2("How this is maintained"),
          p(
            "Each project is a permanent entry rather than a story that scrolls away. When we report a new development on a course already listed, the row is updated and the date it was last checked moves with it, so the table gets better every week rather than staler."
          ),
          h2("About the money column"),
          p(
            "Figures are reproduced in the currency they were published in and are never converted. This is a global title, and a converted number is a number nobody actually announced. Where an owner or a council has explicitly declined to give a figure the entry says so, because that is itself worth knowing. A blank means no figure has been published at all."
          ),
          h2("Something missing?"),
          p(
            `If your course has a project we have not covered, tell us at <a href="mailto:jb@golfresortmagazine.com">jb@golfresortmagazine.com</a> and we will look at it. We cover the sector worldwide, not only in Britain.`
          ),
        ].join("\n"),
      },
    ],
  },

  "fleet-magazine": {
    name: "The Fleet Magazine",
    email: "jb@thefleetmagazine.co.uk",
    pages: [
      {
        slug: "vehicle-lessors",
        title: "Vehicle lessor directory",
        body: [
          p(
            "Who leases vehicles to UK fleets, what they cover, and what comes bundled. Heavy goods vehicles, vans and light commercial vehicles, and company cars, across contract hire, finance and operating lease, flexible rental and the manufacturer captives."
          ),
          "<p>[cogent_directory collection=\"vehicle-lessors\"]</p>",
          h2("How this was built"),
          p(
            "Every entry comes from a comparison or news article this title published, and each lessor page links back to it. Twelve of our own articles fed the table, not just the two buyer guides."
          ),
          h2("Why there is no fleet size column"),
          p(
            "It is the obvious column to want, and we cannot fill it honestly. Not one of our published articles states a lessor's own vehicle count, and neither do most of the companies. Every fleet figure in our archive belongs to a customer, a charging network or a software vendor. A column that would be blank on every row reads as missing data rather than as a number the trade does not publish, so it is not here."
          ),
          h2("A note on the entries"),
          p(
            "A handful of names in the table are marketplaces, car clubs or salary sacrifice scheme providers rather than lessors that own the metal. They are included because our own coverage groups them with the funders a fleet manager is choosing between, and each entry says what it actually is."
          ),
          h2("Corrections"),
          p(
            `If your company is listed and something is wrong, or you fund UK fleets and are missing, write to <a href="mailto:jb@thefleetmagazine.co.uk">jb@thefleetmagazine.co.uk</a>.`
          ),
        ].join("\n"),
      },
    ],
  },

  "barbering-business": {
    name: "Barbering Business",
    email: "jb@barberingbusiness.com",
    pages: [
      {
        slug: "kit-and-suppliers",
        title: "Kit and supplier index",
        body: [
          p(
            "The kit, software and services a shop actually buys, in one place, with the prices from our own guides. Chairs and furniture, clippers and tools, styling product, booking systems, card machines, insurance and training."
          ),
          "<p>[cogent_directory collection=\"kit-and-suppliers\"]</p>",
          h2("Where the prices come from"),
          p(
            "Every price is reproduced exactly as we published it, and never averaged or rounded into a tidier range. You are going to hold these against a real quote, and a smoothed number would let you down quietly. Where no price has been published the cell is blank rather than filled with a guess."
          ),
          h2("What is not here yet"),
          p(
            "Mirrors, stations, basins, lighting and flooring have no named suppliers in this index, because our fit-out coverage so far talks in cost bands rather than brands. That is a gap in our reporting rather than a gap in the market, and we are filling it. If you supply any of those and want to be considered, get in touch."
          ),
          h2("Corrections and inclusion"),
          p(
            `Something wrong, or something missing? Write to <a href="mailto:jb@barberingbusiness.com">jb@barberingbusiness.com</a>. Being listed is free and always will be.`
          ),
        ].join("\n"),
      },
    ],
  },
};

if (!only && !ALL) {
  console.error("Usage: --site=<slug> | --all  [--dry] [--force]");
  process.exit(1);
}
const slugs = ALL ? Object.keys(TITLES) : [only];

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

let created = 0, skipped = 0, failed = 0;

for (const slug of slugs) {
  const t = TITLES[slug];
  if (!t) { console.error(`Unknown title ${slug}`); process.exit(1); }

  const site = await prisma.site.findUnique({ where: { slug } });
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

  const spec = {
    hub: { slug: "directory", title: "Directories", body: hubBody(site.name) },
    pages: t.pages,
    force: FORCE,
  };

  if (DRY) {
    console.log(`   directory (hub)      would ensure    ${spec.hub.body.length} chars`);
    t.pages.forEach((pg) => console.log(`   directory/${pg.slug.padEnd(20)} would ensure    ${pg.body.length} chars`));
    continue;
  }

  const php = `<?php
$spec = json_decode( file_get_contents( '/tmp/cogent-dirpages.json' ), true );
$force = ! empty( $spec['force'] );

function cogent_ensure_page( $slug, $title, $body, $parent, $force ) {
	$existing = get_page_by_path( $parent ? ( get_post_field( 'post_name', $parent ) . '/' . $slug ) : $slug, OBJECT, 'page' );
	if ( $existing && ! $force ) { return array( $existing->ID, 'exists' ); }
	$arr = array(
		'post_type'   => 'page',
		'post_title'  => $title,
		'post_name'   => $slug,
		'post_status' => 'publish',
		'post_content'=> $body,
		'post_parent' => $parent ? $parent : 0,
	);
	if ( $existing ) { $arr['ID'] = $existing->ID; $id = wp_update_post( $arr, true ); $was = 'updated'; }
	else { $id = wp_insert_post( $arr, true ); $was = 'created'; }
	if ( is_wp_error( $id ) ) { return array( 0, 'FAIL ' . $id->get_error_message() ); }
	return array( $id, $was );
}

list( $hub_id, $hub_was ) = cogent_ensure_page( $spec['hub']['slug'], $spec['hub']['title'], $spec['hub']['body'], 0, $force );
echo str_pad( 'directory (hub)', 24 ) . $hub_was . "\\n";

foreach ( $spec['pages'] as $pg ) {
	list( $id, $was ) = cogent_ensure_page( $pg['slug'], $pg['title'], $pg['body'], $hub_id, $force );
	echo str_pad( 'directory/' . $pg['slug'], 24 ) . $was . ( $id ? '  ' . get_permalink( $id ) : '' ) . "\\n";
}

flush_rewrite_rules( false );
`;

  try {
    sshIn(`cat > /tmp/cogent-dirpages.json`, JSON.stringify(spec));
    sshIn(`cat > /tmp/cogent-dirpages.php`, php);
    const out = sshIn(`cd '${docroot}' && wp eval-file /tmp/cogent-dirpages.php; rm -f /tmp/cogent-dirpages.php /tmp/cogent-dirpages.json`);
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
