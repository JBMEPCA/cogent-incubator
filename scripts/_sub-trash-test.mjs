// Trash the band test-signup records left on the four titles that had no
// subscribers of their own. Trash, not force-delete: recoverable if wanted.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

const PHP = [
  "<?php",
  "$q = get_posts(array('post_type'=>'cogent_sub','post_status'=>'any','posts_per_page'=>50,",
  "  'title'=>'jb+cogentbandtest@smartsme.co.uk'));",
  "foreach ($q as $p) { wp_trash_post($p->ID); echo 'trashed ' . $p->ID . chr(10); }",
  "if (!$q) echo 'none' . chr(10);",
].join("\n");
const B64 = Buffer.from(PHP).toString("base64");

for (const slug of ["dental-business-news", "nursery-daily", "senior-lifestyle-business", "smart-farming-news"]) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const key = s.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(s.port || 18765), `${s.username}@${s.host}`];
  const out = execFileSync("ssh", [...args,
    `cd '${docroot}' && echo ${B64} | base64 -d > /tmp/_subtrash.php && wp eval-file /tmp/_subtrash.php 2>/dev/null; rm -f /tmp/_subtrash.php`],
    { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop();
  console.log(slug.padEnd(27), out);
}
await prisma.$disconnect();
