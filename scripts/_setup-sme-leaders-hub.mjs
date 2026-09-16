/**
 * Switch on the SME Leaders hub on Smart SME, for JB's approval before the
 * other four titles (16 Sep 2026).
 *
 * The theme code (cogent-base inc/leaders.php) is inert until the
 * `cogent_leaders` option exists. This sets it, marks the three published
 * profiles, creates the hub page and adds it to the top menu.
 *
 * Pull quotes are the subject's own sentences, as they appear in the published
 * article. Portraits are chosen per profile: Martyn Barklett-Judge's only photo
 * is a group shot with the King and another guest, so its crop is aimed at him
 * (right of frame, identified by his name badge), so the crop is pushed to the
 * right edge. At 74% the other guest in the green tie sat nearer the centre.
 *
 * Idempotent: re-running updates the same option, meta, page and menu item.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_setup-sme-leaders-hub.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const SITE = "https://smartsme.co.uk";
const HUB_SLUG = "sme-leaders";
const CONFIG = {
  name: "SME Leaders",
  blurb: "The people building Britain's best small businesses, in their own words.",
  url: `${SITE}/${HUB_SLUG}/`,
  nominate_url: `${SITE}/contact/`,
};

const PROFILES = [
  {
    id: 951, no: 1, name: "Martyn Barklett-Judge", company: "Pet Remedy", line: "Pet wellbeing · Devon",
    quote: "Vets are only impressed by evidence based treatments and products.",
    portrait: 950, focus: "100% 30%",
  },
  {
    id: 1295, no: 2, name: "Penny Joyner-Platt", company: "The Plattform", line: "PR and marketing · Hertfordshire",
    quote: "That's not the story, but let's find the story.",
    portrait: 1322, focus: "50% 22%",
  },
  {
    id: 1333, no: 3, name: "Dr Mark Williams OBE", company: "LIMB-art", line: "Prosthetics · Conwy, North Wales",
    quote: "Why are we hiding them? Why not make something people actually want to show off?",
    portrait: 1332, focus: "50% 18%",
  },
];

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
    { encoding: "utf8", timeout: 120000, input, maxBuffer: 64 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);
const stamp = Date.now();
const putFile = (name, text) => ssh(`base64 -d > /tmp/${name}`, Buffer.from(text, "utf8").toString("base64"));

// 1. Profiles. Every one must be published and have its portrait on disk.
for (const p of PROFILES) {
  if (wp(`post get ${p.id} --field=post_status`) !== "publish") throw new Error(`post ${p.id} is not published`);
  if (wp(`post get ${p.portrait} --field=post_type`) !== "attachment") throw new Error(`portrait ${p.portrait} is not an attachment`);
  wp(`post meta update ${p.id} cogent_leader_no ${p.no}`);
  wp(`post meta update ${p.id} cogent_leader_name ${sq(p.name)}`);
  wp(`post meta update ${p.id} cogent_leader_company ${sq(p.company)}`);
  wp(`post meta update ${p.id} cogent_leader_line ${sq(p.line)}`);
  wp(`post meta update ${p.id} cogent_leader_quote ${sq(p.quote)}`);
  wp(`post meta update ${p.id} cogent_leader_portrait ${p.portrait}`);
  wp(`post meta update ${p.id} cogent_leader_focus ${sq(p.focus)}`);
  console.log(`profile ${p.no}: ${p.name}`);
}

// 2. The hub page. The shortcode sits in a wide group so the grid gets the
// 1200px wide size rather than the 700px reading column.
const pageContent = `<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
<div class="wp-block-group alignwide"><!-- wp:shortcode -->[cogent_leaders_hub]<!-- /wp:shortcode --></div>
<!-- /wp:group -->`;
putFile(`hub-${stamp}.html`, pageContent);
let pageId = wp(`post list --post_type=page --name=${HUB_SLUG} --post_status=any --field=ID`);
if (pageId) {
  wp(`post update ${pageId} /tmp/hub-${stamp}.html --post_title=${sq(CONFIG.name)} --post_status=publish`);
} else {
  pageId = wp(`post create /tmp/hub-${stamp}.html --post_type=page --post_status=publish --post_title=${sq(CONFIG.name)} --post_name=${HUB_SLUG} --porcelain`);
}
wp(`post meta update ${pageId} _yoast_wpseo_title ${sq(`${CONFIG.name}: interviews with the founders of Britain's best small businesses`.slice(0, 60))}`);
wp(`post meta update ${pageId} _yoast_wpseo_metadesc ${sq("Smart SME's SME Leaders: in-depth interviews with the founders building Britain's best small businesses, in their own words.")}`);
ssh(`rm -f /tmp/hub-${stamp}.html`);
console.log(`hub page ${pageId}`);

// 3. Switch the hub on. Everything above is invisible until this is set.
putFile(`opt-${stamp}.json`, JSON.stringify(CONFIG));
ssh(`cd ${sq(docroot)} && wp option update cogent_leaders --format=json < /tmp/opt-${stamp}.json && rm -f /tmp/opt-${stamp}.json`);
console.log("option set:", wp(`option get cogent_leaders --format=json`));

// 4. Top menu: first item, since the series is the site's flagship people
// content. Replaces an existing SME Leaders link rather than adding a second.
const navId = wp(`post list --post_type=wp_navigation --post_status=publish --orderby=date --order=DESC --posts_per_page=1 --field=ID`);
const nav = wp(`post get ${navId} --field=post_content`);
const link = `<!-- wp:navigation-link {"label":"${CONFIG.name}","url":"${CONFIG.url}","kind":"custom"} /-->`;
const withoutOld = nav.replace(/<!-- wp:navigation-link \{"label":"SME Leaders"[^}]*\} \/-->/g, "");
const newNav = link + withoutOld;
if (newNav !== nav) {
  putFile(`nav-${stamp}.html`, newNav);
  wp(`post update ${navId} /tmp/nav-${stamp}.html`);
  ssh(`rm -f /tmp/nav-${stamp}.html`);
}
console.log(`menu ${navId}: ${(wp(`post get ${navId} --field=post_content`).match(/"label":"[^"]+"/g) || []).join(" | ")}`);

// 5. Caches.
ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true) && wp cache flush >/dev/null 2>&1; true`);
console.log("caches purged");
