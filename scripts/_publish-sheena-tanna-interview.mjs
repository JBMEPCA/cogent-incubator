/**
 * Reframe the lead picture, publish the Sheena Tanna interview, and send her
 * the link. JB, 16 Oct 2026: "can we get more of her head in the image? Then
 * publish and send to her".
 *
 * THE PICTURE. templates/single.html sets the lead image to aspectRatio 16/9
 * with object-fit cover, so WordPress hard-crops the middle out of whatever it
 * is given. Her photograph is a 612x918 portrait, so the centre band started at
 * her forehead and the top of her head was gone. The fix is to hand the theme a
 * 16:9 frame that is already composed: 612x344 taken from y=130, which leaves
 * about 55px above her hair and brings her shoulders into the bottom edge,
 * then upscaled to 1200x675 with lanczos and a light sharpen so the lead is not
 * relying on the browser to enlarge a 612px file across a wide column.
 *
 * It is still an upscale of a small source. Her original is worth asking for,
 * and the email does.
 *
 * Media 303, the uncropped version uploaded yesterday, is removed once the new
 * one is in place. It is ours, from yesterday, and nothing else points at it.
 *
 * PUBLISHED BY HAND, not through the app's publish path, so nothing fans out to
 * LinkedIn or Instagram by itself.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-sheena-tanna-interview.mjs [--apply] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const SEND = process.argv.includes("--send");

const POST_ID = 302;
const OLD_MEDIA = 303;
const ARTICLE_ID = "cmv9a1qzl9e33a3eb086505d9";
const TARGET_ID = "cmv5149du001310pg0ra0bcf2";
const SLUG = "behind-the-mask-sheena-tanna-billericay-dental-care";

const HERO =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/billericay/sheena-tanna-hero.jpg";
const ALT = "Dr Sheena A Tanna, principal dentist at Billericay Dental Care";
const CAPTION = "Dr Sheena A Tanna, principal dentist at Billericay Dental Care in Essex. Picture: supplied";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { sendGmail, inboundMatching } = await import("../lib/gmail.js");
const { buildBacklinkAsk, htmlise } = await import("../lib/interviews.js");
const { stripEmDashes } = await import("../lib/drafting.js");
const { siteUrl } = await import("../lib/voice.js");

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const outreach = creds.outreach;
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd, input) =>
  execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

// ---- check the server copy before touching anything live -----------------
const body = Buffer.from(ssh(`cd ${sq(docroot)} && wp post get ${POST_ID} --field=post_content | base64 -w0`), "base64").toString("utf8");
const status = wp(`post get ${POST_ID} --field=post_status`);
const slug = wp(`post get ${POST_ID} --field=post_name`);
const quotes = (body.match(/<blockquote/g) || []).length;

const problems = [];
const expected = APPLY ? "draft" : "publish";
if (status !== expected) problems.push(`post is ${status}, expected ${expected}`);
if (slug !== SLUG) problems.push(`slug is ${slug}`);
if (quotes !== 11) problems.push(`${quotes} blockquotes, expected 11`);
if (!/Sheena A Tanna/.test(body)) problems.push("her name is missing");
if (!/billericaydentalcare\.co\.uk/.test(body)) problems.push("her backlink is gone");
if (/awards\.dentistry\.co\.uk/.test(body)) problems.push("links a competitor");
if (APPLY && !fs.existsSync(HERO)) problems.push("no reframed hero on disk");

console.log(`status ${status} · slug ${slug} · ${quotes} quotes · ${body.length} chars`);
if (problems.length) {
  console.error("REFUSING:");
  for (const p of problems) console.error("  -", p);
  await prisma.$disconnect();
  process.exit(1);
}
console.log("server copy checked");

if (!APPLY && !SEND) {
  console.log("DRY RUN, nothing done. add --apply");
  await prisma.$disconnect();
  process.exit(0);
}

let url = null;
if (APPLY) {
  // ---- new lead picture --------------------------------------------------
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/tanna-hero-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
  const mediaId = Number(
    wp(
      `media import /tmp/tanna-hero-${stamp}.jpg --post_id=${POST_ID} --title=${sq("Dr Sheena A Tanna, Billericay Dental Care")} ` +
        `--alt=${sq(ALT)} --caption=${sq(CAPTION)} --featured_image --porcelain`
    )
  );
  ssh(`rm -f /tmp/tanna-hero-${stamp}.jpg`);
  const mediaUrl = wp(`post get ${mediaId} --field=guid`);
  console.log(`reframed lead uploaded as media ${mediaId}`);

  if (wp(`post meta get ${POST_ID} _thumbnail_id`) !== String(mediaId))
    throw new Error("featured image did not change, stopping before publish");

  // The uncropped one is ours, from yesterday, and now unreferenced.
  if (String(OLD_MEDIA) !== String(mediaId)) {
    wp(`post delete ${OLD_MEDIA} --force`);
    console.log(`removed the uncropped media ${OLD_MEDIA}`);
  }

  // ---- publish -----------------------------------------------------------
  const local = ssh(`TZ=Europe/London date '+%Y-%m-%d %H:%M:%S'`);
  const gmt = ssh(`date -u '+%Y-%m-%d %H:%M:%S'`);
  // The title rides along so Yoast rebuilds the indexable; without it the share
  // card keeps serving the old picture.
  const title = wp(`post get ${POST_ID} --field=post_title`);
  wp(
    `post update ${POST_ID} --post_status=publish --post_title=${sq(title)} ` +
      `--post_date=${sq(local)} --post_date_gmt=${sq(gmt)}`
  );
  ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`);
  url = wp(`post url ${POST_ID}`);
  console.log(`\npublished ${wp(`post get ${POST_ID} --field=post_status`)} at ${local} UK`);
  console.log(`url: ${url}`);

  await db.article.update({
    where: { id: ARTICLE_ID },
    data: { status: "published", publishedAt: new Date(), imageUrl: mediaUrl, qaPassed: true },
  });
  await db.interviewTarget.update({
    where: { id: TARGET_ID },
    data: { status: "published", publishedUrl: url, publishedAt: new Date(), headshotUrl: mediaUrl },
  });
  console.log("article and interview rows marked published");

  // Prove the live page from the server, where the WAF is not in the way.
  const b64 = ssh(`curl -s --max-time 40 -A 'Mozilla/5.0' ${JSON.stringify(url)} | base64 -w0`);
  const h = Buffer.from(b64, "base64").toString("utf8");
  const og = (h.match(/property=["']og:image["'] content=["']([^"']*)/i) || [])[1] || "";
  console.log(`live page  : ${h.length} bytes, ${(h.match(/<blockquote/g) || []).length} quotes`);
  console.log(`og:image   : ${og}`);
  console.log(`new lead in: ${h.includes(mediaUrl.split("/").pop())}`);
  console.log(`old lead gone: ${!h.includes("tanna-1792052885598")}`);
}

// ---- send ----------------------------------------------------------------
if (SEND) {
  const t = await db.interviewTarget.findUnique({ where: { id: TARGET_ID } });
  if (t.notifiedAt) {
    console.log(`already sent at ${t.notifiedAt.toISOString()}, nothing to do`);
    await prisma.$disconnect();
    process.exit(0);
  }
  if (!t.publishedUrl) throw new Error("no published url on the row, publish first");

  const ask = buildBacklinkAsk({
    personName: t.personName,
    company: t.company,
    titleName: site.name,
    url: t.publishedUrl,
    senderName: outreach?.fromName || "James Burke",
    siteUrl: siteUrl(site),
  });
  // One practical addition to the house note. The photograph she sent is
  // 612x918, which the lead has been enlarged from, and she will have the
  // original from whoever shot it.
  const text = stripEmDashes(
    ask.replace(
      "Either way, thank you for taking part.",
      "One other thing, if it is easy. The photograph came through at a fairly small size and the lead picture has been enlarged from it. " +
        "If you have the original from the photographer, send it over and I will swap it in.\n\nEither way, thank you for taking part."
    )
  );
  const subject = stripEmDashes(`Your ${site.name} piece is live`);
  const [theirs] = await inboundMatching(outreach, "from:billericaydentalcare.co.uk newer_than:7d", 5);

  console.log(`\nto      : ${t.email}`);
  console.log(`subject : ${subject}`);
  console.log(`thread  : ${theirs?.threadId || "(new thread)"}`);
  console.log(`\n${text}\n`);

  await sendGmail({
    outreach,
    to: t.email,
    toName: t.personName,
    subject,
    text,
    html: htmlise(text),
    ...(theirs ? { inReplyTo: theirs.messageId, threadId: theirs.threadId } : {}),
  });
  await db.interviewTarget.update({ where: { id: TARGET_ID }, data: { notifiedAt: new Date() } });
  console.log("sent, and notifiedAt set so the sweep will not send it again");
}

await prisma.$disconnect();
