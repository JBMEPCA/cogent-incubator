/**
 * Put the right photograph on the Gillian Leng story.
 *
 * Post 232 on Dental Business News published at 09:31 on 6 Oct 2026 from a
 * press release that arrived at press@ WITH a photograph of her attached. The
 * picture desk ignored the attachment and used an Openverse stock image of an
 * army officer instead, under the alt text "Professor Gillian Leng CBE, new
 * President of Medical Protection Society".
 *
 * So a photograph of a different, real, identifiable person was published
 * captioned as her. That is the second time in two days a real person has been
 * misrepresented by something that ran without anyone looking at it.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_fix-gillian-leng-photo.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const POST_ID = 232;
const ARTICLE_ID = "cmuwf5nfl000513iio54ty8tj";
const PHOTO =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/ab747c79-736f-42fc-8062-1a21d89ca420/images/18.jpg";

const ALT = "Professor Gillian Leng CBE, President of the Medical Protection Society";
const CAPTION = "Professor Gillian Leng CBE, President of the Medical Protection Society. Picture: supplied";
const CREDIT = "Picture: supplied";

if (!fs.existsSync(PHOTO)) {
  console.error(`No photograph at ${PHOTO}`);
  process.exit(1);
}
console.log(`photograph: ${fs.statSync(PHOTO).size} bytes`);
if (!APPLY) {
  console.log("DRY RUN, nothing written. add --apply");
  process.exit(0);
}

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd, input) =>
  execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

console.log(`old featured image id: ${wp(`post meta get ${POST_ID} _thumbnail_id`)}`);

const stamp = Date.now();
ssh(`base64 -d > /tmp/gillian-${stamp}.jpg`, fs.readFileSync(PHOTO).toString("base64"));
const mediaId = Number(
  wp(
    `media import /tmp/gillian-${stamp}.jpg --post_id=${POST_ID} --title=${sq("Professor Gillian Leng CBE")} ` +
      `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
  )
);
ssh(`rm -f /tmp/gillian-${stamp}.jpg`);
const mediaUrl = wp(`post get ${mediaId} --field=guid`);
console.log(`new featured image id: ${mediaId}`);

// The title goes with it so Yoast rebuilds the indexable; without that the
// share card keeps serving the old picture. Same trap as the Dental hero swap.
const title = wp(`post get ${POST_ID} --field=post_title`);
ssh(`base64 -d > /tmp/gillian-title-${stamp}.txt`, Buffer.from(title, "utf8").toString("base64"));
wp(`post update ${POST_ID} --post_title=${sq(title)}`);
ssh(`rm -f /tmp/gillian-title-${stamp}.txt`);

ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`);

await forSite(site.id).article.update({
  where: { id: ARTICLE_ID },
  data: { imageUrl: mediaUrl, imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:supplied" },
});

console.log(`thumb now: ${wp(`post meta get ${POST_ID} _thumbnail_id`)}`);
console.log(`url      : ${wp(`post url ${POST_ID}`)}`);
await prisma.$disconnect();
