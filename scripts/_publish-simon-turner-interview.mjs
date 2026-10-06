/**
 * Publish Fleet post 1129 (Fleet Professional: Simon Turner) and make it the
 * homepage lead. JB, 21 Sep 2026: "get it published and as the featured story".
 *
 * Lead = cogent_pin_until in GMT; the latest live expiry wins. No other Fleet
 * post holds a live pin (Brenda Sunley's ran out 14 Sep), so a two-week pin
 * takes the page at once.
 *
 * Also records the publication on the interview row and an Article row, but
 * leaves notifiedAt null: the email to Simon is a separate scheduled send
 * (_email-simon-turner-live.mjs), which sets it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-simon-turner-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 1129;
const PIN_DAYS = 14;

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const gmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const until = gmt(new Date(Date.now() + PIN_DAYS * 86400000));

wp(`post update ${POST_ID} --post_status=publish --post_date_gmt=${sq(gmt(new Date()))}`);
wp(`post meta update ${POST_ID} cogent_pin_until ${sq(until)}`);
const status = wp(`post get ${POST_ID} --field=post_status`);
const url = wp(`post url ${POST_ID}`);
if (status !== "publish" || !/^https:\/\/thefleetmagazine\.co\.uk\/.+/.test(url)) throw new Error(`publish check failed: ${status} ${url}`);
console.log(`post ${POST_ID} ${status} ${url}\npinned until ${until} GMT`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "drivingforbetterbusiness.com" } });
const body = wp(`post get ${POST_ID} --field=post_content`);
const title = "Fleet Professional: Simon Turner on the road risk nobody owns";
let article = target.articleId ? await db.article.findUnique({ where: { id: target.articleId } }) : null;
const data = {
  title, type: "case_study", status: "published", publishedAt: new Date(), body, wpPostId: POST_ID,
  category: "Case Studies", keyphrase: "work-related road risk", qaPassed: true,
  metaDesc: "Simon Turner of Driving for Better Business on grey fleet, directors' liability and what makes a board act on work-related road risk.",
  imageCredit: "Picture: supplied", imageSource: "supplied:dfbb",
};
article = article
  ? await db.article.update({ where: { id: article.id }, data })
  : await db.article.create({ data: { ...data, siteId: site.id } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedAt: new Date(), publishedUrl: url, articleId: article.id, error: null },
});
console.log(`article ${article.id}; interview row published`);

// Prove the lead: run the same pinned-lead query the homepage uses, on the server.
console.log("lead now:", wp(`eval ${sq(`$q = new WP_Query(["post_type"=>"post","post_status"=>"publish","posts_per_page"=>1,"meta_key"=>"cogent_pin_until","orderby"=>"meta_value","order"=>"DESC","meta_query"=>[["key"=>"cogent_pin_until","value"=>gmdate("Y-m-d H:i:s"),"compare"=>">","type"=>"DATETIME"]]]); echo $q->posts ? $q->posts[0]->ID : "none";`)}`));
await prisma.$disconnect();
