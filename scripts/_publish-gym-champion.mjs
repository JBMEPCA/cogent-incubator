/**
 * Publish a Gym Champions draft, make it the homepage lead, record it, and
 * email the subject the live link in their own thread. JB, 8 Oct 2026: "make
 * Carter one live and email them back now, then make the Ferguson one live
 * tomorrow morning and email him tomorrow morning".
 *
 * Guards: refuses unless the post is a draft (so a rerun cannot re-date it);
 * the email refuses unless the page returns 200, the interview row has no
 * notifiedAt, and we have not written to them since their answers.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_publish-gym-champion.mjs <carter|ferguson> [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const PIECES = {
  carter: {
    postId: 134, targetId: "cmukzyx1r002f92os4dxnj1hp", email: "cartersgymnw@gmail.com", toName: "Hannah Carter",
    plainTitle: "Gym Champions: Carter's Gym owners on making weights feel welcoming",
    seoTitle: "Gym Champions: Carter's Gym on making weights welcoming",
    keyphrase: "weights gym", imageSource: "supplied:cartersgym",
    body: (url) => `Hi Hannah,

Thank you both for the answers, and for the photo. The piece is live now, and it is about you and Josh as joint owners, just as you asked. It is leading the Gym Business News homepage:

${url}

If Josh would like his surname in it, send it over and I will add it.

If you are able to share it, or link to it from the Carter's Gym website or social channels, that would be much appreciated.

Thanks again, and best wishes to Josh,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
  },
  ferguson: {
    postId: 141, targetId: "cmuv1sdfw0025a69v3xzedzjf", email: "fergusonfitness02@gmail.com", toName: "Matthew Ferguson",
    plainTitle: "Gym Champions: Matty Ferguson on a functional gym in Hexham",
    seoTitle: "Gym Champions: Matty Ferguson on a functional gym in Hexham",
    keyphrase: "functional fitness gym", imageSource: "supplied:fergusonfitnesshq",
    body: (url) => `Hi Matty,

Thank you for such thorough answers, and for the photo. The piece is live this morning, and it is leading the Gym Business News homepage:

${url}

If you are able to share it, or link to it from the Ferguson Fitness HQ website or social channels, that would be much appreciated.

Thanks again,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
  },
};

// JB, 9 Oct 2026: "looks good, publish and send to him".
PIECES.atlas = {
  postId: 156, targetId: "cmukzyx2x002h92os7mdjy9tq", email: "team@atlaskidsgym.co.uk", toName: "Ben Hutchings",
  plainTitle: "Gym Champions: Ben Hutchings on the business of kids fitness",
  seoTitle: "Gym Champions: Ben Hutchings on the business of kids fitness",
  keyphrase: "kids fitness business", imageSource: "supplied:atlaskidsgym",
  body: (url) => `Hi Ben,

Thank you for the answers, the extra detail on the Atlas Jnr Cup and Battersea, and the photos. The piece is live now, and it is leading the Gym Business News homepage:

${url}

If you are able to share it, or link to it from the Atlas Kids Gym website or social channels, that would be much appreciated.

Thanks again, and good luck with the arch,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
};

// JB, 9 Oct 2026 15:38 UK: "publish, email her at 4:10pm". Published at once;
// the email goes from a scheduled task with --email-only.
PIECES.grace = {
  postId: 162, targetId: "cmuv1sdnh002ja69vafjmvzvs", email: "gracewaltonfitness@gmail.com", toName: "Grace Walton",
  plainTitle: "Gym Champions: Grace Walton on a PT business built in a year",
  seoTitle: "Gym Champions: Grace Walton on a PT business built in a year",
  keyphrase: "personal trainer business", imageSource: "supplied:gracewaltonfitness",
  body: (url) => `Hi Grace,

Thank you for your answers and the photo, they were a pleasure to read. The piece is live now, and it is leading the Gym Business News homepage:

${url}

If you are able to share it, or link to it from your website or social channels, that would be much appreciated. Your Jog and Brew runners might enjoy it too.

Thanks again, and congratulations on the award,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
};

// JB, 14 Oct 2026: "publish and email". The answers came unsigned from the
// shared hello@ address that David wrote from earlier, so the email greets both.
PIECES.pop = {
  postId: 229, targetId: "cmuv1sdk7002da69vkk6kap0a", email: "hello@powerofpilates.co.uk", toName: "Power of Pilates",
  plainTitle: "Gym Champions: Claire Roberts on Pilates before the boom",
  seoTitle: "Gym Champions: Claire Roberts on Pilates before the boom",
  keyphrase: "Pilates studio business", imageSource: "supplied:powerofpilates",
  body: (url) => `Hi Claire and David,

Thank you for such generous answers, and for the photo. The piece is live now, and it is leading the Gym Business News homepage:

${url}

If you are able to share it, or link to it from the Power of Pilates website or social channels, that would be much appreciated. Your clients in Lower Earley and Crowthorne might enjoy it too.

Thanks again, and congratulations on the award,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
};

// JB, 16 Oct 2026: "publish and send".
PIECES.soma = {
  postId: 254, targetId: "cmv514a25002f10pgkd6hnjbh", email: "somadynamic23@gmail.com", toName: "Kevin Braddock",
  plainTitle: "Gym Champions: Kevin Braddock on a gym for mental health",
  seoTitle: "Gym Champions: Kevin Braddock on a gym for mental health",
  keyphrase: "gym for mental health", imageSource: "supplied:thesomaspace",
  body: (url) => `Hi Kevin,

Thank you for such thoughtful answers, and for the photo of you and Jo. The piece is live now, and it is leading the Gym Business News homepage:

${url}

If you are able to share it, or link to it from The Soma Space website or social channels, that would be much appreciated. It might be useful for the GPs and social prescribers who send people your way, too.

Thanks again, and best wishes to Jo,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`,
};

const key = process.argv[2];
const P = PIECES[key];
if (!P) throw new Error(`usage: <${Object.keys(PIECES).join("|")}> [--send]`);
const SEND = process.argv.includes("--send");
const PIN_DAYS = 14;

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, maxBuffer: 1 << 26 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const b64 = (x) => `"$(echo ${Buffer.from(x, "utf8").toString("base64")} | base64 -d)"`;
const wp = (args) => ssh(`cd ${sq(docroot)} && wp ${args}`);
const db = forSite(site.id);
const fail = async (why) => { console.error(`STOPPED: ${why}`); await prisma.$disconnect(); process.exit(1); };

// ---- publish ----
// --email-only: the piece is already live (published earlier by this script);
// send the email now. For a timed email after an immediate publish.
const EMAIL_ONLY = process.argv.includes("--email-only");
const before = wp(`post get ${P.postId} --field=post_status`);
if (EMAIL_ONLY ? before !== "publish" : before !== "draft") await fail(`post ${P.postId} is ${before}, expected ${EMAIL_ONLY ? "publish" : "draft"}`);
const gmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
if (!EMAIL_ONLY) {
  wp(`post meta update ${P.postId} _yoast_wpseo_title ${b64(P.seoTitle)}`);
  wp(`post update ${P.postId} --post_status=publish --post_date_gmt=${sq(gmt(new Date()))}`);
  wp(`post meta update ${P.postId} cogent_pin_until ${sq(gmt(new Date(Date.now() + PIN_DAYS * 86400000)))}`);
}
const status = wp(`post get ${P.postId} --field=post_status`);
const url = wp(`post url ${P.postId}`);
if (status !== "publish" || !/^https:\/\/gymbusinessnews\.com\/.+/.test(url)) await fail(`publish check: ${status} ${url}`);
if (!EMAIL_ONLY) ssh(`cd ${sq(docroot)} && (wp sg purge >/dev/null 2>&1 || true); wp cache flush >/dev/null 2>&1; true`);

const target = await db.interviewTarget.findUnique({ where: { id: P.targetId } });
if (!EMAIL_ONLY) {
const body = wp(`post get ${P.postId} --field=post_content`);
const data = {
  title: P.plainTitle, type: "case_study", status: "published", publishedAt: new Date(), body, wpPostId: P.postId,
  category: "Start & Grow", keyphrase: P.keyphrase, qaPassed: true, imageCredit: "Picture: supplied", imageSource: P.imageSource,
};
let article = target.articleId ? await db.article.findUnique({ where: { id: target.articleId } }) : null;
article = article ? await db.article.update({ where: { id: article.id }, data }) : await db.article.create({ data: { ...data, siteId: site.id } });
await db.interviewTarget.update({ where: { id: P.targetId }, data: { status: "published", publishedAt: new Date(), publishedUrl: url, articleId: article.id, error: null } });
}

const stamp = Date.now();
const page = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`${url}?nc=${stamp}`)}`);
const front = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' ${sq(`https://gymbusinessnews.com/?nc=${stamp}`)}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0 (CogentCheck)' ${sq(url)}`);
const leak = /&lt;span class=(&quot;|")franchise-eyebrow|%3Cspan%20class%3D/;
console.log({
  post: P.postId, url, http: code,
  bubbles: (page.match(/class="wp-block-quote interview-quote"/g) || []).length,
  css: (page.match(/gym-business-news\/style\.css\?ver=[0-9.]+/) || [])[0],
  homeLead: wp(`eval ${sq(`$q = new WP_Query(["post_type"=>"post","post_status"=>"publish","posts_per_page"=>1,"meta_key"=>"cogent_pin_until","orderby"=>"meta_value","order"=>"DESC","meta_query"=>[["key"=>"cogent_pin_until","value"=>gmdate("Y-m-d H:i:s"),"compare"=>">","type"=>"DATETIME"]]]); echo $q->posts ? $q->posts[0]->ID : "none";`)}`),
  leak: leak.test(page) || leak.test(front),
});

// ---- email ----
const BODY = P.body(url);
if (/[—–]/.test(BODY)) await fail("dash in email");
if (!SEND) { console.log(`\n${BODY}\n\nemail NOT sent (no --send)`); await prisma.$disconnect(); process.exit(0); }
if (code !== "200") await fail(`page returned ${code}, not emailing`);
if (target.notifiedAt) await fail(`already notified ${target.notifiedAt.toISOString()}`);

const { outreachSender } = await import("../lib/gmail.js");
const { getGoogleAccessToken } = await import("../lib/google.js");
const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const theirs = await G(`messages?maxResults=1&q=${encodeURIComponent(`from:${P.email}`)}`);
const last = theirs.messages?.[0];
if (!last) await fail(`no message from ${P.email} to reply to`);
const msg = await G(`messages/${last.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const sent = await G(`messages?maxResults=5&q=${encodeURIComponent(`in:sent to:${P.email}`)}`);
for (const m of sent.messages || []) {
  const d = await G(`messages/${m.id}?format=minimal`);
  if (Number(d.internalDate) > Number(msg.internalDate)) await fail(`already wrote to them after their last message: ${m.id}`);
}
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const bd = `mime-${Date.now().toString(36)}`;
const encSubj = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${P.toName} <${P.email}>`, `Subject: ${encSubj}`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${bd}"`].join("\r\n"),
  "", part(bd, "text/plain", BODY), part(bd, "text/html", HTML), `--${bd}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) await fail(`gmail ${out?.error?.message || res.status}`);
await db.interviewTarget.update({ where: { id: P.targetId }, data: { notifiedAt: new Date() } });
console.log(`SENT from ${sender.email} to ${P.email}: gmail ${out.id}, thread ${out.threadId}, "${subject}"`);
await prisma.$disconnect();
