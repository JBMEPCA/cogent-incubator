/**
 * One-off, 14 Sep 2026: Fleetclear StreetVision launch as a Fleet news piece.
 * Release from Clare Summers-Taylor (Summers Marketing) to press@ at 13:23,
 * image saved by JB to Downloads. Built from the Stellantis IAA pair
 * (_build-stellantis-iaa.mjs, _publish-stellantis-iaa.mjs), in one script.
 *
 * Over SSH plus wp-cli because the SiteGround WAF blocks REST writes. Creates a
 * draft, attaches the featured image, writes Yoast meta, clears the stale
 * indexable row, then publishes only with --publish. Set POST_ID to revise.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-fleetclear-streetvision.mjs [--write] [--publish]
 */
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";

const WRITE = process.argv.includes("--write") || process.argv.includes("--publish");
const PUBLISH = process.argv.includes("--publish");
const POST_ID = Number(process.env.POST_ID || 0);

const SOURCE = "https://www.fleetclear.com";
const TITLE = "Fleetclear Launches StreetVision AI for Fleet Camera Footage";
const KEYPHRASE = "Fleetclear StreetVision";
const META = "Fleetclear StreetVision uses AI on existing vehicle camera footage to check reversing safety and PPE, and spot road defects and litter on routine routes.";
const CATEGORY_ID = 7; // Telematics & Technology
const AUTHOR_ID = 4;
const IMG_SRC = path.join(os.homedir(), "Downloads", "streetvision_ppe.jpg");
const IMG_OUT = path.join(os.tmpdir(), "fleetclear-streetvision-ppe-detection.jpg");
const ALT = "Fleetclear StreetVision detecting a crew member's hi-vis top and trousers from a refuse vehicle's rear camera";
const CREDIT = "Picture: Fleetclear";

const FLEETCHECK = "https://thefleetmagazine.co.uk/fleetcheck-flags-new-ai-model-that-predicts-85-of-collisions-before-they-happen/";
const DASHCAM = "https://thefleetmagazine.co.uk/best-fleet-dash-cam-telematics-for-uk-insurance-discounts-in-2026/";

const P = [
  `<a href="${SOURCE}">Fleetclear</a> has launched StreetVision, an AI platform that analyses footage from the cameras already fitted to fleet vehicles and turns it into structured data on safety, day-to-day operations and the streets those vehicles drive. It was demonstrated to guests at OnTrack, Fleetclear's fleet technology event at Dunsfold Aerodrome, the former Top Gear test track, on Tuesday 8 September.`,

  `<strong>Reversing safety comes first.</strong> The first use already running is reversing. StreetVision reviews reversing manoeuvres automatically and records whether pedestrians were present, where crew members were positioned and whether they were wearing the right PPE. For refuse, construction and municipal operators, where reversing with crew on foot is part of every shift, that is the part of the launch with an immediate application.`,

  `<strong>The cameras point outward as well.</strong> Most fleet technology is about the vehicle itself: where it is, how it is being driven and whether it is running efficiently. StreetVision uses the same cameras to look at what is around the vehicle. Fleetclear says vans and trucks on their normal routes can automatically pick up road defects, litter and people working without PPE.`,

  `Chief Technology Officer Chris Waller said: "Fleet vehicles travel the same roads and communities every day, capturing an extraordinary amount of information about what is happening around them. Until now, there has been no practical way to turn that volume of visual data into usable operational intelligence at scale. StreetVision changes that."`,

  `<strong>Why volume matters.</strong> Many operational decisions rest on single observations: a supervisor's check, a resident's complaint, an audit finding or an investigation after an incident. Fleetclear's argument is that analysing routine journeys across a whole fleet covers far more of the operation, so recurring problems show up as patterns before they turn into a serious incident.`,

  `"The biggest safety benefit is simple: you can see far more of what is happening across the operation," Waller said. "That means you can identify recurring risks earlier, intervene sooner and reduce the chance of a serious incident occurring."`,

  `Chief Executive Gavin Thoday said: "The real opportunity with AI isn't always in deploying more technology. It's in making far better use of what's already there. StreetVision turns existing infrastructure into something more intelligent, more valuable and capable of delivering insights that simply weren't possible before."`,

  `<strong>What the launch does not cover yet.</strong> The announcement gives no pricing, names no customers or trial results, and does not say which camera systems StreetVision works with or when detection beyond reversing will be generally available. It is part of a wider move towards AI that reads fleet data for risk, alongside tools such as the <a href="${FLEETCHECK}">FleetCheck collision prediction model</a> we covered earlier this month.`,

  `Fleetclear has been supplying commercial vehicle safety technology for more than 15 years. Its range includes the Live Lane Information System, anti-rollaway technology, driver identification, camera recording systems, reverse radar and its Fleetclear Connect software, used by operators in transport, construction and local government.`,

  `<strong>What to do next.</strong> If you already run Fleetclear cameras, ask whether your existing units and footage retention can feed StreetVision, what it costs per vehicle, and which detections are live today rather than planned. If you run refuse or highways vehicles for a council, road defect and litter data may be worth raising at your next contract review. And because PPE and crew-position checks are a form of worker monitoring, update your privacy notice and complete a data protection impact assessment before switching them on. For how camera data can also cut premiums, see our <a href="${DASHCAM}">guide to dash cam telematics and insurance discounts</a>.`,
];
const BODY = P.map((p) => `<p>${p}</p>`).join("\n\n");

// ---- the gate, applied here because this bypasses the drafting pipeline ----
const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[—–]/.test(TITLE + BODY + META + ALT)) problems.push("dash");
if (TITLE.length > 65) problems.push("title > 65");
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
const banned = plain.match(/\b(leading|innovative|best-in-class|solutions?|cutting-edge|revolutionary)\b/gi);
if (banned) problems.push("supplier words: " + banned.join(", "));
const words = plain.split(" ").length;
if (words < 300) problems.push("too short");
console.log(`title ${TITLE.length} chars | meta ${META.length} | words ${words}`);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}

await sharp(IMG_SRC).jpeg({ quality: 88, mozjpeg: true }).toFile(IMG_OUT);
console.log(`image ${IMG_OUT} ${fs.statSync(IMG_OUT).size} bytes`);
if (!WRITE) {
  console.log("DRY RUN, gate passed");
  process.exit(0);
}

// ---- write ----
const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const target = `${s.username}@${s.host}`;
const sshArgs = ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765)];
const ssh = (cmd) => execFileSync("ssh", [...sshArgs, target, `cd '${docroot}' && ${cmd}`], { encoding: "utf8", timeout: 180000 }).trim();
const b64 = (x) => Buffer.from(x, "utf8").toString("base64");
const tmp = `/tmp/fleetclear-sv-${Date.now()}`;

const creditLine = `<p><em style="font-size:0.85em">${CREDIT}</em></p>`;
const CONTENT = BODY + "\n\n" + creditLine;
ssh(
  `printf '%s' '${b64(CONTENT)}' | base64 -d > ${tmp}.html && printf '%s' '${b64(TITLE)}' | base64 -d > ${tmp}.title && printf '%s' '${b64(META)}' | base64 -d > ${tmp}.meta && printf '%s' '${b64(ALT)}' | base64 -d > ${tmp}.alt`
);
let id = POST_ID;
if (id) {
  ssh(`wp post update ${id} ${tmp}.html --post_title="$(cat ${tmp}.title)" --post_excerpt="$(cat ${tmp}.meta)"`);
} else {
  id = Number(
    ssh(
      `wp post create ${tmp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_title="$(cat ${tmp}.title)" --post_excerpt="$(cat ${tmp}.meta)" --post_category=${CATEGORY_ID} --porcelain`
    )
  );
}
ssh(
  `wp post meta update ${id} _yoast_wpseo_focuskw '${KEYPHRASE}' && wp post meta update ${id} _yoast_wpseo_metadesc "$(cat ${tmp}.meta)" && wp post meta update ${id} _yoast_wpseo_title "$(cat ${tmp}.title)"`
);
console.log("post", id);

// Featured image, once.
if (!ssh(`wp post meta get ${id} _thumbnail_id || true`)) {
  const remote = `/tmp/${path.basename(IMG_OUT)}`;
  execFileSync("ssh", [...sshArgs, target, `base64 -d > '${remote}'`], { input: fs.readFileSync(IMG_OUT).toString("base64"), timeout: 180000 });
  const mediaId = ssh(
    `wp media import '${remote}' --post_id=${id} --featured_image --title='Fleetclear StreetVision PPE detection' --alt="$(cat ${tmp}.alt)" --caption='${CREDIT}' --porcelain && rm -f '${remote}'`
  );
  console.log("media", mediaId);
}
ssh(`rm -f ${tmp}.*`);

if (PUBLISH) {
  ssh(`wp post update ${id} --post_status=publish`);
  // Yoast inserts its indexable row before the meta lands; clear it so the
  // next request rebuilds with the description and title.
  ssh(`wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${id}" && wp cache flush && (wp sg purge || true)`);
}
console.log(ssh(`wp post get ${id} --fields=post_status,post_name,post_date --format=csv`));
const link = ssh(`wp post list --post__in=${id} --post_status=any --fields=url --format=csv | tail -1`);
console.log("url", link);

const existing = await prisma.article.findFirst({ where: { siteId: site.id, wpPostId: id } });
const data = {
  title: TITLE,
  type: "pr_rewrite",
  status: PUBLISH ? "published" : "review",
  ...(PUBLISH ? { publishedAt: new Date() } : {}),
  sourceUrl: SOURCE,
  body: BODY,
  wpPostId: id,
  category: "Telematics & Technology",
  keyphrase: KEYPHRASE,
  metaDesc: META,
  qaPassed: true,
  imageAlt: ALT,
  imageCredit: CREDIT,
  imageSource: "press:fleetclear",
};
const art = existing
  ? await prisma.article.update({ where: { id: existing.id }, data })
  : await prisma.article.create({ data: { ...data, siteId: site.id } });
console.log("article row", art.id, data.status);
await prisma.$disconnect();
