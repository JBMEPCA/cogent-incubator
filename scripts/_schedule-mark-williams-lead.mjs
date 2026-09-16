/**
 * Book Dr Mark Williams OBE (Smart SME post 1333) as the homepage lead from
 * 06:00 UK on Monday 21 September 2026, for four weeks.
 *
 * Uses cogent_pin_from (parent theme, 16 Sep 2026), so the switch happens on
 * the server at that moment with nothing left running on a laptop. The lead
 * goes to the live pin with the latest expiry: Penny Joyner-Platt's runs to
 * 14 October and this runs to 19 October, so Mark takes over on Monday and
 * holds it until his own pin ends.
 *
 * Proves it rather than asserting it: the pinned-lead query is run on the
 * server at a moment before the switch and a moment after, and must return
 * Penny then Mark.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_schedule-mark-williams-lead.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 1333;
const PENNY_ID = 1295;
const PIN_FROM = "2026-09-21 05:00:00"; // GMT, which is 06:00 BST
const PIN_UNTIL = "2026-10-19 05:00:00"; // four weeks on

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 90000, input }).trim();
const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);

if (wp(`post get ${POST_ID} --field=post_status`) !== "publish") throw new Error("post is not published");

wp(`post meta update ${POST_ID} cogent_pin_from '${PIN_FROM}'`);
wp(`post meta update ${POST_ID} cogent_pin_until '${PIN_UNTIL}'`);

// The same query cogent_pinned_lead() runs, with "now" supplied, so the switch
// can be tested before it happens.
const probe = `<?php
function probe_lead( $now ) {
  $p = get_posts( array(
    'numberposts' => 1, 'post_status' => 'publish', 'fields' => 'ids',
    'meta_query' => array( 'relation' => 'AND',
      'pin_until' => array( 'key' => 'cogent_pin_until', 'value' => $now, 'compare' => '>', 'type' => 'DATETIME' ),
      array( 'relation' => 'OR',
        array( 'key' => 'cogent_pin_from', 'compare' => 'NOT EXISTS' ),
        array( 'key' => 'cogent_pin_from', 'value' => $now, 'compare' => '<=', 'type' => 'DATETIME' ) ) ),
    'orderby' => array( 'pin_until' => 'DESC' ), 'suppress_filters' => false ) );
  return $p ? (int) $p[0] : 0;
}
$cases = array( 'now' => current_time( 'mysql', true ), 'sun 20 23:59 UK' => '2026-09-20 22:59:00', 'mon 21 05:59 UK' => '2026-09-21 04:59:00', 'mon 21 06:00 UK' => '2026-09-21 05:00:00', 'mon 21 09:00 UK' => '2026-09-21 08:00:00', '15 oct' => '2026-10-15 12:00:00', '20 oct' => '2026-10-20 12:00:00' );
foreach ( $cases as $label => $now ) echo $label . '=' . probe_lead( $now ) . "\\n";
echo 'live=' . cogent_pinned_lead() . "\\n";
`;
const stamp = Date.now();
ssh(`cat > /tmp/probe-${stamp}.php`, probe);
const out = wp(`eval-file /tmp/probe-${stamp}.php`);
ssh(`rm -f /tmp/probe-${stamp}.php`);
const got = Object.fromEntries(out.split("\n").filter(Boolean).map((l) => l.split("=")));
console.log(got);

const want = {
  now: PENNY_ID, "sun 20 23:59 UK": PENNY_ID, "mon 21 05:59 UK": PENNY_ID,
  "mon 21 06:00 UK": POST_ID, "mon 21 09:00 UK": POST_ID, "15 oct": POST_ID, live: PENNY_ID,
};
const wrong = Object.entries(want).filter(([k, v]) => Number(got[k]) !== v);
if (wrong.length) throw new Error(`lead schedule is wrong: ${JSON.stringify(wrong)}`);
console.log(`\nOK: Penny holds the lead until 06:00 UK on Monday 21 Sep, Mark leads from then until 19 Oct. After that: ${got["20 oct"] || "no pin, recency decides"}.`);
