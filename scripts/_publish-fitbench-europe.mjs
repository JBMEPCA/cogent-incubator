/**
 * One-off, 7 Oct 2026: FITBENCH's new European entity in Weil am Rhein, as a
 * Gym Business News news piece, published, then the live link sent back to
 * Nicky Jobson at PACE PR. JB: "upload this to gym and reply to their email".
 *
 * Came to jb@gymbusinessnews.com, not press@, so the press desk never saw it
 * (gmail 1a1154c75d5bde6d, 08:38 UK). Source is the attached
 * "FITBENCH_European Announcement.docx" (marked FINAL, no embargo). Its two
 * embedded images are the logo and a banner, so the photo is the one JB pasted
 * (2000x1500, already 4:3). The man in it matches Tyler Danen's headshot on
 * fitbench.com/pages/about; the woman is NOT identified, so only he is named.
 *
 * Quotes are the release's, word for word, including "dramatically improving".
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-fitbench-europe.mjs --photo=<jpg> [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");
const PHOTO = (process.argv.find((a) => a.startsWith("--photo=")) || "").slice(8);
if (!PHOTO || !fs.existsSync(PHOTO)) throw new Error("--photo=<jpg>");
const RELEASE_MSG = "1a1154c75d5bde6d";
const TO = "Nicky Jobson <nicky@pace-pr.co.uk>";

const GBN = "https://gymbusinessnews.com";
const FB = "https://www.fitbench.com/";
const TITLE = "FITBENCH opens German base after 60% international growth";
const SLUG = "fitbench-opens-german-base-after-60-international-growth";
const KEYPHRASE = "FITBENCH Europe";
const META =
  "FITBENCH has set up a European entity in Weil am Rhein, Germany, holding stock and parts locally after a 60% rise in international sales.";
const ALT = "FITBENCH founder and CEO Tyler Danen with a colleague outside a building carrying the FITBENCH sign";
const CREDIT = "Picture: FITBENCH";
const CAPTION = `FITBENCH founder and CEO Tyler Danen (right). ${CREDIT}`;
const CATEGORY_ID = 7; // Equipment & Fit-Out
const AUTHOR_ID = 2; // james-burke

const Q_TOM_1 = "Europe has become an increasingly important market for FITBENCH, and we’re seeing strong demand from both our distribution partners and customers across the region,";
const Q_TOM_2 = "Establishing a European entity is the natural next step for us. It allows us to put inventory closer to our customers, simplify the buying process and dramatically improving the speed at which we can deliver products and accessories.";
const Q_TYLER_1 = "This is about investing in the long-term growth of FITBENCH internationally.";
const Q_TYLER_2 = "We have built a strong brand in the U.S., and our international business is growing rapidly. The recent launches of FITRACK and FITBAG are a great reflection of where we’re taking the brand, developing innovative products that help operators make better use of their space, simplify the training experience and create more opportunities for members.";
const Q_TYLER_3 = "Europe represents a tremendous opportunity for us, and having a local operation gives us the infrastructure to support that growth properly.";
const QUOTES = [Q_TOM_1, Q_TOM_2, Q_TYLER_1, Q_TYLER_2, Q_TYLER_3];

const P = [
  `<a href="${FB}">FITBENCH</a>, the US maker of functional training equipment, has set up a European entity in Weil am Rhein, Germany, that will hold stock of its products and spare parts inside the EU. The company says the move follows a 60% year-on-year rise in international sales and growing demand from European distributors and customers.`,
  `Founder and CEO Tyler Danen will be Managing Director of the new operation. Holding inventory locally is meant to let FITBENCH trade across the EU without friction, cut order turnaround times and make replacement parts and accessories quicker to get hold of. Weil am Rhein sits on the German border with Switzerland and France.`,
  `"${Q_TOM_1}" said Tom Crampton, International Sales and Marketing Director at FITBENCH. "${Q_TOM_2}"`,
  `The German entity will work alongside FITBENCH's existing distributors, which already cover countries including Germany, France and the United Kingdom, while giving the company the option of selling direct to customers in EU markets. Design and manufacturing stay at its headquarters in Wisconsin.`,
  `"${Q_TYLER_1}" Danen said. "${Q_TYLER_2}"`,
  `FITRACK and FITBAG are the brand's two most recent launches. Danen tied the European set-up to that wider range: "${Q_TYLER_3}"`,
  `<strong>Why parts stock matters to an operator.</strong> For a gym or studio buying from an overseas brand, the purchase price is rarely the problem that hurts. The cost lands later, when a part fails and a rig sits taped off while a replacement crosses an ocean. FITBENCH's own case for Germany rests on exactly that, faster access to parts and accessories, and it is the right question for any operator to ask a supplier before signing, whoever the brand. Equipment is one of the largest lines in our guide to <a href="${GBN}/how-much-does-it-cost-to-open-a-gym-in-the-uk/">what it costs to open a gym in the UK</a>, and a long-lived kit decision, as <a href="${GBN}/nottingham-university-sticks-with-wattbike-after-8-years-what-it-tells-other-gym-operators/">Nottingham University's eight years with Wattbike</a> shows.`,
  `<strong>What to do next.</strong> If functional training kit is on your list, ask any supplier three things in writing: where its spare parts are physically held, the usual lead time for a replacement, and who services the equipment locally. UK operators should note that the new entity is built for EU trade; FITBENCH already lists a distribution partner in the United Kingdom, and that is who to ask about stock and support here.`,
];
const BODY = P.map((x) => `<p>${x}</p>`).join("\n\n") + `\n\n<p><em style="font-size:0.85em">${CREDIT}</em></p>`;

// ---- gate ----
const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[—–]/.test(TITLE + BODY + META + ALT + CAPTION)) problems.push("dash");
if (TITLE.length > 60) problems.push(`headline ${TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
let unquoted = plain;
for (const q of QUOTES) {
  if (!plain.includes(q)) problems.push(`quote not verbatim: ${q.slice(0, 40)}`);
  unquoted = unquoted.split(q).join(" ");
}
const banned = unquoted.match(/\b(leading|innovative|best-in-class|solutions?|cutting-edge)\b/gi);
if (banned) problems.push("supplier words outside quotes: " + banned.join(", "));
const words = plain.split(" ").length;
if (words < 300) problems.push(`too short ${words}`);
console.log(`title ${TITLE.length} | meta ${META.length} | words ${words} | ${QUOTES.length} quotes verbatim`);
if (problems.length) { console.error("GATE:", problems); process.exit(1); }

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32e6 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);
const db = forSite(site.id);

let postId = JSON.parse(wp(`post list --post_type=post --post_status=any --name=${SLUG} --fields=ID --format=json`))[0]?.ID;
if (PUBLISH && !postId) {
  const dupe = wp(`post list --post_type=post --post_status=any --s=FITBENCH --fields=ID --format=csv`).split("\n").slice(1).filter(Boolean);
  if (dupe.length) throw new Error(`a FITBENCH post already exists: ${dupe.join(",")}`);
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/fitbench-hero-${stamp}.jpg`, fs.readFileSync(PHOTO).toString("base64"));
  ssh(`base64 -d > /tmp/fitbench-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
  postId = Number(wp(
    `post create /tmp/fitbench-body-${stamp}.html --post_type=post --post_status=draft ` +
      `--post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} --post_title=${b64(TITLE)} ` +
      `--post_excerpt=${b64(META)} --post_name=${SLUG} --porcelain`
  ));
  const mediaId = wp(
    `media import /tmp/fitbench-hero-${stamp}.jpg --post_id=${postId} --featured_image ` +
      `--title=${b64("FITBENCH founder Tyler Danen")} --alt=${b64(ALT)} --caption=${b64(CAPTION)} --porcelain`
  );
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/fitbench-hero-${stamp}.jpg /tmp/fitbench-body-${stamp}.html`);
  ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);
  const art = await db.article.create({
    data: {
      siteId: site.id, title: TITLE, type: "pr_rewrite", status: "published", publishedAt: new Date(),
      sourceUrl: FB, body: BODY, wpPostId: postId, category: "Equipment & Fit-Out", keyphrase: KEYPHRASE,
      metaDesc: META, qaPassed: true, imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:fitbench",
    },
  });
  console.log(`published post ${postId}, media ${mediaId}, article ${art.id}`);
}
if (!postId) { console.log("DRY RUN, gate passed, nothing written"); await prisma.$disconnect(); process.exit(0); }

const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0 (CogentCheck)' '${URL}'`);
console.log(`post ${postId}: ${status}, ${URL}, HTTP ${code}`);

const REPLY = `Hi Nicky,

Thanks for sending this over, and yes, please do keep sending news directly. Fitness and sport brands are exactly what our readers want to hear about.

The FITBENCH story is live on Gym Business News now:

${URL}

If FITBENCH are able to share it, or link to it from their news or press pages, that would be much appreciated.

Best,
James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`;
console.log(`\n${REPLY}\n`);
if (/[—–]/.test(REPLY)) { console.error("dash in reply"); process.exit(1); }
if (!SEND) { console.log("reply NOT sent (no --send)"); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish" || code !== "200") { console.error("NOT SENT: post not live"); process.exit(1); }

const { outreachSender } = await import("../lib/gmail.js");
const { getGoogleAccessToken } = await import("../lib/google.js");
const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const already = await G(`messages?maxResults=5&q=${encodeURIComponent("in:sent to:nicky@pace-pr.co.uk")}`);
if ((already.messages || []).length) { console.error(`NOT SENT: already wrote to Nicky: ${already.messages.map((m) => m.id)}`); process.exit(1); }
const msg = await G(`messages/${RELEASE_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${REPLY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const bd = `mime-${Date.now().toString(36)}`;
const encSubj = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${encSubj}`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${bd}"`].join("\r\n"),
  "", part(bd, "text/plain", REPLY), part(bd, "text/html", HTML), `--${bd}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`NOT SENT: gmail ${out?.error?.message || res.status}`); process.exit(1); }
console.log(`SENT from ${sender.email}: gmail id ${out.id}, thread ${out.threadId}, subject "${subject}"`);
await prisma.$disconnect();
