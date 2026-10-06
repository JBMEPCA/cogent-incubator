// What happened to the subscribers that were stranded before the key landed.
// Reads each site's Subscribers store: address, source, sync state, notified.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

const PHP = [
  "<?php",
  "$q = get_posts(array('post_type'=>'cogent_sub','post_status'=>'any','posts_per_page'=>50));",
  "foreach ($q as $p) {",
  "  echo $p->post_title . chr(9) . get_post_meta($p->ID,'_source',true) . chr(9)",
  "    . get_post_meta($p->ID,'_sync',true) . chr(9) . get_post_meta($p->ID,'_sync_error',true)",
  "    . chr(9) . get_post_meta($p->ID,'_notified',true) . chr(10);",
  "}",
].join("\n");
const B64 = Buffer.from(PHP).toString("base64");

for (const site of await prisma.site.findMany({ orderBy: { slug: "asc" } })) {
  const { creds } = await siteCredentials(site.id);
  const s = creds?.sftp; if (!s?.host) continue;
  const key = s.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(s.port || 18765), `${s.username}@${s.host}`];
  let out;
  try {
    out = execFileSync("ssh", [...args,
      `cd '${docroot}' && echo ${B64} | base64 -d > /tmp/_subs.php && wp eval-file /tmp/_subs.php 2>/dev/null; rm -f /tmp/_subs.php`],
      { encoding: "utf8", timeout: 90000 }).trim();
  } catch (e) { out = "(ssh failed)"; }
  if (!out) { console.log(site.slug.padEnd(27) + "(none)"); continue; }
  for (const line of out.split("\n")) {
    const [email, src, sync, err, notified] = line.split("\t");
    if (!email) continue;
    console.log(site.slug.padEnd(27) + String(email).padEnd(34)
      + String(src || "").padEnd(15) + String(sync || "").padEnd(9)
      + (err ? "ERR:" + err + " " : "") + (notified ? "mailed:" + notified : ""));
  }
}
await prisma.$disconnect();
