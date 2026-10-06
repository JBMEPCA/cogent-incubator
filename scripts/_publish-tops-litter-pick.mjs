/**
 * One-off, 25 Sep 2026: Tops Day Nurseries company-wide litter pick, as a
 * Nursery Daily news piece, published, then the live link sent back to Ellen
 * Wentworth at Tops. JB: "please upload this to Nursery and email".
 *
 * The press desk SKIPPED this one at 11:31 UK on 24 Sep, a minute after it
 * landed at press@nurserydaily.com, scoring it 4/10 "CSR activity (litter
 * pick) with no business news hook". JB is overriding that, so the rewrite has
 * to carry an operator angle the release itself does not have: what the
 * activity costs a setting and what it returns.
 *
 * Source is the 24 Sep 11:30 UK release (gmail 1a0d2f77f413ff7b). The .docx
 * attached to it holds SEVEN versions, the national one JB pasted plus six
 * regional cuts (Dorset, Devon, Hampshire, Wiltshire, Somerset, Newport).
 * Those are for local press; this is one national piece, and the regional cuts
 * are used only as sourcing for the settings named and the Lymington figure.
 * The 19 is counted off those six cuts: Dorset 7, Devon 4, Hampshire 3,
 * Wiltshire 3, Somerset 1, Newport 1.
 *
 * PHOTO: the email carried three real pictures. Poole.jpg (1500x2000) and
 * Pokesdown 3.jpg (336x480) both show children, which this title's editorial
 * standard forbids outright, so the ONLY usable frame is the Southbourne hub
 * beach shot at 640x480. It is adults only and already 4:3, so it needs no
 * crop, but it is soft for a hero and the reply asks Ellen for the original.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-tops-litter-pick.mjs [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");

const PHOTO =
  "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/" +
  "13931df9-9f45-45d6-95a9-6eb638f11d41/scratchpad/photos/Tops-Litter-Pick-2026.jpg";
const RELEASE_MSG = "1a0d2f77f413ff7b";
const TO = "Ellen Wentworth <ellen.wentworth@topsdaynurseries.co.uk>";

const ND = "https://nurserydaily.com";
const TOPS = "https://www.topsdaynurseries.co.uk";
const TITLE = "Tops Day Nurseries litter pick: 19 settings, six counties";
const SLUG = "tops-day-nurseries-litter-pick-19-settings-six-counties";
const KEYPHRASE = "Tops Day Nurseries litter pick";
const META =
  "Tops Day Nurseries ran a company-wide litter pick on 18 September, with teams from 19 settings across six counties and its Southbourne hub on the beach.";
const ALT =
  "Eight Tops Day Nurseries colleagues standing on a beach holding full bags of collected litter";
const CAPTION =
  "Colleagues from the Tops Day Nurseries hub in Southbourne at their local beach. Picture: Tops Day Nurseries";
const CREDIT = "Picture: Tops Day Nurseries";
const CATEGORY_ID = 2; // News
const AUTHOR_ID = 2; // james-burke

const P = [
  `Tops Day Nurseries sent children and colleagues from 19 of its settings out to collect litter on Friday 18 September, in a company-wide litter pick covering six counties. <a href="${TOPS}">Tops Day Nurseries</a>, an early years provider operating across the South and Southwest of England, put teams into parks, woodland, riverside paths and residential streets, while colleagues from its hub in Southbourne, Dorset, worked their local beach.`,

  `Activity ran across Dorset, Devon, Hampshire, Wiltshire, Somerset and the Isle of Wight, with each nursery picking its own patch. Dorset fielded the largest group: Wareham, Corfe Mullen, Poole, Muscliff, Parkstone and Pokesdown, joined by the Tops nursery at Royal Bournemouth Hospital. In Devon, Bretonside took Plymouth Hoe, Devonport ran morning and afternoon picks in Devonport Park, and Stonehouse went to Victoria Park. Lymington alone put 16 litter pickers into Woodside, Havant took Havant Park and Winchester worked the nursery gardens off Romsey Road. Musgrove covered Galmington Park, and Newport took the riverside cycle path.`,

  `Sandy Kemish, Sustainability and Data Manager at Tops Day Nurseries, said: "Sustainability is something we want children to experience and understand through their everyday lives, rather than simply learn about as an abstract idea. Taking part in a litter pick gives children the opportunity to see how their own actions can make a real difference to the places around them. It was fantastic to see so many of our nurseries getting involved across the South and Southwest and caring for the communities they are part of."`,

  `<strong>Close to the cheapest marketing a setting has.</strong> Strip out the sustainability framing and a litter pick is one of the few things a nursery can run that costs almost nothing and still produces something publishable: a local space visibly improved, a set of photographs, and a reason for people within pram-pushing distance to hear the setting's name. The bill is tabards, pickers, gloves and a risk assessment, and it can usually sit inside the outing routine a setting already operates rather than needing a day of its own.`,

  `The larger groups are increasingly putting this kind of work on the record. Bright Horizons had <a href="${ND}/bright-horizons-eco-schools-award-68-nurseries-get-green-flag/">68 of its nurseries awarded the Eco-Schools Early Years Green Flag</a> for 2025-26, with five named in a national impact report. Tops says it is a Queen's Award winner and describes itself as one of the most sustainable day nurseries in the UK, and frames the litter pick as part of a commitment it calls growing minds for a greener future. Neither carries any weight with <a href="https://www.gov.uk/government/organisations/ofsted">Ofsted</a>, which is the point: this is a parent-facing and community-facing asset, not a compliance one.`,

  `<strong>What to do next.</strong> If you want the same return from an afternoon, choose a space within walking distance, tell the local paper and your parent list before you go rather than after, and settle in advance which photographs you actually have permission to publish, because the picture of the tidy park and the staff team will travel further than the one you cannot use. Settings weighing environmental accreditation against everything else pulling at the budget can start from what a funded place has to carry, in our breakdown of <a href="${ND}/early-years-funding-rates-2026-27-what-every-council-pays/">early years funding rates for 2026-27</a>.`,
];

const BODY =
  P.map((x) => `<p>${x}</p>`).join("\n\n") +
  `\n\n<p><em style="font-size:0.85em">${CREDIT}</em></p>`;

// ---- gate ----
const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[\u2014\u2013]/.test(TITLE + BODY + META + ALT + CAPTION)) problems.push("dash");
if (TITLE.length > 60) problems.push(`headline ${TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
const banned = plain.match(/\b(leading|innovative|best-in-class|solutions?)\b/gi);
if (banned) problems.push("supplier words: " + banned.join(", "));
const words = plain.split(" ").length;
if (words < 300) problems.push(`too short ${words}`);
// The quote must survive verbatim.
const QUOTE =
  'Sustainability is something we want children to experience and understand through their everyday lives, rather than simply learn about as an abstract idea. Taking part in a litter pick gives children the opportunity to see how their own actions can make a real difference to the places around them. It was fantastic to see so many of our nurseries getting involved across the South and Southwest and caring for the communities they are part of.';
if (!plain.includes(QUOTE)) problems.push("Kemish quote not verbatim");
console.log(`title ${TITLE.length} | meta ${META.length} | words ${words} | quote verbatim`);
if (problems.length) {
  console.error("GATE:", problems);
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "nursery-daily" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const sshArgs = [
  "-i", s.privateKeyPath.replace(/^~/, os.homedir()),
  "-o", "BatchMode=yes",
  "-p", String(s.port || 18765),
  `${s.username}@${s.host}`,
];
const ssh = (cmd, input) =>
  execFileSync("ssh", [...sshArgs, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);

let postId = JSON.parse(
  wp(`post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`)
)[0]?.ID;

if (PUBLISH && !postId) {
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/tops-hero-${stamp}.jpg`, fs.readFileSync(PHOTO).toString("base64"));
  ssh(`base64 -d > /tmp/tops-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
  postId = Number(
    wp(
      `post create /tmp/tops-body-${stamp}.html --post_type=post --post_status=draft ` +
        `--post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} ` +
        `--post_excerpt=${sq(META)} --post_name=${SLUG} --porcelain`
    )
  );
  const mediaId = wp(
    `media import /tmp/tops-hero-${stamp}.jpg --post_id=${postId} --featured_image ` +
      `--title=${sq("Tops Day Nurseries beach litter pick")} --alt=${sq(ALT)} --caption=${sq(CAPTION)} --porcelain`
  );
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/tops-hero-${stamp}.jpg /tmp/tops-body-${stamp}.html`);

  const art = await prisma.article.create({
    data: {
      siteId: site.id,
      title: TITLE,
      type: "pr_rewrite",
      status: "published",
      publishedAt: new Date(),
      sourceUrl: TOPS,
      body: BODY,
      wpPostId: postId,
      category: "News",
      keyphrase: KEYPHRASE,
      metaDesc: META,
      qaPassed: true,
      imageAlt: ALT,
      imageCredit: CREDIT,
      imageSource: "press:tops-day-nurseries",
    },
  });
  console.log(`published post ${postId}, media ${mediaId}, article ${art.id}`);
}

if (!postId) {
  console.log("DRY RUN, gate passed, nothing written");
  await prisma.$disconnect();
  process.exit(0);
}
const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
console.log(`post ${postId} ${status} ${URL}`);

// ---- reply to Ellen ----
const MAIL = `Hi Ellen,

Thanks for sending this over. It is live on Nursery Daily:

${URL}

We have written it up rather than run the release as sent, and angled it at nursery owners and managers, so it leads on the scale of it, 19 settings across six counties, and what an activity like this costs a setting to run. Sandy Kemish's quote is word for word.

One thing that would help us next time. Nursery Daily does not publish photographs of children, so of the three pictures you attached we could only use the beach shot of the hub team. If you have a higher resolution copy of that one it would be worth sending, because at 640 by 480 it is a little soft at the size we run images. More generally, a couple of frames showing the team, the site or the filled bags without children in them will always get used.

If the release goes up on your own news page, a link back to the article would be much appreciated. A standard followed link is all we need.

Best,

James Burke
Publisher, Nursery Daily
${ND}`;

if (/[\u2014\u2013]/.test(MAIL)) throw new Error("dash in email");
if (!SEND) {
  console.log("\n" + MAIL + "\n\n(email not sent, add --send)");
  await prisma.$disconnect();
  process.exit(0);
}
if (status !== "publish") {
  console.error("not published, not sending");
  process.exit(1);
}

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const msg = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${RELEASE_MSG}` +
    `?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${MAIL.split(
  /\n\n+/
)
  .map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;
const part = (b, type, body) =>
  [
    `--${b}`,
    `Content-Type: ${type}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
  ].join("\r\n");
const enc = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
const b = `mime-${Date.now().toString(36)}`;
const raw = [
  [
    `From: ${sender.name} <${sender.email}>`,
    `To: ${TO}`,
    `Subject: ${enc(`Re: ${h.subject}`)}`,
    `In-Reply-To: ${h["message-id"]}`,
    `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${b}"`,
  ].join("\r\n"),
  "",
  part(b, "text/plain", MAIL),
  part(b, "text/html", HTML),
  `--${b}--`,
  "",
].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", out?.error?.message || res.status);
  process.exit(1);
}
console.log(`SENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
