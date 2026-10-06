// Per-title Mailchimp readiness, read off each live site rather than inferred.
//
//   node --import ./scripts/_register.mjs scripts/_mailchimp-audit.mjs
//
// Answers one question per title: if a reader subscribed right now, where would
// the address land? Key present, audience resolved, and what the theme thinks
// its audience is called. A title with a key but no resolved list silently
// keeps every signup local. That looks fine on the site, loses nothing, and
// tells nobody, which is the worst of the three states to be in.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

// The payload is base64d rather than heredoc-ed into the ssh command. A heredoc
// has to survive two shells, and a pipe character is exactly what neither of
// them leaves alone: the first version came back with every delimiter eaten.
const PHP = [
  "<?php",
  "$s = get_option('cogent_mailchimp', array()); $s = is_array($s) ? $s : array();",
  "$key = !empty($s['key']) ? 'yes' : 'NO KEY';",
  "$list = !empty($s['list']) ? $s['list'] : 'UNRESOLVED';",
  "$aud = function_exists('cogent_mc_audience') ? cogent_mc_audience() : '(no theme)';",
  "$n = wp_count_posts('cogent_sub'); $n = $n ? (int) $n->publish : 0;",
  "echo implode(chr(9), array($key, $list, $aud, $n));",
].join("\n");

const B64 = Buffer.from(PHP).toString("base64");
const sites = await prisma.site.findMany({ orderBy: { slug: "asc" } });
const rows = [];

for (const site of sites) {
  const { creds } = await siteCredentials(site.id);
  const sftp = creds?.sftp;
  if (!sftp?.host) { rows.push([site.slug, "NO SFTP", "", "", ""]); continue; }

  const key = sftp.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`];

  const cmd = `cd '${docroot}' && echo ${B64} | base64 -d > /tmp/_mc_audit.php && `
    + `wp eval-file /tmp/_mc_audit.php 2>/dev/null; rm -f /tmp/_mc_audit.php`;

  let out;
  try {
    out = execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 90000 })
      .trim().split("\n").pop();
  } catch (e) {
    out = "SSH FAILED\t\t\t";
  }
  rows.push([site.slug, ...out.split("\t")]);
}

console.log("\n" + "title".padEnd(27) + "key".padEnd(9) + "audience id".padEnd(14) + "audience name".padEnd(30) + "subs");
console.log("-".repeat(90));
for (const r of rows) {
  console.log(String(r[0]).padEnd(27) + String(r[1] ?? "").padEnd(9) + String(r[2] ?? "").padEnd(14) + String(r[3] ?? "").padEnd(30) + String(r[4] ?? ""));
}
await prisma.$disconnect();
