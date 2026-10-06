/**
 * Tell Andy Gardner his Gym Champions piece is live. JB, 28 Sep 2026:
 * "get this online tomorrow at 9am, and email them then". Runs from the 09:00
 * UK 29 Sep scheduled task, after _publish-fitness-garage-interview.mjs.
 *
 * Replies in his own thread (his 28 Sep 14:15 answers), found by searching the
 * outreach mailbox for mail from his address. Own MIME so no List-Unsubscribe
 * chip on a one-to-one reply.
 *
 * Guards, because this runs unattended:
 *   - refuses unless post 62 is published and returns 200, checked over SSH
 *   - refuses if the interview row's notifiedAt is set (never twice; setting
 *     it also stops the sweep's own day-later "your piece is live" mail)
 *   - refuses if we have already written to him since his reply
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-fitness-garage-live.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const SEND = process.argv.includes("--send");
const POST_ID = 62;

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { outreachSender } = await import("../lib/gmail.js");
const { getGoogleAccessToken } = await import("../lib/google.js");

const site = await prisma.site.findUnique({ where: { slug: "gym-business-news" } });
const { creds } = await siteCredentials(site.id);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: { contains: "fitnessgarage" } } });
const refuse = async (why) => { console.error(`NOT SENT: ${why}`); await prisma.$disconnect(); process.exit(1); };
const EMAIL = target.email;
if (!EMAIL) await refuse("no email on the interview row");

const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && ${cmd}`],
    { encoding: "utf8", timeout: 120000 }).trim();
const status = ssh(`wp post get ${POST_ID} --field=post_status`);
const URL = ssh(`wp post url ${POST_ID}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' '${URL}'`);
console.log(`post ${POST_ID}: ${status}, ${URL}, HTTP ${code} from the server`);

const BODY = `Hi Andy,

Thank you for the answers and for the photos of you and Steve. The piece is live this morning, and it is leading the Gym Business News homepage:

${URL}

It barely needed touching. If you are able to share it, or link to it from the Fitness Garage website or social channels, that would be much appreciated.

Thanks again, and best wishes to Steve,

James Burke
Publisher, Gym Business News
https://gymbusinessnews.com`;

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const theirs = await G(`messages?maxResults=5&q=${encodeURIComponent(`from:${EMAIL} after:2026/09/27`)}`);
const replyTo = theirs.messages?.[0];
console.log(`from ${sender.email} to ${EMAIL}; replying to message ${replyTo?.id || "NONE"}`);
console.log(`\n${BODY}\n`);

if (/[—–]/.test(BODY)) await refuse("dash in copy");
if (!replyTo) await refuse(`no message from ${EMAIL} found to reply to`);
if (!SEND) { console.log("DRY RUN: nothing sent."); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish" || code !== "200" || !/^https:\/\/gymbusinessnews\.com\/.+/.test(URL)) await refuse(`post not live (${status}, HTTP ${code})`);
if (target.notifiedAt) await refuse(`already notified at ${target.notifiedAt.toISOString()}`);

const msg = await G(`messages/${replyTo.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const sent = await G(`messages?maxResults=5&q=${encodeURIComponent(`in:sent to:${EMAIL} after:2026/09/28`)}`);
const later = [];
for (const m of sent.messages || []) {
  const d = await G(`messages/${m.id}?format=minimal`);
  if (Number(d.internalDate) > Number(msg.internalDate)) later.push(m.id);
}
if (later.length) await refuse(`already wrote to him after his reply: ${later.join(",")}`);

const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${target.personName} <${EMAIL}>`, `Subject: ${subject}`, `In-Reply-To: ${h["message-id"]}`,
  `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "", part(b, "text/plain", BODY), part(b, "text/html", HTML), `--${b}--`, ""].join("\r\n");

const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) await refuse(`gmail ${out?.error?.message || res.status}`);
await db.interviewTarget.update({ where: { id: target.id }, data: { notifiedAt: new Date() } });
console.log(`SENT: gmail id ${out.id}, thread ${out.threadId}. notifiedAt set.`);
await prisma.$disconnect();
