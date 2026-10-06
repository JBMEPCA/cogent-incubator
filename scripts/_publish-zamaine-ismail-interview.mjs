/**
 * Publish Barbering Business post 879 (In the Chair: Zamaine Ismail) and record
 * it on the interview and article rows. JB, 29 Sep 2026: "make published and
 * then email them at 12pm". The email is a separate scheduled send
 * (_email-zamaine-ismail-live.mjs), which sets notifiedAt.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-zamaine-ismail-interview.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const POST_ID = 879;
const TITLE = "In the Chair: Zamaine Ismail on going deeper before wider";
const META = "Zamaine Ismail of West and Hunter on pricing at the luxury end, building an ecosystem around the chair, and why he is going deeper before wider.";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

const gmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
wp(`post update ${POST_ID} --post_status=publish --post_date_gmt=${sq(gmt(new Date()))}`);
const status = wp(`post get ${POST_ID} --field=post_status`);
const url = wp(`post url ${POST_ID}`);
if (status !== "publish" || !/^https:\/\/barberingbusiness\.com\/.+/.test(url)) throw new Error(`publish check failed: ${status} ${url}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' '${url}'`);
console.log(`post ${POST_ID} ${status} ${url} (HTTP ${code} from the server)`);

const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "westandhunter.com" } });
const body = wp(`post get ${POST_ID} --field=post_content`);
const data = {
  title: TITLE, type: "case_study", status: "published", publishedAt: new Date(), body, wpPostId: POST_ID,
  category: "Business & Money", keyphrase: "barbershop membership", metaDesc: META, qaPassed: true,
  imageCredit: "Picture: West and Hunter", imageSource: "supplied:westandhunter",
};
const article = target.articleId
  ? await db.article.update({ where: { id: target.articleId }, data })
  : await db.article.create({ data: { ...data, siteId: site.id } });
await db.interviewTarget.update({
  where: { id: target.id },
  data: { status: "published", publishedAt: new Date(), publishedUrl: url, articleId: article.id, error: null },
});
console.log(`article ${article.id}; interview row published`);
await prisma.$disconnect();
