// One-off: replace the stock featured images on three Golf Resort person stories
// with photos of the people themselves (22 Sep 2026 person-image test).
import "./_env.mjs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const DIR = process.env.IMG_DIR;
const JOBS = [
  { post: 779, id: "cmu5d5ul60007que6pd6lz1pw", file: "stephen-brown-bgl-coo.jpg",
    alt: "Stephen Brown, group chief operating officer of Burhill Group", credit: "Photo: Burhill Group",
    src: "https://thegolfbusiness.co.uk/wp-content/uploads/2026/09/DSC08235-1-1.jpg", source: "subject:person:stephen-brown" },
  { post: 845, id: "cmu83rnve000310h56mn2ufmr", file: "justin-honea-toptracer-coo.jpg",
    alt: "Justin Honea, chief operating officer of Toptracer", credit: "Photo: Toptracer",
    src: "https://golfmanagement.online/wp-content/uploads/2026/09/17.09a.jpg", source: "subject:person:justin-honea" },
  { post: 828, id: "cmu82p3pe0005mypq4bmccq8k", file: "dan-grieve-costa-navarino.jpg",
    alt: "Short-game coach Dan Grieve on the tee at Costa Navarino, Greece", credit: "Photo: Costa Navarino",
    src: "https://golfmanagement.online/wp-content/uploads/2026/09/18.09.jpg", source: "subject:person:dan-grieve" },
];

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "golf-resort-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const key = s.privateKeyPath.replace(/^~/, os.homedir());
const target = `${s.username}@${s.host}`;
const port = String(s.port || 18765);
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) => execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", port, target, `cd '${docroot}' && ${cmd}`], { encoding: "utf8" }).trim();

for (const j of JOBS) {
  execFileSync("scp", ["-i", key, "-o", "BatchMode=yes", "-P", port, `${DIR}/${j.file}`, `${target}:/tmp/${j.file}`]);
  const b64 = (t) => Buffer.from(t).toString("base64");
  const mediaId = ssh(`wp media import /tmp/${j.file} --post_id=${j.post} --featured_image --porcelain --title="$(echo ${b64(j.alt)} | base64 -d)" --alt="$(echo ${b64(j.alt)} | base64 -d)" --caption="$(echo ${b64(j.credit)} | base64 -d)"; rm -f /tmp/${j.file}`);
  // Swap (or add) the credit line at the foot of the post.
  const php = `<?php
$p = get_post(${j.post}); $c = $p->post_content;
$line = '<p><em style="font-size:0.85em">${j.credit}</em></p>';
$n = preg_replace('#<p><em style="font-size:0\.85em">(Image|Photo):[^<]*</em></p>#', $line, $c, 1, $hits);
if (!$hits) $n = rtrim($c) . "\n" . $line;
wp_update_post(['ID' => ${j.post}, 'post_content' => $n]);
echo $hits ? "replaced" : "appended";`;
  const how = ssh(`echo ${b64(php)} | base64 -d > /tmp/pimg.php && wp eval-file /tmp/pimg.php; rm -f /tmp/pimg.php`);
  const url = ssh(`wp post get ${mediaId} --field=guid`);
  await prisma.article.update({ where: { id: j.id }, data: { imageUrl: url, imageAlt: j.alt, imageCredit: j.credit, imageSource: j.source } });
  console.log(j.post, "media", mediaId, "credit", how, url);
}
await prisma.$disconnect();
