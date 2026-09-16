/**
 * Switch on the interview series hub on one or more titles (16 Sep 2026).
 *
 * The hub lives in cogent-base (inc/leaders.php). This ships it and turns it
 * on: parent files in dependency order, each PHP file linted on the host
 * before it replaces anything, the child homepage template with the sidebar
 * card, the title's `cogent_leaders` option, and the hub page.
 *
 * Nothing per interview. The theme finds every instalment by the
 * franchise-eyebrow span the drafter puts in its title, reads the card fields
 * from the article, and adds the top menu link itself once there is at least
 * one. A title with no interviews yet (Airport, at rollout) gets a hub page
 * that says the first is on its way, kept out of search, with no menu link and
 * no sidebar card, and lights up by itself when the first one is published.
 *
 * functions.php is only replaced where the live copy differs from ours by
 * nothing but the line that loads the hub. Anything else means somebody has
 * shipped parent work we do not have, and overwriting it would undo theirs.
 *
 * Run:
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/leaders-rollout.mjs fleet-magazine golf-resort-magazine
 *   (no slugs = every title below)
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const PROJ = "C:/Users/CIM Ltd/.claude/Claude Code Projects";
const PARENT = `${PROJ}/cogent-base-theme/cogent-base`;
const REQUIRE_LINE = "require __DIR__ . '/inc/leaders.php';";

// Wording is per title because the audience is. "Nominate a founder" is right
// for Smart SME and wrong for fleet managers, and the franchise names do not
// all scan in the same sentence ("Meet all the In the Chair").
const TITLES = {
  "smart-sme": {
    repo: "smart-sme-website",
    slug: "sme-leaders",
    pageTitle: "SME Leaders",
    seoTitle: "SME Leaders: interviews with UK small business founders",
    seoDesc: "Smart SME's SME Leaders: in-depth interviews with the founders building Britain's best small businesses, in their own words.",
    config: {
      name: "SME Leaders",
      blurb: "The people building Britain's best small businesses, in their own words.",
      menu_label: "SME Leaders",
      all_label: "Meet all the SME Leaders",
      heading: "Every SME Leaders interview",
      nominate_text: "Nominate a founder for SME Leaders, or put yourself forward. There is no charge to be featured.",
    },
  },
  "fleet-magazine": {
    repo: "fleet-magazine-website",
    slug: "fleet-professional",
    pageTitle: "Fleet Professional",
    seoTitle: "Fleet Professional: interviews with UK fleet leaders",
    seoDesc: "Fleet Professional from The Fleet Magazine: in-depth interviews with the people running Britain's vehicle fleets, transport and logistics operations.",
    config: {
      name: "Fleet Professional",
      blurb: "The people running Britain's vehicle fleets, transport and logistics operations, in their own words.",
      menu_label: "Fleet Professional",
      all_label: "Meet every Fleet Professional",
      heading: "Every Fleet Professional interview",
      nominate_text: "Nominate a fleet manager, transport director or logistics leader for Fleet Professional, or put yourself forward. There is no charge to be featured.",
    },
  },
  "golf-resort-magazine": {
    repo: "golf-resort-magazine-website",
    slug: "golf-resort-leaders",
    pageTitle: "Golf Resort Leaders",
    seoTitle: "Golf Resort Leaders: interviews with golf business leaders",
    seoDesc: "Golf Resort Leader from Golf Resort Magazine: in-depth interviews with the people running golf resorts and the businesses that supply them.",
    config: {
      name: "Golf Resort Leader",
      blurb: "The people running golf resorts and the businesses behind them, in their own words.",
      menu_label: "Resort Leaders",
      all_label: "Meet every Golf Resort Leader",
      heading: "Every Golf Resort Leader interview",
      nominate_text: "Nominate a resort owner, general manager or golf business leader for Golf Resort Leader, or put yourself forward. There is no charge to be featured.",
    },
  },
  "barbering-business": {
    repo: "barbering-business-website",
    slug: "in-the-chair",
    pageTitle: "In the Chair",
    seoTitle: "In the Chair: interviews with UK barbers and shop owners",
    seoDesc: "In the Chair from Barbering Business: in-depth interviews with the barbers and barbershop owners building the business behind the chair.",
    config: {
      name: "In the Chair",
      blurb: "Barbers and barbershop owners on the business behind the chair, in their own words.",
      menu_label: "In the Chair",
      all_label: "Read every In the Chair interview",
      heading: "Every In the Chair interview",
      nominate_text: "Nominate a barber or barbershop owner for In the Chair, or put yourself forward. There is no charge to be featured.",
    },
  },
  "airport-business-magazine": {
    repo: "airport-business-magazine-website",
    slug: "airside",
    pageTitle: "Airside",
    seoTitle: "Airside: interviews with airport and aviation leaders",
    seoDesc: "Airside from Airport Business Magazine: in-depth interviews with the people running airports and the businesses that keep them moving.",
    config: {
      // The franchise is "Airside with" in titles ("Airside with Jane Doe"),
      // which does not work as the name of a page, a card or a menu item.
      // Headlines lose the eyebrow span whole, so the two need not match.
      name: "Airside",
      blurb: "The people running airports and the businesses that keep them moving, in their own words.",
      menu_label: "Airside",
      all_label: "Read every Airside interview",
      heading: "Every Airside interview",
      nominate_text: "Nominate an airport leader or aviation supplier for Airside, or put yourself forward. There is no charge to be featured.",
      empty_text: "The first Airside interview is on its way.",
    },
  },
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slugs = wanted.length ? wanted : Object.keys(TITLES);

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

for (const slug of slugs) {
  const t = TITLES[slug];
  if (!t) throw new Error(`unknown title ${slug}`);
  const site = await prisma.site.findUnique({ where: { slug } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const childDir = s.themePath.replace(/\/$/, "");
  const parentDir = `${docroot}/wp-content/themes/cogent-base`;
  const ssh = (cmd, input) =>
    execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
      { encoding: "utf8", timeout: 180000, input, maxBuffer: 64 * 1024 * 1024 }).trim();
  const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
  const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);
  const stamp = Date.now();
  const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, Buffer.from(buf).toString("base64"));
  console.log(`\n===== ${slug}`);

  // 1. Theme files.
  const localFunctions = fs.readFileSync(`${PARENT}/functions.php`, "utf8");
  const liveFunctions = ssh(`cat ${sq(parentDir + "/functions.php")}`);
  const norm = (x) => x.replace(/\r\n/g, "\n").trim();
  const withoutRequire = norm(localFunctions).split("\n").filter((l) => l.trim() !== REQUIRE_LINE).join("\n");
  const functionsOk = norm(liveFunctions) === norm(localFunctions) || norm(liveFunctions) === withoutRequire;
  if (!functionsOk) throw new Error(`${slug}: live functions.php differs from ours by more than the hub require line; not overwriting`);

  const files = [
    { local: `${PARENT}/assets/css/leaders.css`, target: `${parentDir}/assets/css/leaders.css` },
    { local: `${PARENT}/patterns/leaders-mpu.php`, target: `${parentDir}/patterns/leaders-mpu.php` },
    { local: `${PARENT}/inc/leaders.php`, target: `${parentDir}/inc/leaders.php` },
    { local: `${PARENT}/functions.php`, target: `${parentDir}/functions.php` },
    { local: `${PROJ}/${t.repo}/child/templates/home.html`, target: `${childDir}/templates/home.html` },
  ];
  for (const f of files) {
    const tmp = `leaders-${stamp}-${f.target.split("/").pop()}`;
    put(tmp, fs.readFileSync(f.local));
    if (f.target.endsWith(".php")) {
      const lint = ssh(`php -l /tmp/${tmp} 2>&1 || true`);
      if (!/No syntax errors/.test(lint)) throw new Error(`${slug}: lint failed for ${f.target}: ${lint}`);
    }
    ssh(`mkdir -p "$(dirname ${sq(f.target)})" && ( [ -f ${sq(f.target)} ] && cp ${sq(f.target)} ${sq(f.target + ".bak-" + stamp)} || true ) && mv /tmp/${tmp} ${sq(f.target)}`);
  }
  const boot = wp(`eval 'echo function_exists("cogent_leaders_hub_html") ? "loaded" : "NOT LOADED";'`);
  if (boot !== "loaded") throw new Error(`${slug}: hub code not loaded after deploy: ${boot}`);
  console.log("theme files deployed, site boots");

  // 2. The hub page.
  const home = wp(`option get home`).replace(/\/$/, "");
  const url = `${home}/${t.slug}/`;
  put(`hub-${stamp}.html`, `<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
<div class="wp-block-group alignwide"><!-- wp:shortcode -->[cogent_leaders_hub]<!-- /wp:shortcode --></div>
<!-- /wp:group -->`);
  let pageId = wp(`post list --post_type=page --name=${t.slug} --post_status=any --field=ID`);
  if (pageId) {
    wp(`post update ${pageId} /tmp/hub-${stamp}.html --post_title=${sq(t.pageTitle)} --post_status=publish`);
  } else {
    pageId = wp(`post create /tmp/hub-${stamp}.html --post_type=page --post_status=publish --post_title=${sq(t.pageTitle)} --post_name=${t.slug} --porcelain`);
  }
  ssh(`rm -f /tmp/hub-${stamp}.html`);
  wp(`post meta update ${pageId} _yoast_wpseo_title ${sq(t.seoTitle.slice(0, 60))}`);
  wp(`post meta update ${pageId} _yoast_wpseo_metadesc ${sq(t.seoDesc.slice(0, 155))}`);
  console.log(`hub page ${pageId} ${url}`);

  // 3. Switch it on.
  put(`opt-${stamp}.json`, JSON.stringify({ ...t.config, url, nominate_url: `${home}/contact/` }));
  ssh(`cd ${sq(docroot)} && wp option update cogent_leaders --format=json < /tmp/opt-${stamp}.json && rm -f /tmp/opt-${stamp}.json`);

  // 4. Caches, then prove it from the outside.
  ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);
  const report = wp(`eval '$l = cogent_leaders(); echo count($l), " interviews\n"; foreach ($l as $p) { $d = cogent_leader_data($p); echo " - #", $p->ID, " ", $d["headline"], " | name: ", $d["name"], " | ", $d["company"], " | ", $d["line"], " | img: ", (get_post_meta($p->ID, "cogent_leader_portrait", true) ?: get_post_thumbnail_id($p)), "\n"; }'`);
  console.log(report);
  const fetch = (path) => ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`${home}${path}?nc=${stamp}`)}`);
  const hub = fetch(`/${t.slug}/`);
  const front = fetch(`/`);
  console.log({
    hubFeature: hub.includes("leader-feature"),
    hubEmptyState: hub.includes("leaders-hub__empty"),
    hubNoindex: /<meta name=['"]robots['"][^>]*noindex/i.test(hub),
    homeCard: front.includes('class="leaders-mpu"'),
    menuLink: front.includes(`>${t.config.menu_label.replace(/&/g, "&amp;")}</span>`),
    escapedMarkup: /&lt;span class=&quot;franchise-eyebrow|&lt;span class="franchise-eyebrow/.test(hub + front),
    strayParagraph: /leaders-mpu">\s*<p>|<p><a class="leaders-mpu__feature/.test(front),
    leftoverShortcode: /\[cogent_leaders_(hub|mpu)\]/.test(hub + front),
  });
}
await prisma.$disconnect();
