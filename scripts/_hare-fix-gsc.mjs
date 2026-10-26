/**
 * Correction, 26 Oct 2026: HARE does not use the Green Salon Collective.
 *
 * Talbot flagged it minutes after publication. The claim was OURS, not his: the
 * Green Salon Collective came from the outreach research and went out in the
 * question we sent him ("You recycle your clients' hair through the Green Salon
 * Collective"). His answer never names them, it only describes seeing hair go
 * into commercial waste and building KeraCycle. So one line of our own prose,
 * plus its outbound link, comes out. No quote changes.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_hare-fix-gsc.mjs [--apply]
 */
import { barberSsh, prisma } from "./_barber-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 1229;
const ARTICLE_ID = "cmvo335ip0001ccyfa9w48zar";

const OLD =
  '<p>HARE recycles client hair through the <a href="https://greensaloncollective.co.uk/">Green Salon Collective</a>, which started with a simple observation about the bin.</p>';
const NEW =
  "<p>What happens to the hair on the floor is not a question most shops ask. HARE started asking it.</p>";

const { ssh, put } = await barberSsh();
const body = ssh(`wp post get ${POST_ID} --field=post_content`);

if (!body.includes(OLD)) throw new Error("the line to replace is not in the live body");
const fixed = body.replace(OLD, NEW);
if (/green ?salon/i.test(fixed)) throw new Error("a Green Salon reference survives the replacement");
if (/[—–]/.test(NEW)) throw new Error("dash");

console.log("removing:\n ", OLD);
console.log("replacing with:\n ", NEW);

if (!APPLY) {
  console.log("\n-- dry run, add --apply --");
  await prisma.$disconnect();
  process.exit(0);
}

// The body is ~8.5KB, so its base64 does not fit on a command line. Pipe it
// through stdin with put() instead of embedding it in the command.
const tmp = `/tmp/hare-fix-${Date.now()}.html`;
put(Buffer.from(fixed, "utf8"), tmp);
ssh(`wp post update ${POST_ID} ${tmp} && rm -f ${tmp}`);
ssh(`wp cache flush && (wp sg purge || true)`);

const live = ssh(`wp post get ${POST_ID} --field=post_content`);
console.log("\nGreen Salon references left on the post:", (live.match(/green ?salon/gi) || []).length);

await prisma.article.update({ where: { id: ARTICLE_ID }, data: { body: fixed } });
console.log("article row body updated");
await prisma.$disconnect();
