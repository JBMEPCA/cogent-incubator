// Replace a stored wp_navigation menu's content from a local file, keeping a
// timestamped backup of the old content in post meta so it can be restored.
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_set-wp-navigation.mjs <slug> <navId> <file>
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";

const [slug, navId, file] = process.argv.slice(2);
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const cfg = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).sftp;
await prisma.$disconnect();
const common = ["-i", cfg.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes"];
const port = String(cfg.port || 18765), target = `${cfg.username}@${cfg.host}`;
const root = cfg.themePath.split("/wp-content/")[0];
execFileSync("scp", [...common, "-P", port, file.split("\\").join("/"), `${target}:nav-${navId}.html`], { timeout: 60000 });
const php = `global $wpdb; $id=${Number(navId)}; $old=get_post($id)->post_content; add_post_meta($id, "_cogent_nav_backup_".gmdate("Ymd_His"), wp_slash($old)); $new=file_get_contents(getenv("HOME")."/nav-${navId}.html"); $wpdb->update($wpdb->posts, array("post_content"=>$new), array("ID"=>$id)); clean_post_cache($id); echo "menu $id: ".strlen($old)." -> ".strlen($new)." bytes, backup kept in post meta";`;
console.log(execFileSync("ssh", [...common, "-p", port, target, `cd '${root}' && wp eval '${php.replace(/'/g, `'\''`)}' && rm -f ~/nav-${navId}.html`], { encoding: "utf8", timeout: 120000 }));
