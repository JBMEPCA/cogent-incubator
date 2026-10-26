/**
 * One-off, 20 Oct 2026: Output Sports and Centr partnership, as a Gym Business
 * News news piece, published, then a reply to Katie Lewis (Brandchatter) in her
 * own thread. JB: "Get this PR on gym and email them as they sent nice email".
 *
 * Source: gmail 1a1553b37144819a, 19 Oct 18:34 UK, to jb@gymbusinessnews.com
 * (so the press desk never saw it). No embargo. Her covering note introduces
 * herself and lists nine sector clients she can supply news for. Photo is the
 * attached CENTR_OutputSports.jpg, 1920x1080, used as supplied.
 *
 * Rewritten, not reprinted; quotes word for word. Sugerman's second quote has
 * no full stop in the release; one is added outside the verbatim check.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_publish-output-sports-centr.mjs --photo=<jpg> [--publish] [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const PUBLISH = process.argv.includes("--publish");
const SEND = process.argv.includes("--send");
const PHOTO = (process.argv.find((a) => a.startsWith("--photo=")) || "").slice(8);
if (!PHOTO || !fs.existsSync(PHOTO)) throw new Error("--photo=<jpg>");
const RELEASE_MSG = "1a1553b37144819a";
const TO = "Katie Lewis <katie.lewis@brandchatter.co.uk>";

const GBN = "https://gymbusinessnews.com";
const OUT = "https://www.outputsports.com/";
const CENTR = "https://www.centr.com/";
const TITLE = "Output Sports and Centr bring HYROX testing to gyms";
const SLUG = "output-sports-and-centr-bring-hyrox-testing-to-gyms";
const KEYPHRASE = "HYROX performance testing";
const META =
  "Output Sports has partnered with Centr, HYROX's official equipment provider, to bring athlete testing and a HYROX Conditioning Score into gyms.";
const ALT = "An athlete throws a medicine ball in a HYROX training space fitted with Centr equipment, with a HYROX Score of 75 out of 100 shown on screen";
const CREDIT = "Picture: Centr and Output Sports";
const CATEGORY_ID = 6; // Tech & Software
const AUTHOR_ID = 2;

const Q_MOR_1 = "HYROX athletes are increasingly looking beyond race times and subjective feedback to understand exactly how they are progressing and how they can adapt their training to optimise performance,";
const Q_MOR_2 = "Centr has created the equipment to replicate the demands of HYROX, while Output provides the testing, objective data and performance insight to help athletes understand what that training is delivering.";
const Q_SUG_1 = "Centr is built on performance. Whether athletes are training in a commercial gym or at home, we want to help them achieve their training goals. Partnering with Output Sports adds the objective data that shows athletes and coaches exactly what that training is delivering.";
const Q_SUG_2 = "The combination is what matters: the right equipment and the right technology. Testing shows an athlete where they stand; a critical part of training for a HYROX race";
const QUOTES = [Q_MOR_1, Q_MOR_2, Q_SUG_1, Q_SUG_2];

const P = [
  `<a href="${OUT}">Output Sports</a>, the sports science technology company, has partnered with <a href="${CENTR}">Centr</a>, the Official Equipment Provider to HYROX, to bring athlete testing into gyms that train for the fitness race. The deal puts Output's testing technology alongside Centr's competition-standard equipment, so athletes, and the facilities that coach them, can plan training around measured data rather than guesswork.`,
  `At its centre is Output's HYROX Conditioning Test. Built with HYROX365, the sport's training and education arm, for which Output is the official athlete testing and benchmarking partner, it measures aerobic capacity, muscular endurance and power, and turns the results into a HYROX Conditioning Score. Strength, power and movement assessments sit alongside it.`,
  `The companies say testing should end in a plan rather than a number. Each athlete's profile points to the programming and equipment that will move them on, so the result changes what they do in their next session.`,
  `"${Q_MOR_1}" said Martin O'Reilly, Founder of Output Sports. "${Q_MOR_2}"`,
  `Centr's side of the deal is its HYROX equipment, its global commercial distribution and its connected training system, in which equipment, programming and coaching are designed to work together.`,
  `"${Q_SUG_1}" said Andrew Sugerman, CEO of Centr. "${Q_SUG_2}."`,
  `<strong>What it means for gym operators.</strong> The release is explicit that the demand is not only coming from athletes. Gyms need a credible way to assess members, match them to the right training and show progress over time, and a recognised score gives a HYROX zone something a set of racks and rowers cannot: a reason to come back and retest. HYROX has become one of the strongest pulls in independent fitness, from the <a href="${GBN}/hfa-and-hyrox-join-forces-for-2027-show-100-tickets-what-it-means-for-uk-gyms/">HFA show partnership</a> to the <a href="${GBN}/gym-champions-ben-hutchings-on-the-business-of-kids-fitness/">kids clubs built around it</a>.`,
  `<strong>Next steps.</strong> If you already run HYROX classes or a training zone, it is worth asking Output Sports and Centr what testing would cost per member and how results feed back to your coaches, because neither company has published pricing. A retest every few months is also a natural moment to talk to a member about their next block of training, and about renewing.`,
];
const BODY = P.map((x) => `<p>${x}</p>`).join("\n\n") + `\n\n<p><em style="font-size:0.85em">${CREDIT}</em></p>`;

const plain = BODY.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const problems = [];
if (/[—–]/.test(TITLE + BODY + META + ALT)) problems.push("dash");
if (TITLE.length > 60) problems.push(`headline ${TITLE.length} > 60`);
if (META.length > 155) problems.push(`meta ${META.length} > 155`);
let unquoted = plain;
for (const q of QUOTES) { if (!plain.includes(q)) problems.push(`quote not verbatim: ${q.slice(0, 40)}`); unquoted = unquoted.split(q).join(" "); }
const banned = unquoted.match(/\b(leading|innovative|best-in-class|solutions?|cutting-edge|world-class)\b/gi);
if (banned) problems.push("supplier words outside quotes: " + banned.join(", "));
const words = plain.split(" ").length;
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
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd '${docroot}' && wp ${args}`);
const db = forSite(site.id);

let postId = Number(wp(`post list --post_type=post --post_status=any --s="Output Sports" --fields=ID --format=csv`).split("\n")[1] || 0) || null;
if (PUBLISH && !postId) {
  const stamp = Date.now();
  ssh(`base64 -d > /tmp/output-hero-${stamp}.jpg`, fs.readFileSync(PHOTO).toString("base64"));
  ssh(`base64 -d > /tmp/output-body-${stamp}.html`, Buffer.from(BODY, "utf8").toString("base64"));
  postId = Number(wp(
    `post create /tmp/output-body-${stamp}.html --post_type=post --post_status=draft --post_author=${AUTHOR_ID} --post_category=${CATEGORY_ID} ` +
      `--post_title=${b64(TITLE)} --post_excerpt=${b64(META)} --post_name=${SLUG} --porcelain`
  ));
  const mediaId = wp(`media import /tmp/output-hero-${stamp}.jpg --post_id=${postId} --featured_image --title=${b64("Output Sports and Centr HYROX testing")} --alt=${b64(ALT)} --caption=${b64(CREDIT)} --porcelain`);
  wp(`post meta update ${postId} _yoast_wpseo_metadesc ${b64(META)}`);
  wp(`post meta update ${postId} _yoast_wpseo_focuskw ${b64(KEYPHRASE)}`);
  wp(`post update ${postId} --post_status=publish`);
  ssh(`rm -f /tmp/output-hero-${stamp}.jpg /tmp/output-body-${stamp}.html`);
  ssh(`cd '${docroot}' && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);
  const art = await db.article.create({ data: {
    siteId: site.id, title: TITLE, type: "pr_rewrite", status: "published", publishedAt: new Date(), sourceUrl: OUT, body: BODY,
    wpPostId: postId, category: "Tech & Software", keyphrase: KEYPHRASE, metaDesc: META, qaPassed: true, imageAlt: ALT, imageCredit: CREDIT, imageSource: "press:outputsports",
  } });
  console.log(`published post ${postId}, media ${mediaId}, article ${art.id}`);
}
if (!postId) { console.log("DRY RUN, gate passed, nothing written"); await prisma.$disconnect(); process.exit(0); }

const status = wp(`post get ${postId} --field=post_status`);
const URL = wp(`post url ${postId}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0 (CogentCheck)' '${URL}'`);
console.log(`post ${postId}: ${status}, ${URL}, HTTP ${code}`);

const REPLY = `Hi Katie,

Thank you, that is very kind of you, and you are not late at all. We are still a young title, so it is lovely to hear from you.

The Output Sports and Centr story is live on Gym Business News now:

${URL}

If Output Sports or Centr are able to share it, or link to it from their news pages, that would be much appreciated.

Your client list is a great fit for our readers, so please do keep the news coming. For anything time sensitive, press@gymbusinessnews.com is the quickest way in, as releases sent there are turned around within the hour.

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
const already = await G(`messages?maxResults=5&q=${encodeURIComponent("in:sent to:katie.lewis@brandchatter.co.uk")}`);
if ((already.messages || []).length) { console.error(`NOT SENT: already wrote to Katie: ${already.messages.map((m) => m.id)}`); process.exit(1); }
const msg = await G(`messages/${RELEASE_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${REPLY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const bd = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${bd}"`].join("\r\n"),
  "", part(bd, "text/plain", REPLY), part(bd, "text/html", HTML), `--${bd}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`NOT SENT: gmail ${out?.error?.message || res.status}`); process.exit(1); }
console.log(`SENT from ${sender.email}: gmail id ${out.id}, thread ${out.threadId}, "${subject}"`);
await prisma.$disconnect();
