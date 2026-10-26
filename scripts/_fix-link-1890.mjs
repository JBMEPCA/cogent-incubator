import os from "node:os"; import { execFileSync } from "node:child_process";
const POST_ID = 1890, OLD = "https://darkhorse.agency", NEW = "https://darkhorse.co";
const { prisma } = await import("../lib/prisma.js"); const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } }); const { creds } = await siteCredentials(site.id); await prisma.$disconnect();
const s = creds.sftp; const key = s.privateKeyPath.replace(/^~/, os.homedir()); const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (c, input) => execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, c], { encoding: "utf8", timeout: 120000, input, maxBuffer: 32e6 }).trim();
const wp = (a, input) => ssh(`cd '${docroot}' && wp ${a}`, input);
const content = wp(`post get ${POST_ID} --field=post_content`);
const n = content.split(OLD).length - 1;
if (!n) { console.log("old link not present, nothing to do"); process.exit(0); }
const updated = content.split(OLD).join(NEW);
const stamp = Date.now();
ssh(`base64 -d > /tmp/fix-${stamp}.html`, Buffer.from(updated, "utf8").toString("base64"));
wp(`post update ${POST_ID} /tmp/fix-${stamp}.html`);
ssh(`rm -f /tmp/fix-*.html && cd '${docroot}' && wp cache flush && (wp sg purge >/dev/null 2>&1 || true)`);
const fresh = wp(`post get ${POST_ID} --field=post_content`);
console.log(JSON.stringify({ replaced: n, oldLeft: fresh.split(OLD).length - 1, newNow: fresh.split(NEW).length - 1 }));
