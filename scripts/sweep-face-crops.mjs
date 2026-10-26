/**
 * Run the face test over EVERY published lead picture on all ten titles.
 *
 * The first pass only looked at pictures taller than 1.16:1, on the assumption
 * that a 4:3 photograph loses a harmless band top and bottom. That assumption
 * is wrong on its face: the centre band of a 4:3 picture still throws away the
 * top 12.5% of the frame, and a head photographed high sits exactly there. The
 * only way to know is to look at all of them, so this does.
 *
 * It analyses WordPress's own "medium" derivative rather than the original,
 * because the head test runs at 160px wide and a 300px thumbnail is about
 * 15KB against several hundred. That turns roughly 250MB of transfer into
 * about 17MB. Ratios are preserved by the resize, so the arithmetic is
 * identical; only pictures that need fixing have their full-size original
 * fetched.
 *
 * Files are pulled in batches per SSH call, because one call per picture over
 * eleven hundred pictures is twenty minutes of connection overhead.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/sweep-face-crops.mjs [--apply] [--site=slug]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;
const BATCH = 30;

const WORK =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/scratchpad/sweep";
fs.mkdirSync(WORK, { recursive: true });

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { cropToLead, wouldCutFace, LEAD_RATIO } = await import("../lib/lead-crop.js");

const sites = await prisma.site.findMany({
  where: { status: { in: ["live", "cold_start"] } },
  orderBy: { slug: "asc" },
});

const flagged = [];
let examined = 0;

for (const site of sites) {
  if (ONLY && site.slug !== ONLY) continue;
  let creds;
  try { ({ creds } = await siteCredentials(site.id)); } catch { continue; }
  const s = creds.sftp;
  if (!s) continue;

  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const args = [
    "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
    "-o", "BatchMode=yes",
    "-p", String(s.port || 18765),
    `${s.username}@${s.host}`,
  ];
  const ssh = (cmd, input) =>
    execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 300000, input, maxBuffer: 96e6 }).trim();
  const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
  const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

  let rows = [];
  try {
    const prefix = ssh(`cd ${sq(docroot)} && wp db prefix --skip-themes --skip-plugins`).trim();
    const sql =
      `SELECT p.ID, pm.meta_value AS thumb, f.meta_value AS rel, am.meta_value AS am ` +
      `FROM ${prefix}posts p ` +
      `JOIN ${prefix}postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_thumbnail_id' ` +
      `JOIN ${prefix}postmeta f  ON f.post_id  = pm.meta_value AND f.meta_key  = '_wp_attached_file' ` +
      `JOIN ${prefix}postmeta am ON am.post_id = pm.meta_value AND am.meta_key = '_wp_attachment_metadata' ` +
      `WHERE p.post_type = 'post' AND p.post_status = 'publish'`;
    rows = ssh(`cd ${sq(docroot)} && wp db query ${sq(sql)} --skip-themes --skip-plugins --batch`)
      .split("\n").slice(1).filter(Boolean);
  } catch (e) {
    console.log(`${site.slug.padEnd(27)} query failed`);
    continue;
  }

  // Only pictures taller than 16:9 can lose anything at the top at all.
  const cands = [];
  for (const line of rows) {
    const [id, thumb, rel, ...rest] = line.split("\t");
    const am = rest.join("\t");
    const w = Number((am.match(/"width";i:(\d+)/) || [])[1]);
    const h = Number((am.match(/"height";i:(\d+)/) || [])[1]);
    if (!w || !h) continue;
    if (w / h >= LEAD_RATIO - 0.04) continue;
    // WordPress's medium derivative, if it made one.
    const med = (am.match(/"medium";a:\d+:\{s:4:"file";s:\d+:"([^"]+)"/) || [])[1];
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/") + 1) : "";
    cands.push({ id: Number(id), thumb: Number(thumb), rel, probe: med ? dir + med : rel, w, h });
  }

  let cut = 0;
  for (let i = 0; i < cands.length; i += BATCH) {
    const chunk = cands.slice(i, i + BATCH);
    // One call, many files, delimited.
    const cmd = chunk
      .map((c) => `echo "===${c.id}==="; base64 -w0 ${sq(docroot + "/wp-content/uploads/" + c.probe)} 2>/dev/null || true; echo`)
      .join("; ");
    let blob;
    try { blob = ssh(cmd); } catch { continue; }
    const parts = blob.split(/===(\d+)===\n?/).slice(1);
    for (let k = 0; k < parts.length; k += 2) {
      const id = Number(parts[k]);
      const b64 = (parts[k + 1] || "").trim();
      const c = chunk.find((x) => x.id === id);
      if (!c || !b64) continue;
      examined++;
      try {
        // Scale invariant, so a 300px thumbnail answers for the original.
        const r = await wouldCutFace(Buffer.from(b64, "base64"));
        if (r.cut) {
          cut++;
          flagged.push({ site: site.slug, ...c, note: r.reason });
        }
      } catch {}
    }
  }
  console.log(`${site.slug.padEnd(27)} ${String(cands.length).padStart(4)} taller than 16:9 · ${String(cut).padStart(3)} with a head the centre band cuts`);

  if (APPLY) {
    for (const f of flagged.filter((x) => x.site === site.slug)) {
      try {
        const prefix = ssh(`cd ${sq(docroot)} && wp db prefix --skip-themes --skip-plugins`).trim();
        const full = Buffer.from(ssh(`base64 -w0 ${sq(docroot + "/wp-content/uploads/" + f.rel)}`), "base64");
        const r = await cropToLead(full, "image/jpeg");
        if (!r.cropped) { console.log(`   post ${f.id}: original did not need it after all`); continue; }
        const stamp = Date.now();
        const alt = wp(`post meta get ${f.thumb} _wp_attachment_image_alt`) || "";
        const title = wp(`post get ${f.thumb} --field=post_title`) || "lead";
        const cap = wp(`post get ${f.thumb} --field=post_excerpt`) || "";
        ssh(`base64 -d > /tmp/sweep-${stamp}.jpg`, r.buffer.toString("base64"));
        const mediaId = Number(
          wp(`media import /tmp/sweep-${stamp}.jpg --post_id=${f.id} --title=${sq(title)} ` +
             (alt ? `--alt=${sq(alt)} ` : "") + (cap ? `--caption=${sq(cap)} ` : "") + `--featured_image --porcelain`)
        );
        ssh(`rm -f /tmp/sweep-${stamp}.jpg`);
        wp(`db query "DELETE FROM ${prefix}yoast_indexable WHERE object_id = ${f.id} AND object_type = 'post'" --skip-themes --skip-plugins`);
        console.log(`   post ${f.id}: featured now ${mediaId}  (${r.note.slice(0, 60)})`);
      } catch (e) {
        console.log(`   post ${f.id}: FAILED ${String(e.message).split("\n")[0].slice(0, 70)}`);
      }
    }
    try { ssh(`cd ${sq(docroot)} && wp sg purge; wp cache flush`); } catch {}
  }
}

console.log(`\nexamined ${examined} lead pictures across the fleet`);
console.log(`${flagged.length} have a head the centre band cuts into`);
fs.writeFileSync("scripts/face-sweep.json", JSON.stringify(flagged, null, 1));
console.log("written: scripts/face-sweep.json");
await prisma.$disconnect();
