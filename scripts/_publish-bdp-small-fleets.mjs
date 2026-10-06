/**
 * One-off, 21 Sep 2026: Business Data Prospects small-fleet research, as a
 * Fleet news piece, published, then the live link sent back to BDP with a
 * link ask. JB: "make and send back to them for fleet".
 *
 * Source is the "(Final)" release of 21 Sep 12:21 to press@. The first send
 * seven minutes earlier had a cover note that disagreed with its own body
 * (21,673 records, two-thirds under 10 vehicles); the Final fixes the note.
 * Its SUBJECT still says two-thirds are under 25 vehicles while the body says
 * 57% under 25 and two-thirds under 50, so only body figures are used, every
 * one attributed to BDP.
 *
 * The data is BDP's own sales database, not a census, and the piece says so.
 *
 * Image: their attachment is a circular cut-out on white, useless as a 16:9
 * hero, so the largest 16:9 frame inside the circle is used.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *   scripts/_publish-bdp-small-fleets.mjs --dir=<dir with bdp-hero.jpg> [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");
const DIR = (process.argv.find((a) => a.startsWith("--dir=")) || "").split("=")[1];
const HERO = path.join(DIR, "bdp-hero.jpg");
const RELEASE_MSG = "1a0c3e9d7208c28e"; // the (Final) send
const TO = "Adam Middleton <contactus@bdpagency.com>";

const FLEET = "https://thefleetmagazine.co.uk";
const BDP = "https://www.bdpagency.com/";
const TITLE = "Typical UK Fleet Runs Just Five Vehicles, BDP Data Shows";
const SLUG = "typical-uk-fleet-runs-just-five-vehicles-bdp-data-shows";
const KEYPHRASE = "small fleets";
const META =
  "Business Data Prospects analysed 33,601 UK fleet records: the median known fleet runs five vehicles, and small fleets reach far beyond transport.";
const ALT = "A row of white trucks parked in a logistics yard";
const CREDIT = "Picture: Business Data Prospects";
const CATEGORY_ID = 9; // News
const AUTHOR_ID = 4;

const P = [
  `The typical fleet in Business Data Prospects' UK fleet database runs five vehicles. The <a href="${BDP}">UK business data provider</a> analysed 33,601 fleet-related records it holds and found the median known fleet size was five, with around 57% of records that carried a vehicle count running between one and 25 vehicles.`,

  `Of the 33,601 records, 25,732 included a vehicle count and a further 5,941 were identified as fleet operators without one. Among those with a count, around two-thirds ran fewer than 50 vehicles and around 31% ran 50 or more. The largest single group was businesses running two to four vehicles, about a third of records with a known fleet size, followed by those running five to nine.`,

  `The figures come from BDP's own database of fleet decision-makers, which it sells to suppliers, rather than from an official count of UK fleets. They are best read as the shape of the market rather than its size.`,

  `<strong>Most small fleets are not in transport.</strong> Road freight was the largest single business activity in the data, but fleet-related records ran across manufacturing, construction, wholesale, engineering, food production, agriculture, waste management and property services. BDP found fleet activity in civil engineering, machinery hire, building materials, food distribution and waste collection, businesses where vehicles support the work rather than being the work.`,

  `The records were also spread across the country. The largest concentrations were in the South East, the North West, the West Midlands, Yorkshire and the Humber, the East of England and the East Midlands, with London a smaller share than several of those regions.`,

  `<strong>Five vans, same obligations.</strong> For a business running five vehicles, the fleet is rarely anyone's full-time job. BDP notes that in smaller organisations responsibility for vehicles often sits inside a broader operational role, while the practical issues are the same as for a large operator: acquisition, maintenance, fuel and energy costs, insurance, driver management, compliance and the move to lower-emission vehicles. The duty of care does not shrink with the fleet, and neither does the exposure from staff using their own cars, which we covered in <a href="${FLEET}/grey-fleet-the-duty-of-care-employers-keep-ignoring/">grey fleet and the duty of care employers keep ignoring</a>.`,

  `<strong>What to do next.</strong> If your business runs a handful of vehicles, name one person as accountable for them, even if it is only part of their job. Check that anyone driving their own car on business has business use on their insurance. And before replacing a van, run the numbers on electric against diesel using our <a href="${FLEET}/diesel-vs-electric-van-running-costs-2026-the-real-uk-comparison/">van running cost comparison</a>, or look at what a <a href="${FLEET}/salary-sacrifice-van-scheme-uk-what-it-costs-employers/">salary sacrifice van scheme</a> would cost you.`,
];
const BODY = P.map((x) => `<p>${x}</p>`).join("\n\n") + `\n\n<p><em style="font-size:0.85em">${CREDIT}</em></p>`;

const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[—–]/.test(TITLE + BODY + META)) problems.push("dash");
if (TITLE.split(":")[0].trim().length > 65) problems.push(`headline ${TITLE.length} > 65`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
const banned = plain.match(/\b(leading|innovative|best-in-class|solutions?)\b/gi);
if (banned) problems.push("supplier words: " + banned.join(", "));
const words = plain.split(" ").length;
if (words < 300) problems.push(`too short ${words}`);
console.log(`title ${TITLE.length} | meta ${META.length} | words ${words}`);
if (problems.length) { console.error("GATE:", problems); process.exit(1); }

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
  ssh(`base64 -d > /tmp/bdp-hero-${stamp}.jpg`, fs.readFileSync(HERO).toString("base64"));
  ssh(`base64 -d > /tmp/bdp-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
  postId = Number(wp(
    `post create /tmp/bdp-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${sq(TITLE)} --post_excerpt=${sq(META)} --post_name=${SLUG} --porcelain`
  ));
  const mediaId = wp(`media import /tmp/bdp-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${sq("Business Data Prospects fleet research")} --alt=${sq(ALT)} --caption=${sq(CREDIT)} --porcelain`);
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/bdp-hero-${stamp}.jpg /tmp/bdp-body-${stamp}.html`);
  const art = await prisma.article.create({
    data: {
      siteId: site.id, title: TITLE, type: "pr_rewrite", status: "published", publishedAt: new Date(),
      sourceUrl: BDP, body: BODY, wpPostId: postId, category: "News", keyphrase: KEYPHRASE, metaDesc: META,
      qaPassed: true, imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:bdp",
    },
  });
  console.log(`published post ${postId}, media ${mediaId}, article ${art.id}`);
}

if (!postId) { console.log("DRY RUN, gate passed, nothing written"); await prisma.$disconnect(); process.exit(0); }
const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
console.log(`post ${postId} ${status} ${URL}`);

// ---- send the link back ----
const MAIL = `Hi Adam,

Thanks for sending the research over. We have covered it on The Fleet Magazine, leading on the five-vehicle median:

${URL}

If you publish the research on your own site or news page, a link to the article would be much appreciated. A standard followed link is all we need.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;
if (/[—–]/.test(MAIL)) throw new Error("dash in email");
if (!SEND) { console.log("\n" + MAIL + "\n\n(email not sent)"); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish") { console.error("not published, not sending"); process.exit(1); }

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${RELEASE_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${MAIL.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const enc = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${enc(`Re: ${h.subject}`)}`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
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
