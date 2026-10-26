/**
 * Re-crop the live lead pictures the theme is cutting faces out of.
 *
 * Works from scripts/lead-crop-audit.json, written by audit-lead-crops.mjs,
 * and takes only the pictures TALLER than MAX_RATIO. A 4:3 news photograph
 * loses a thin band top and bottom and nobody minds; a portrait loses the head.
 * There were 1,107 pictures taller than 16:9 across the fleet and 23 of them
 * in the range that actually costs you a face.
 *
 * Each one is downloaded from its own title, re-cropped through the same
 * lib/lead-crop.js the publisher now uses, uploaded as a NEW attachment and set
 * as the featured image. The original attachment is left in the library
 * untouched, so any of this can be put back by hand.
 *
 * The Yoast indexable row is deleted per post, or the share card keeps serving
 * the old crop no matter how many times the featured image changes.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/fix-lead-crops.mjs [--sheet] [--apply] [--site=slug]
 *
 *   --sheet   download and build a before/after contact sheet, change nothing
 *   --apply   actually replace the featured images
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const SHEET = process.argv.includes("--sheet");
const ONLY = (process.argv.find((a) => a.startsWith("--site=")) || "").split("=")[1] || null;

const MAX_RATIO = 1.16;
const WORK =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "ab747c79-736f-42fc-8062-1a21d89ca420/scratchpad/leadfix";
fs.mkdirSync(WORK, { recursive: true });

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { cropToLead } = await import("../lib/lead-crop.js");

const audit = JSON.parse(fs.readFileSync("scripts/lead-crop-audit.json", "utf8"));
const targets = audit.filter((a) => a.ratio < MAX_RATIO && (!ONLY || a.site === ONLY));
console.log(`${targets.length} pictures taller than ${MAX_RATIO}:1\n`);

const bySite = {};
for (const t of targets) (bySite[t.site] ||= []).push(t);

const done = [];
for (const [slug, items] of Object.entries(bySite)) {
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
  const ssh = (cmd, input) =>
    execFileSync("ssh", [...args, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 64e6 }).trim();
  const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
  const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);
  const prefix = ssh(`cd ${sq(docroot)} && wp db prefix --skip-themes --skip-plugins`).trim();

  console.log(`--- ${slug}`);
  for (const t of items) {
    const tag = `${slug}-${t.id}`;
    const beforeFile = `${WORK}/${tag}-before.jpg`;
    const afterFile = `${WORK}/${tag}-after.jpg`;
    try {
      const rel = wp(`post meta get ${t.thumb} _wp_attached_file`);
      const b64 = ssh(`base64 -w0 ${docroot}/wp-content/uploads/${rel}`);
      const buf = Buffer.from(b64, "base64");
      fs.writeFileSync(beforeFile, buf);

      const r = await cropToLead(buf, "image/jpeg");
      if (!r.cropped) {
        console.log(`  post ${String(t.id).padEnd(5)} skipped: ${r.note}`);
        continue;
      }
      fs.writeFileSync(afterFile, r.buffer);
      done.push({ ...t, tag, note: r.note, rel, prefix, wp, ssh, sq, docroot });
      console.log(`  post ${String(t.id).padEnd(5)} ${r.note}`);
    } catch (e) {
      console.log(`  post ${String(t.id).padEnd(5)} FAILED: ${String(e.message).split("\n")[0].slice(0, 80)}`);
    }
  }
}

if (SHEET) {
  // Before and after side by side, both letterboxed into the SAME 16:9 box the
  // theme uses, so the sheet shows what a reader sees rather than the files.
  const CW = 420, CH = Math.round(CW / (16 / 9)), ROW = CH + 30;
  const layers = [];
  let svg = `<svg width="${CW * 2 + 24}" height="${ROW * done.length}">`;
  for (let i = 0; i < done.length; i++) {
    const d = done[i];
    const before = await sharp(`${WORK}/${d.tag}-before.jpg`).resize(CW, CH, { fit: "cover", position: "centre" }).toBuffer();
    const after = await sharp(`${WORK}/${d.tag}-after.jpg`).resize(CW, CH, { fit: "cover", position: "centre" }).toBuffer();
    layers.push({ input: before, top: ROW * i + 26, left: 0 });
    layers.push({ input: after, top: ROW * i + 26, left: CW + 24 });
    svg += `<text x="2" y="${ROW * i + 18}" font-size="13" font-family="monospace" fill="#000">${d.site} ${d.id}  ${d.w}x${d.h}  (left: what readers see now)</text>`;
  }
  svg += "</svg>";
  layers.push({ input: Buffer.from(svg), top: 0, left: 0 });
  const out = `${WORK}/sheet.png`;
  await sharp({ create: { width: CW * 2 + 24, height: ROW * done.length, channels: 3, background: "#ffffff" } })
    .composite(layers).png().toFile(out);
  console.log(`\ncontact sheet: ${out}`);
}

if (APPLY) {
  console.log("\napplying...");
  for (const d of done) {
    try {
      const stamp = Date.now();
      const alt = d.wp(`post meta get ${d.thumb} _wp_attachment_image_alt`) || "";
      const caption = d.wp(`post get ${d.thumb} --field=post_excerpt`) || "";
      const title = d.wp(`post get ${d.thumb} --field=post_title`) || "lead";
      d.ssh(`base64 -d > /tmp/lead-${stamp}.jpg`, fs.readFileSync(`${WORK}/${d.tag}-after.jpg`).toString("base64"));
      const mediaId = Number(
        d.wp(
          `media import /tmp/lead-${stamp}.jpg --post_id=${d.id} --title=${d.sq(title)} ` +
            (alt ? `--alt=${d.sq(alt)} ` : "") + (caption ? `--caption=${d.sq(caption)} ` : "") +
            `--featured_image --porcelain`
        )
      );
      d.ssh(`rm -f /tmp/lead-${stamp}.jpg`);
      d.wp(`db query "DELETE FROM ${d.prefix}yoast_indexable WHERE object_id = ${d.id} AND object_type = 'post'" --skip-themes --skip-plugins`);
      console.log(`  ${d.site} post ${d.id}: featured now ${mediaId}`);
    } catch (e) {
      console.log(`  ${d.site} post ${d.id}: FAILED ${String(e.message).split("\n")[0].slice(0, 90)}`);
    }
  }
  for (const slug of Object.keys(bySite)) {
    const d = done.find((x) => x.site === slug);
    if (d) { try { d.ssh(`cd ${d.sq(d.docroot)} && wp sg purge; wp cache flush`); } catch {} }
  }
  console.log("caches purged");
}

await prisma.$disconnect();
