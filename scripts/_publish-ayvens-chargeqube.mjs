/**
 * One-off, 19 Oct 2026: Ayvens and Fellten's Charge Qube partnership, as a
 * Fleet news piece, published, then the live link sent to the agency with
 * Lucas copied in. JB: "Can you get this on Fleet and email them and CC lucas".
 *
 * Source: Flora Rogers-Murray (Bottle) to press@thefleetmagazine.co.uk,
 * 16 Oct 2026 08:00 UK, chased 19 Oct and forwarded twice by Lucas. The press
 * desk never made an article from it, so this is by hand.
 *
 * The release gives no price, no charging power, no battery capacity and no
 * availability date, so the piece says that rather than implying numbers.
 * Quotes are verbatim; Russ Boulton's is trimmed to the sentences that carry
 * meaning, and nothing with supplier adjectives is quoted from our own prose.
 *
 * Image: "Fellten cube & Buzz 7.jpg" from the release, cut to 16:9.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_publish-ayvens-chargeqube.mjs --dir=<dir with the jpg> [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");
const DIR = (process.argv.find((a) => a.startsWith("--dir=")) || "").split("=")[1];
const SRC_IMG = path.join(DIR, "Fellten-cube-Buzz-7.jpg");
const RELEASE_MSG = "1a14383290087468"; // Flora to press@, 16 Oct 08:00 UK
const TO = "Flora Rogers-Murray <Flora.rogersmurray@wearebottle.com>";
const CC = "Lucas Payne <lucas@cimltd.co.uk>";

const FLEET = "https://thefleetmagazine.co.uk";
const TITLE = "Ayvens Offers Mobile Battery Charging to Beat Grid Delays";
const SLUG = "ayvens-offers-mobile-battery-charging-to-beat-grid-delays";
const KEYPHRASE = "mobile EV charging";
const META =
  "Ayvens customers can now use Fellten's Charge Qube, a containerised battery with rapid DC charging that runs off site power while a grid upgrade waits.";
const ALT = "A Fellten Charge Qube container beside an Ayvens-liveried electric van outside the Fellten building";
const CREDIT = "Picture: Fellten";
const CATEGORY_ID = 3; // Electric & Charging
const AUTHOR_ID = 4;

const P = [
  `Fleets held up by the wait for a grid connection have another way round it. <a href="https://www.ayvens.com/en-gb/">Ayvens</a>, the leasing and fleet management business owned by Societe Generale, has partnered with British battery firm <a href="https://chargeqube.com/">Fellten</a> to offer its UK customers Charge Qube, a battery in a shipping container with rapid DC charging built in.`,

  `The unit stores electricity drawn from the power a site already has, then delivers it to vehicles faster than that supply could on its own. Fellten says it can be delivered and running within hours, which means charging can go in at a depot, a temporary site or a remote location without a grid upgrade, a planning application or a permanent installation.`,

  `That is the point of it. Grid connection queues are measured in months and often years, and they stop fleets that have already bought the vehicles, as our figures on <a href="${FLEET}/depot-charging-costs-2026-what-fleets-actually-pay/">what depot charging actually costs</a> set out.`,

  `Mike Ellenthorpe, general manager at Fellten, said: "Access to power is becoming one of the biggest practical challenges facing fleet electrification. A fleet can have the vehicles, the ambition and the funding to make the switch, but if the grid can't deliver the power where it's needed, the whole project can stall."`,

  `Russ Boulton, head of customer data and innovation at Ayvens, said the arrangement is aimed at operators whose requirements do not fit a standard depot build. "Electrification isn't a one-size-fits-all journey," he said. "Every fleet has different requirements, and for some of our customers, the practical challenges of accessing the power they need can be just as significant as choosing the right vehicles or charging infrastructure."`,

  `<strong>What the announcement does not say.</strong> There is no price, no charging power in kilowatts, no battery capacity, no indication of how many vehicles one unit can turn round in a day, and no word on whether customers rent it, lease it or buy it. Those are the numbers that decide whether this is cheaper than waiting, so ask for them before it goes near a business case.`,

  `It also does not remove the grid from the picture permanently. The unit recharges from the site supply, so a depot with very little spare capacity refills it slowly, and anything written into a planning consent or a landlord's agreement still applies. For sites that are staying put, the <a href="${FLEET}/dft-eases-ev-chargepoint-planning-rules-two-changes-coming/">permitted development changes the Department for Transport confirmed last month</a> may do more to shorten a fixed installation.`,

  `<strong>What to do next.</strong> If a grid connection is holding up your electrification plan, ask Ayvens for the cost per month and the output in kilowatts, and compare it against the quote and the wait from your distribution network operator. Check how long the unit takes to recharge on your own site supply, because that sets how many vehicles it can serve. And confirm who carries the risk if the unit fails on a contract where the vans have to run.`,
];
const BODY = P.map((x) => `<p>${x}</p>`).join("\n\n") + `\n\n<p><em style="font-size:0.85em">${CREDIT}</em></p>`;

const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[—–]/.test(TITLE + BODY + META)) problems.push("dash");
if (TITLE.split(":")[0].trim().length > 65) problems.push(`headline ${TITLE.length} > 65`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
// Supplier adjectives are banned in our prose. The two quotes are theirs, so
// check only what we wrote.
const ours = P.filter((x) => !/said:? "/.test(x)).join(" ").replace(/<[^>]+>/g, " ");
const banned = ours.match(/\b(leading|innovative|best-in-class|solutions?)\b/gi);
if (banned) problems.push("supplier words: " + banned.join(", "));
const words = plain.split(" ").length;
if (words < 300) problems.push(`too short ${words}`);
console.log(`title ${TITLE.length} | meta ${META.length} | words ${words}`);
if (problems.length) { console.error("GATE:", problems); process.exit(1); }

// 16:9 from the lower half, so the container and the van both survive the crop.
const m = await sharp(SRC_IMG).metadata();
const h = Math.round((m.width * 9) / 16);
const hero = await sharp(SRC_IMG).extract({ left: 0, top: Math.min(m.height - h, Math.round(m.height * 0.48)), width: m.width, height: h }).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
console.log(`hero ${m.width}x${m.height} -> 16:9`);
if (!PUBLISH && !SEND) { fs.writeFileSync(path.join(DIR, "hero-check.jpg"), hero); console.log("DRY RUN, gate passed; hero-check.jpg written"); process.exit(0); }

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`];
const ssh = (cmd, input) => execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

let postId = JSON.parse(wp(`post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`))[0]?.ID;
if (PUBLISH && !postId) {
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/ayvens-hero-${stamp}.jpg`, hero.toString("base64"));
  ssh(`base64 -d > /tmp/ayvens-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
  postId = Number(wp(
    `post create /tmp/ayvens-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${sq(TITLE)} --post_excerpt=${sq(META)} --post_name=${SLUG} --porcelain`
  ));
  const mediaId = wp(`media import /tmp/ayvens-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${sq("Fellten Charge Qube and an Ayvens electric van")} --alt=${sq(ALT)} --caption=${sq(CREDIT)} --porcelain`);
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/ayvens-hero-${stamp}.jpg /tmp/ayvens-body-${stamp}.html`);
  const art = await prisma.article.create({
    data: {
      siteId: site.id, title: TITLE, type: "pr_rewrite", status: "published", publishedAt: new Date(),
      sourceUrl: "https://chargeqube.com/", body: BODY, wpPostId: postId, category: "Electric & Charging",
      keyphrase: KEYPHRASE, metaDesc: META, qaPassed: true, imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:fellten",
    },
  });
  console.log(`published post ${postId}, media ${mediaId}, article ${art.id}`);
}
if (!postId) { console.log("nothing published yet"); await prisma.$disconnect(); process.exit(0); }
const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' '${URL}'`);
console.log(`post ${postId} ${status} ${URL} (HTTP ${code})`);

const MAIL = `Hi Flora,

Thanks for sending this over, and apologies for the slow reply. We have covered it on The Fleet Magazine:

${URL}

If Ayvens, Fellten or Bottle run a coverage or news page, a link to the article from there would be much appreciated. A standard followed link is all we need.

On the interview offer, yes please. Grid capacity is the question our readers keep running into, so a conversation with Mike Ellenthorpe would be welcome. The three things we would want to pin down are what a Charge Qube costs a fleet per month, what it delivers in kilowatts, and how long it takes to recharge from a typical depot supply.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;
if (/[—–]/.test(MAIL)) throw new Error("dash in email");
if (!SEND) { console.log("\n" + MAIL + "\n\n(email not sent)"); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish" || code !== "200") { console.error("not live, not sending"); process.exit(1); }

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${RELEASE_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const hh = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${MAIL.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, text) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(text, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const enc = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Cc: ${CC}`, `Subject: ${enc(/^re:/i.test(hh.subject) ? hh.subject : `Re: ${hh.subject}`)}`,
  `In-Reply-To: ${hh["message-id"]}`, `References: ${[hh.references, hh["message-id"]].filter(Boolean).join(" ")}`,
  "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "", part(b, "text/plain", MAIL), part(b, "text/html", HTML), `--${b}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || res.status); process.exit(1); }
console.log(`SENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
