/**
 * Publish Gym post 55 (Gym Champions: Stefan White and Kevin Furlong), make
 * it the homepage lead, and switch on the Gym Champions hub. JB, 28 Sep 2026:
 * "looks good, publish, then send back to him at 3:30".
 *
 * The hub code and the homepage card were already live on Gym (parent 1.27.0,
 * home.html has the card), so this does NOT redeploy theme files the way
 * leaders-rollout.mjs does. It only adds what was missing: the hub page, the
 * cogent_leaders option and the franchise emoji setting.
 *
 * Records the publication on the interview row and an Article row, and leaves
 * notifiedAt null: the email to Stefan is the scheduled
 * _email-elite-fitness-live.mjs, which sets it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-elite-fitness-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 55;
const PIN_DAYS = 14;
const HUB = {
  slug: "gym-champions",
  pageTitle: "Gym Champions",
  seoTitle: "Gym Champions: interviews with gym owners and operators",
  seoDesc: "Gym Champions from Gym Business News: in-depth interviews with the people running gyms and fitness businesses, in their own words.",
  config: {
    name: "Gym Champions",
    blurb: "The people running gyms and fitness businesses, in their own words.",
    menu_label: "Gym Champions",
    all_label: "Meet every Gym Champion",
    heading: "Every Gym Champions interview",
    nominate_text: "Nominate a gym owner, manager or fitness operator for Gym Champions, or put yourself forward. There is no charge to be featured.",
  },
};

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);
const put = (name, str) => ssh(`base64 -d > /tmp/${name}`, Buffer.from(str).toString("base64"));
const stamp = Date.now();
const db = forSite(site.id);

// 1. Hub page and option.
const home = wp(`option get home`).replace(/\/$/, "");
const hubUrl = `${home}/${HUB.slug}/`;
put(`hub-${stamp}.html`, `<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
<div class="wp-block-group alignwide"><!-- wp:shortcode -->[cogent_leaders_hub]<!-- /wp:shortcode --></div>
<!-- /wp:group -->`);
let pageId = wp(`post list --post_type=page --name=${HUB.slug} --post_status=any --field=ID`);
if (pageId) wp(`post update ${pageId} /tmp/hub-${stamp}.html --post_title=${sq(HUB.pageTitle)} --post_status=publish`);
else pageId = wp(`post create /tmp/hub-${stamp}.html --post_type=page --post_status=publish --post_title=${sq(HUB.pageTitle)} --post_name=${HUB.slug} --porcelain`);
ssh(`rm -f /tmp/hub-${stamp}.html`);
wp(`post meta update ${pageId} _yoast_wpseo_title ${sq(HUB.seoTitle)}`);
wp(`post meta update ${pageId} _yoast_wpseo_metadesc ${sq(HUB.seoDesc)}`);
put(`opt-${stamp}.json`, JSON.stringify({ ...HUB.config, url: hubUrl, nominate_url: `${home}/contact/` }));
ssh(`cd ${sq(docroot)} && wp option update cogent_leaders --format=json < /tmp/opt-${stamp}.json && rm -f /tmp/opt-${stamp}.json`);
console.log(`hub page ${pageId} ${hubUrl}`);

await db.engineSetting.upsert({
  where: { siteId_key: { siteId: site.id, key: "interview_franchise_emoji" } },
  create: { siteId: site.id, key: "interview_franchise_emoji", value: "🏋️" },
  update: { value: "🏋️" },
});

// 2. Publish and pin.
const gmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const until = gmt(new Date(Date.now() + PIN_DAYS * 86400000));
wp(`post update ${POST_ID} --post_status=publish --post_date_gmt=${sq(gmt(new Date()))}`);
wp(`post meta update ${POST_ID} cogent_pin_until ${sq(until)}`);
const status = wp(`post get ${POST_ID} --field=post_status`);
const url = wp(`post url ${POST_ID}`);
if (status !== "publish" || !/^https:\/\/gymbusinessnews\.com\/.+/.test(url)) throw new Error(`publish check failed: ${status} ${url}`);
console.log(`post ${POST_ID} ${status} ${url}\npinned until ${until} GMT`);

// 3. Records.
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "elitefitness.im" } });
const body = wp(`post get ${POST_ID} --field=post_content`);
const data = {
  title: "Gym Champions: Stefan White and Kevin Furlong on the big move",
  type: "case_study", status: "published", publishedAt: new Date(), body, wpPostId: POST_ID,
  category: "Start & Grow", keyphrase: "independent gym", qaPassed: true,
  metaDesc: "Elite Fitness owners Stefan White and Kevin Furlong on moving an independent gym into 13,000 sq ft, dropping classes and adding a cafe.",
  imageCredit: "Picture: supplied", imageSource: "supplied:elitefitness",
};
let article = target.articleId ? await db.article.findUnique({ where: { id: target.articleId } }) : null;
article = article
  ? await db.article.update({ where: { id: article.id }, data })
  : await db.article.create({ data: { ...data, siteId: site.id } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedAt: new Date(), publishedUrl: url, articleId: article.id, error: null },
});
console.log(`article ${article.id}; interview row published`);

// 4. Caches, then prove it from the server.
ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);
const fetch = (u) => ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`${u}${u.includes("?") ? "&" : "?"}nc=${stamp}`)}`);
const art = fetch(url), front = fetch(`${home}/`), hub = fetch(hubUrl), feed = fetch(`${home}/feed/`);
const leak = /&lt;span class=(&quot;|")franchise-eyebrow|%3Cspan%20class%3D/;
console.log({
  articleHasTitle: art.includes("Stefan White and Kevin Furlong"),
  homeLead: wp(`eval ${sq(`$q = new WP_Query(["post_type"=>"post","post_status"=>"publish","posts_per_page"=>1,"meta_key"=>"cogent_pin_until","orderby"=>"meta_value","order"=>"DESC","meta_query"=>[["key"=>"cogent_pin_until","value"=>gmdate("Y-m-d H:i:s"),"compare"=>">","type"=>"DATETIME"]]]); echo $q->posts ? $q->posts[0]->ID : "none";`)}`),
  homeCard: front.includes('class="leaders-mpu"'),
  menuLink: front.includes(">Gym Champions</span>"),
  hubFeature: hub.includes("leader-feature"),
  leak: { article: leak.test(art), home: leak.test(front), hub: leak.test(hub), feed: leak.test(feed) },
});
await prisma.$disconnect();
