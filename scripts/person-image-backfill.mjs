// Give live stories about people a picture of the person.
//
//   node --import ./scripts/_register.mjs scripts/person-image-backfill.mjs --site=golf-resort-magazine
//   node --import ./scripts/_register.mjs scripts/person-image-backfill.mjs --all --days=60 --apply
//
// Dry run by default: it classifies and searches, and prints what it would do.
// --apply writes the subject to the article, puts the photo (or the name card)
// in the title's media library, makes it the featured image and swaps the
// credit line. lib/headshots.js then asks the company for a photo of anyone
// left on a card.
//
// Writes go over SSH plus wp-cli, because SiteGround's WAF refuses REST writes
// from outside Vercel (see the playbook). The card is fetched from the live app,
// so deploy before running with --apply.
import "./_env.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { classifySubject, personImage, nameCard, subjectFields, isAboutPerson } = await import("../lib/person-image.js");

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const DAYS = Number(arg("days", "60"));
const LIMIT = Number(arg("limit", "400"));
const DONE = /^(person:|card:|subject:person)/;
// Never replaced: a photo someone sent us. press: is the press desk's email
// photo, supplied: an interview or contributed piece's own. On Golf's first run
// Terre Blanche's press@ photo and Fraser Wilson's Leaders headshot were both
// one broken card link away from being overwritten.
const PROTECTED = /^(press:|supplied:|interview:)/;

const slugs = ALL
  ? (await prisma.site.findMany({ where: { status: { in: ["live", "cold_start"] } }, select: { slug: true } })).map((s) => s.slug)
  : [arg("site")].filter(Boolean);
if (!slugs.length) {
  console.error("Usage: --site=<slug> | --all  [--days=60] [--apply]");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "person-bf-"));
const b64 = (t) => Buffer.from(String(t)).toString("base64");

for (const slug of slugs) {
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) continue;
  const { creds } = await siteCredentials(site.id);
  const db = forSite(site.id);
  const s = creds?.sftp;
  const ssh = s?.host
    ? (cmd) => execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${s.themePath.replace(/\/wp-content\/themes\/.*$/, "")}' && ${cmd}`], { encoding: "utf8", maxBuffer: 20e6 }).trim()
    : null;
  const scp = (local, remote) => execFileSync("scp", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-P", String(s.port || 18765), local, `${s.username}@${s.host}:${remote}`]);

  // Bytes in, media id and URL out.
  // A crop is uploaded during the search; its media id is kept here so it is
  // attached directly. Fetching it back from the site trips the WAF (403).
  const uploaded = new Map();
  const importMedia = (buffer, ext, name, postId, alt, caption) => {
    const file = `${name}.${ext}`;
    const local = path.join(tmp, file);
    fs.writeFileSync(local, buffer);
    scp(local, `/tmp/${file}`);
    const args = [`--title="$(echo ${b64(alt)} | base64 -d)"`, `--alt="$(echo ${b64(alt)} | base64 -d)"`];
    if (caption) args.push(`--caption="$(echo ${b64(caption)} | base64 -d)"`);
    if (postId) args.push(`--post_id=${postId}`, "--featured_image");
    const id = ssh(`wp media import /tmp/${file} --porcelain ${args.join(" ")}; rm -f /tmp/${file}`).split("\n").pop();
    const url = ssh(`wp post get ${id} --field=guid`);
    uploaded.set(url, id);
    return { id, url };
  };

  const setCredit = (postId, credit) => {
    const php = `<?php
$p = get_post(${postId}); $c = $p->post_content;
$re = '#<p><em style="font-size:0\\.85em">(Image|Photo):[^<]*</em></p>#';
$line = ${credit ? `'<p><em style="font-size:0.85em">' . base64_decode('${b64(credit)}') . '</em></p>'` : "''"};
$n = preg_replace($re, $line, $c, 1, $hits);
if (!$hits && $line) $n = rtrim($c) . "\\n" . $line;
// Always saved, even with no text change: Yoast rebuilds its og:image
// record on save, and without one the share image stays the old stock photo.
wp_update_post(['ID' => ${postId}, 'post_content' => $n]);
echo $hits ? "replaced" : ($line ? "appended" : "none");`;
    return ssh(`echo ${b64(php)} | base64 -d > /tmp/pbf.php && wp eval-file /tmp/pbf.php; rm -f /tmp/pbf.php`);
  };

  const rows = await db.article.findMany({
    where: {
      siteId: site.id,
      status: "published",
      wpPostId: { not: null },
      type: { not: "seo_original" },
      publishedAt: { gte: new Date(Date.now() - DAYS * 86400000) },
    },
    orderBy: { publishedAt: "desc" },
    take: LIMIT,
    select: { id: true, title: true, body: true, wpPostId: true, sourceUrl: true, imageSource: true, imageUrl: true, interviewTargets: { select: { id: true } }, subjectKind: true, subjectName: true, subjectRole: true, subjectOrg: true, sourceItem: { select: { link: true } } },
  });
  console.log(`\n== ${site.name}: ${rows.length} published news piece(s) in ${DAYS} days`);

  let people = 0, photos = 0, cards = 0;
  for (const a of rows) {
    if (DONE.test(a.imageSource || "") || PROTECTED.test(a.imageSource || "") || a.interviewTargets?.length) continue;
    // A picture placed by hand in the media library, with no record of where it
    // came from, is somebody's deliberate choice.
    if (!a.imageSource && site.domain && String(a.imageUrl || "").includes(String(site.domain).replace(/^www./, ""))) continue;
    let subject = a.subjectKind
      ? { kind: a.subjectKind, name: a.subjectName, role: a.subjectRole, org: a.subjectOrg }
      : await classifySubject(a.title, a.body).catch(() => null);
    if (!subject) continue;
    if (APPLY && !a.subjectKind) await db.article.update({ where: { id: a.id }, data: subjectFields(subject) });
    if (!isAboutPerson(a.title, subject)) continue;
    people++;

    const upload = APPLY && ssh
      ? async (data, contentType, filename) => importMedia(data, contentType.includes("png") ? "png" : "jpg", filename, null, subject.name, null)
      : null;
    const photo = await personImage(site, { title: a.title, body: a.body, sourceUrl: a.sourceUrl || a.sourceItem?.link, subject, upload }).catch(() => null);
    const pick = photo || nameCard(site, subject);
    photo ? photos++ : cards++;
    console.log(`${photo ? "PHOTO" : "CARD "} wp${a.wpPostId} ${subject.name} | ${a.title.slice(0, 70)}${photo ? ` | ${pick.url.slice(0, 90)}` : ""}`);
    if (!APPLY || !ssh) continue;

    try {
      if (uploaded.has(pick.url)) {
        const id = uploaded.get(pick.url);
        ssh(`wp post meta update ${a.wpPostId} _thumbnail_id ${id} >/dev/null && wp post update ${id} --post_parent=${a.wpPostId} >/dev/null; echo ok`);
        const how = setCredit(a.wpPostId, pick.credit);
        await db.article.update({ where: { id: a.id }, data: { imageUrl: pick.url, imageAlt: pick.alt, imageCredit: pick.credit, imageSource: pick.source } });
        console.log(`   applied: media ${id} (cropped), credit ${how}`);
        continue;
      }
      const res = await fetch(pick.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; CogentBot/1.0)" } });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const type = res.headers.get("content-type") || "image/jpeg";
      const bytes = Buffer.from(await res.arrayBuffer());
      const name = `${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${photo ? "photo" : "card"}`;
      const media = importMedia(bytes, type.includes("png") ? "png" : "jpg", name, a.wpPostId, pick.alt || subject.name, pick.credit);
      const how = setCredit(a.wpPostId, pick.credit);
      await db.article.update({
        where: { id: a.id },
        data: { imageUrl: media.url, imageAlt: pick.alt, imageCredit: pick.credit, imageSource: pick.source },
      });
      console.log(`   applied: media ${media.id}, credit ${how}`);
    } catch (e) {
      console.log(`   FAILED: ${String(e.message).slice(0, 160)}`);
    }
  }
  console.log(`   ${people} about a person: ${photos} photo(s), ${cards} card(s)${APPLY ? "" : " (dry run)"}`);
  if (APPLY && ssh && people) {
    try { ssh("wp sg purge >/dev/null 2>&1; wp cache flush >/dev/null 2>&1; echo purged"); } catch {}
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
await prisma.$disconnect();
