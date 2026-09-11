// Repair Fleet's depot charging cluster: the biggest single thing that title is
// losing in search.
//
//   node scripts/fix-depot-charging.mjs --dry
//   node scripts/fix-depot-charging.mjs
//
// THE MEASUREMENT, 11 September 2026. Six query variants, 305 impressions over
// 28 days, every one of them between position 77 and 97: "depot charge",
// "depot charging", "depot fleet ev charging", "fleet depot charging", "depot
// charging solutions", "ev fleet depot charging". The hub page that should own
// them sits at position 85.5 on 331 impressions.
//
// THE DIAGNOSIS, and it is not a technical one. The page is well built: 2,397
// words, nine H2s, a comparison table, an FAQ, a keyphrase, a meta description
// and a featured image. It ranks 85th because it does not answer the question.
// It targets "depot charging costs" and contains no cost figures at all. Its
// own comparison table has a column headed "Upfront cost" whose three values
// are "High capital cost", "Low or no capital cost" and "Shared or negotiated".
// The opening paragraph explicitly declines to give a number. For a cost query
// that is the whole ranking signal, missing.
//
// So the real fix is a rewrite with sourced figures, and this script does NOT
// invent them. Numbers on a fleet title get held by the gate, correctly, and a
// made-up connection cost is worse than no page. What it does instead:
//
//   1. Links the two depot news pieces into the hub with the target phrase as
//      anchor text. Free, and the cheapest ranking signal the site has.
//   2. Claims the term in the keyword registry so the engine does not write a
//      fourth depot piece and split the cluster further.
//   3. Commissions the rewrite as a ResearchTopic carrying an explicit sourcing
//      brief, naming where each figure can be got from a published source.
//
// Idempotent throughout: links are only added where the anchor is not already
// a link, and the topic and claim are looked up before being created.
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

const DRY = process.argv.includes("--dry");
const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const sftp = creds.sftp;
const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const base = ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
  "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
const sshIn = (c, i = "") =>
  execFileSync("ssh", [...base, c], { encoding: "utf8", timeout: 300000, maxBuffer: 60 * 1024 * 1024, input: i });

/* ---- 1. internal links into the hub ------------------------------------- */

const HUB = "depot-charging-costs-what-it-takes-to-electrify-a-van-fleet";
const FEEDERS = [
  "stagecoach-opens-depot-charging-to-other-fleets-what-it-costs-and-who-else-to-shortlist",
  "humax-and-paua-team-up-on-depot-ev-charging-as-the-zev-mandate-reaches-28-for-2026",
];

const php = `<?php
$dry = ${DRY ? "true" : "false"};
$hub = get_page_by_path( '${HUB}', OBJECT, 'post' );
if ( ! $hub ) { echo "hub post not found\\n"; return; }
$url = get_permalink( $hub );
echo "hub: " . $url . "\\n";

foreach ( array( ${FEEDERS.map((s) => `'${s}'`).join(", ")} ) as $slug ) {
	$p = get_page_by_path( $slug, OBJECT, 'post' );
	if ( ! $p ) { echo "  MISSING " . $slug . "\\n"; continue; }
	$body = $p->post_content;

	if ( strpos( $body, $url ) !== false ) { echo "  already links to the hub: " . $slug . "\\n"; continue; }

	/*
	 * Link the first plain mention of the phrase. The negative lookahead and the
	 * check for a preceding anchor keep it from nesting a link inside a link or
	 * rewriting text that sits in an attribute.
	 */
	$done = false;
	$out = preg_replace_callback(
		'#(?<!href=")(?<!>)\\bdepot charging\\b#i',
		function ( $m ) use ( $url, &$done ) {
			if ( $done ) { return $m[0]; }
			$done = true;
			return '<a href="' . esc_url( $url ) . '">' . $m[0] . '</a>';
		},
		$body,
		1
	);

	if ( ! $done ) { echo "  no plain 'depot charging' to link in " . $slug . "\\n"; continue; }
	if ( $dry ) { echo "  would link: " . $slug . "\\n"; continue; }
	wp_update_post( array( 'ID' => $p->ID, 'post_content' => $out ) );
	echo "  linked: " . $slug . "\\n";
}
`;

sshIn(`cat > /tmp/fd.php`, php);
console.log(sshIn(`cd '${docroot}' && wp eval-file /tmp/fd.php 2>&1 | tail -8; rm -f /tmp/fd.php`).trim());

/* ---- 2. claim the terms so nothing else competes ------------------------ */

const TERMS = [
  "depot charging",
  "depot charging costs",
  "fleet depot charging",
  "depot charging solutions",
  "ev fleet depot charging",
];

// Tenanted models refuse an unscoped read or write, so everything below goes
// through the per-site client.
const db = forSite(site.id);

console.log("\nkeyword registry:");
for (const term of TERMS) {
  const existing = await db.keywordTarget.findFirst({ where: { term } }).catch(() => null);
  if (existing) { console.log(`  already claimed: ${term} (${existing.status})`); continue; }
  if (DRY) { console.log(`  would claim: ${term}`); continue; }
  await db.keywordTarget.create({
    data: {
      siteId: site.id, term, market: "GB", source: "gsc",
      status: "claimed", claimedAt: new Date(),
    },
  });
  console.log(`  claimed: ${term}`);
}

/* ---- 3. commission the rewrite, with the sourcing named ------------------ */

const TOPIC_TITLE = "Depot Charging Costs 2026: rewrite with real figures";
const RATIONALE = `REWRITE, do not start a new article. The existing piece at /${HUB}/
is well structured and ranks 85th because it answers a cost question without any
costs in it. Its comparison table has an "Upfront cost" column whose values are
"High capital cost", "Low or no capital cost" and "Shared or negotiated", and the
opening paragraph declines to give a figure. Six query variants worth 305
impressions a month sit at positions 77 to 97 behind it.

What the rewrite needs, and every figure must come from a named published source
and be linked. Do not estimate, do not average, and do not carry a number over
from a vendor blog that does not show its own working. If a figure cannot be
sourced, say plainly that it is not published rather than reaching for a range:

- Workplace Charging Scheme grant: the per-socket amount and the socket cap, from
  gov.uk, with the current eligibility rules.
- Grid connection: published DNO connection charges. Every distribution network
  operator publishes a connection charging statement, and those are the citable
  numbers for a new or upgraded supply.
- Hardware: published list prices for 7kW, 22kW and DC units from named suppliers
  that publish them. Name the supplier against each price.
- Groundworks and cabling: only where a named operator or supplier has published
  a real project cost. This is the line most often guessed and it must not be.
- Energy: the difference between a depot tariff and public rapid charging, in
  pence per kWh, from published tariffs, and what that is per mile for a van at a
  stated efficiency.

Then lead with the answer. The first two sentences should contain the headline
figure, because that is the entire ranking signal for a cost query and the
current opening gives it away.

Keep the headline inside 60 characters, per the headline length rule.`;

console.log("\ncommission:");
const existingTopic = await db.researchTopic.findFirst({ where: { title: TOPIC_TITLE } });
if (existingTopic) {
  console.log(`  already commissioned (${existingTopic.status})`);
} else if (DRY) {
  console.log(`  would commission: ${TOPIC_TITLE}`);
} else {
  await db.researchTopic.create({
    data: {
      siteId: site.id,
      title: TOPIC_TITLE,
      // The section NAME, not its slug. This field is validated against
      // Site.sections by name, and a slug reads as a hallucinated section.
      category: "Electric & Charging",
      source: "gsc",
      query: "depot charging costs",
      rationale: RATIONALE,
      impressions: 305,
      position: 85.5,
      status: "proposed",
    },
  });
  console.log(`  commissioned: ${TOPIC_TITLE}`);
}

console.log(`\n${DRY ? "DRY RUN, nothing written." : "done"}`);
await prisma.$disconnect();
