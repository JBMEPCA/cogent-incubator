/**
 * Drop the Yoast indexable row for Dental Business News post 52 so the share
 * cards pick up its new header image.
 *
 * Changing featured_media through the REST API updates the page but not
 * og:image: Yoast serves its own cached copy from wp_yoast_indexable and only
 * rebuilds it when the post is saved through WordPress. Sending the post title
 * alongside the change is usually enough to make it a real save; here it was
 * not, and the article kept pointing every share at the picture we had just
 * taken down. Deleting the row is the operation Yoast is built to survive: it
 * is a cache, and the next request for the URL rebuilds it from the post.
 *
 * Run: node --env-file=.env scripts/_dental-52-yoast.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { creds } = await siteCredentials(site.id);
const sftp = creds.sftp;
const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const base = ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes",
  "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];
const ssh = (c) => execFileSync("ssh", [...base, c], { encoding: "utf8", timeout: 300000 });

const before = ssh(`cd ${docroot} && wp db query "SELECT id, object_id, open_graph_image FROM \\\`$(wp db prefix --skip-plugins --skip-themes | tr -d '\\n')yoast_indexable\\\` WHERE object_id = 52 AND object_type = 'post'" --skip-plugins --skip-themes`);
console.log("before:\n" + before);

const del = ssh(`cd ${docroot} && wp db query "DELETE FROM \\\`$(wp db prefix --skip-plugins --skip-themes | tr -d '\\n')yoast_indexable\\\` WHERE object_id = 52 AND object_type = 'post'" --skip-plugins --skip-themes && echo deleted`);
console.log(del.trim());

await prisma.$disconnect();
