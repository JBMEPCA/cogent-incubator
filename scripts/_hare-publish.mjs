/**
 * Publish the HARE interview, post 1229, and mark the rows. JB, 26 Oct 2026:
 * "push live and email him the live version".
 *
 * Talbot asked twice for a proof before publication. JB decided to publish and
 * invite corrections instead, so the reply (_hare-email-live.mjs) says plainly
 * that anything wrong will be changed straight away.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_hare-publish.mjs [--publish]
 */
import { barberSsh, prisma } from "./_barber-ssh.mjs";

const GO = process.argv.includes("--publish");
const POST_ID = 1229;
const TARGET_ID = "cmvf0vcxa000j13xpp7qws6p0";
const ARTICLE_ID = "cmvo335ip0001ccyfa9w48zar";

const { ssh } = await barberSsh();

console.log(ssh(`wp post get ${POST_ID} --fields=ID,post_status,post_name --format=csv`));
console.log("thumb:", ssh(`wp post meta get ${POST_ID} _thumbnail_id`));
console.log("cats :", ssh(`wp post term list ${POST_ID} category --fields=name --format=csv`).replace(/\n/g, " "));

if (!GO) {
  console.log("\n-- dry run, add --publish --");
  await prisma.$disconnect();
  process.exit(0);
}

ssh(`wp post update ${POST_ID} --post_status=publish`);
// Yoast caches a row per post and would serve the draft's title and og:image.
ssh(`wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${POST_ID}"`);
ssh(`wp cache flush && (wp sg purge || true)`);

const url = ssh(`wp post url ${POST_ID}`);
console.log("\nstatus:", ssh(`wp post get ${POST_ID} --field=post_status`));
console.log("url   :", url);

await prisma.article.update({
  where: { id: ARTICLE_ID },
  data: { status: "published", publishedAt: new Date() },
});
await prisma.interviewTarget.update({
  where: { id: TARGET_ID },
  data: { status: "published", publishedUrl: url, publishedAt: new Date() },
});
console.log("article and interview rows marked published");
await prisma.$disconnect();
