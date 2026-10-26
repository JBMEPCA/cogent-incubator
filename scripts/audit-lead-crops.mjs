/**
 * Which published lead pictures is the theme cutting into right now?
 *
 * templates/single.html crops the lead to 16/9 with object-fit cover, taking
 * the middle band. Anything TALLER than 16:9 therefore loses its top and
 * bottom, and on a portrait of a person the top is the head. That is how Dr
 * George Wright ended up cut off at the mouth on Dental on 22 Oct, reported by
 * his own press office.
 *
 * lib/lead-crop.js now fixes this at upload for everything published from here
 * on. This script finds what is already live and wrong, across all ten titles.
 *
 * It reads dimensions out of each attachment's _wp_attachment_metadata, which
 * is a serialised PHP array, so one query per site answers the whole question
 * rather than fetching hundreds of images.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/audit-lead-crops.mjs [--site=slug] [--json]
 */
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const JSON_OUT = process.argv.includes("--json");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { LEAD_RATIO } = await import("../lib/lead-crop.js");

const TOLERANCE = 0.04;

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  orderBy: { slug: "asc" },
});

const all = [];
for (const site of sites) {
  if (ONLY && site.slug !== ONLY) continue;
  let creds;
  try {
    ({ creds } = await siteCredentials(site.id));
  } catch (e) {
    console.log(`${site.slug.padEnd(28)} no credentials`);
    continue;
  }
  const s = creds.sftp;
  if (!s) {
    console.log(`${site.slug.padEnd(28)} no sftp credential`);
    continue;
  }
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = [
    "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
    "-o", "BatchMode=yes",
    "-p", String(s.port || 18765),
    `${s.username}@${s.host}`,
  ];
  const ssh = (cmd) => execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 180000, maxBuffer: 48e6 }).trim();
  const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;

  let rows;
  try {
    const prefix = ssh(`cd ${sq(docroot)} && wp db prefix --skip-themes --skip-plugins`).trim();
    // post id, title, attachment id, serialised attachment metadata
    const sql =
      `SELECT p.ID, p.post_name, pm.meta_value AS thumb, am.meta_value AS am ` +
      `FROM ${prefix}posts p ` +
      `JOIN ${prefix}postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id' ` +
      `JOIN ${prefix}postmeta am ON am.post_id = pm.meta_value AND am.meta_key = '_wp_attachment_metadata' ` +
      `WHERE p.post_type = 'post' AND p.post_status = 'publish'`;
    const raw = ssh(`cd ${sq(docroot)} && wp db query ${sq(sql)} --skip-themes --skip-plugins --batch`);
    rows = raw.split("\n").slice(1).filter(Boolean);
  } catch (e) {
    console.log(`${site.slug.padEnd(28)} query failed: ${String(e.message).split("\n")[0].slice(0, 70)}`);
    continue;
  }

  const bad = [];
  let seen = 0;
  for (const line of rows) {
    const [id, slug, thumb, ...rest] = line.split("\t");
    const meta = rest.join("\t");
    const w = Number((meta.match(/"width";i:(\d+)/) || [])[1]);
    const h = Number((meta.match(/"height";i:(\d+)/) || [])[1]);
    if (!w || !h) continue;
    seen++;
    const ratio = w / h;
    if (ratio < LEAD_RATIO - TOLERANCE) {
      bad.push({ site: site.slug, id: Number(id), slug, thumb: Number(thumb), w, h, ratio: Number(ratio.toFixed(3)) });
    }
  }
  bad.sort((a, b) => a.ratio - b.ratio);
  all.push(...bad);

  const portrait = bad.filter((b) => b.ratio < 1).length;
  console.log(
    `${site.slug.padEnd(28)} ${String(seen).padStart(4)} posts with a lead picture · ` +
      `${String(bad.length).padStart(3)} taller than 16:9 · ${String(portrait).padStart(3)} portrait or square`
  );
  for (const b of bad.slice(0, 4)) {
    console.log(`      ${String(b.ratio).padEnd(6)} ${b.w}x${b.h}  post ${b.id}  ${b.slug.slice(0, 54)}`);
  }
  if (bad.length > 4) console.log(`      ... and ${bad.length - 4} more`);
}

console.log(`\nTOTAL across the fleet: ${all.length} live lead pictures are being centre-cropped into.`);
console.log(`Of those, ${all.filter((b) => b.ratio < 1).length} are portrait or square, where the top of the frame is usually a head.`);

if (JSON_OUT) {
  const out = "scripts/lead-crop-audit.json";
  fs.writeFileSync(out, JSON.stringify(all, null, 1));
  console.log(`written: ${out}`);
}
await prisma.$disconnect();
