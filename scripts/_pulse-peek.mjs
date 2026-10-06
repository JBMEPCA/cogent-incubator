/** Show exactly what Cogent Pulse stores, on one title. */
import os from "node:os";
import { execFileSync } from "node:child_process";

const slug = process.argv[2] || "dental-business-news";
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

const site = await prisma.site.findUnique({ where: { slug } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const args = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd) => execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 150000 }).trim();
const wp = (a) => ssh(`cd ${docroot} && wp ${a} --skip-themes --skip-plugins`);

const prefix = wp("db prefix").trim();
const table = `${prefix}cogent_pulse`;

console.log(`SITE      ${site.name}`);
console.log(`DATABASE  ${wp("db query \"SELECT DATABASE()\"").split("\n").pop()}  (this title's own WordPress database, on SiteGround)`);
console.log(`TABLE     ${table}`);
console.log(`FILE      ${docroot}/wp-content/mu-plugins/cogent-pulse.php\n`);
console.log("COLUMNS");
console.log(wp(`db query "DESCRIBE ${table}"`));
console.log("\nEVERYTHING IN IT RIGHT NOW");
console.log(wp(`db query "SELECT * FROM ${table}"`));
console.log("\nSIZE ON DISK");
console.log(
  wp(
    `db query "SELECT ROUND(((data_length + index_length) / 1024), 1) AS kb, table_rows FROM information_schema.TABLES WHERE table_name = '${table}'"`
  )
);
await prisma.$disconnect();
