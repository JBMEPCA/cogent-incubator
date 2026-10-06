/**
 * Publish Gym post 62 (Gym Champions: Andy Gardner, Fitness Garage) and make
 * it the homepage lead. JB, 28 Sep 2026: "get this online tomorrow at 9am, and
 * email them then". Runs from a scheduled task at 09:00 UK on 29 Sep, followed
 * by _email-fitness-garage-live.mjs.
 *
 * The Gym Champions hub went live with Elite Fitness on 28 Sep, so this only
 * publishes, pins and records. The pin with the later expiry wins, so this
 * takes the lead from Elite Fitness (pinned 28 Sep).
 *
 * Refuses if the post is not a draft, so a second run cannot re-date it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-fitness-garage-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 62;
const PIN_DAYS = 14;

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);
const stamp = Date.now();

const before = wp(`post get ${POST_ID} --field=post_status`);
if (before !== "draft") throw new Error(`post ${POST_ID} is ${before}, not draft; not touching it`);

const gmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const until = gmt(new Date(Date.now() + PIN_DAYS * 86400000));
wp(`post update ${POST_ID} --post_status=publish --post_date_gmt=${sq(gmt(new Date()))}`);
wp(`post meta update ${POST_ID} cogent_pin_until ${sq(until)}`);
const status = wp(`post get ${POST_ID} --field=post_status`);
const url = wp(`post url ${POST_ID}`);
if (status !== "publish" || !/^https:\/\/gymbusinessnews\.com\/.+/.test(url)) throw new Error(`publish check failed: ${status} ${url}`);
console.log(`post ${POST_ID} ${status} ${url}\npinned until ${until} GMT`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: { contains: "fitnessgarage" } } });
const body = wp(`post get ${POST_ID} --field=post_content`);
const data = {
  title: "Gym Champions: Andy Gardner on renting the gym by the hour",
  type: "case_study", status: "published", publishedAt: new Date(), body, wpPostId: POST_ID,
  category: "Start & Grow", keyphrase: "PT space rental", qaPassed: true,
  metaDesc: "Fitness Garage co-founder Andy Gardner on renting PT space by the hour, planning cash flow and what makes a personal trainer's business last.",
  imageCredit: "Pictures: supplied", imageSource: "supplied:fitnessgarage",
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

ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);
const home = wp(`option get home`).replace(/\/$/, "");
const fetch = (u) => ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`${u}${u.includes("?") ? "&" : "?"}nc=${stamp}`)}`);
const art = fetch(url), front = fetch(`${home}/`), hub = fetch(`${home}/gym-champions/`), feed = fetch(`${home}/feed/`);
const leak = /&lt;span class=(&quot;|")franchise-eyebrow|%3Cspan%20class%3D/;
console.log({
  articleHasTitle: art.includes("Andy Gardner"),
  homeLead: wp(`eval ${sq(`$q = new WP_Query(["post_type"=>"post","post_status"=>"publish","posts_per_page"=>1,"meta_key"=>"cogent_pin_until","orderby"=>"meta_value","order"=>"DESC","meta_query"=>[["key"=>"cogent_pin_until","value"=>gmdate("Y-m-d H:i:s"),"compare"=>">","type"=>"DATETIME"]]]); echo $q->posts ? $q->posts[0]->ID : "none";`)}`),
  onHub: hub.includes("Andy Gardner"),
  leak: { article: leak.test(art), home: leak.test(front), hub: leak.test(hub), feed: leak.test(feed) },
});
await prisma.$disconnect();
