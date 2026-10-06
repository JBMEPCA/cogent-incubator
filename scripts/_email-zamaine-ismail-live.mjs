/**
 * Tell Zamaine Ismail his In the Chair piece is live. JB, 29 Sep 2026:
 * publish it, email them at 12pm.
 *
 * Reply in his own thread, to his 29 Sep 09:37 message. Own MIME so a
 * one-to-one reply carries no List-Unsubscribe chip.
 *
 * Guards, because this runs unattended on a scheduled task:
 *   - refuses unless post 879 is published and returns 200, checked over SSH
 *     on the server (a local curl can hit the SiteGround captcha)
 *   - refuses if notifiedAt is set, so it cannot send twice, and setting it
 *     stops the hourly sweep sending its own backlink ask a day later
 *   - refuses if anything has already gone to info@westandhunter.com today
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-zamaine-ismail-live.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const SEND = process.argv.includes("--send");
const POST_ID = 879;
const TO = "Zamaine Ismail <info@westandhunter.com>";
const REPLY_TO_MSG = "1a0ec5057ed3355a";

const { prisma, forSite } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const { outreachSender } = await import("../lib/gmail.js");
const { getGoogleAccessToken } = await import("../lib/google.js");

const site = await prisma.site.findUnique({ where: { slug: "barbering-business" } });
const { creds } = await siteCredentials(site.id);
const db = forSite(site.id);
const target = await db.interviewTarget.findFirst({ where: { companyDomain: "westandhunter.com" } });
const refuse = async (why) => { console.error(`NOT SENT: ${why}`); await prisma.$disconnect(); process.exit(1); };

const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && ${cmd}`],
    { encoding: "utf8", timeout: 120000 }).trim();
const status = ssh(`wp post get ${POST_ID} --field=post_status`);
const URL = ssh(`wp post url ${POST_ID}`);
const code = ssh(`curl -s -o /dev/null -w '%{http_code}' '${URL}'`);
console.log(`post ${POST_ID}: ${status}, ${URL}, HTTP ${code} from the server`);

const BODY = `Hi Zamaine,

Thank you for the answers, they were a pleasure to work with. Your piece is live on Barbering Business:

${URL}

The lead picture is the shopfront shot of the team. If you would still like to send a high resolution photograph of yourself, I will swap it in.

Two things that would help if you have a moment. Share it if it is useful, and if you keep a press page, a link to it from there is the only thing I will ask you for.

Best,

James Burke
Publisher, Barbering Business
https://barberingbusiness.com`;
console.log(`\n${BODY}\n`);

if (/[—–]/.test(BODY)) await refuse("dash in copy");
if (!SEND) { console.log("DRY RUN: nothing sent."); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish" || code !== "200" || !/^https:\/\/barberingbusiness\.com\/.+/.test(URL)) await refuse(`post not live (${status}, HTTP ${code})`);
if (target.notifiedAt) await refuse(`already notified at ${target.notifiedAt.toISOString()}`);

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const sent = await G(`messages?maxResults=5&q=${encodeURIComponent("in:sent to:info@westandhunter.com after:2026/09/29")}`);
if ((sent.messages || []).length) await refuse(`already wrote to them today: ${sent.messages.map((m) => m.id).join(",")}`);

const msg = await G(`messages/${REPLY_TO_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, text) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(text, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${subject}`, `In-Reply-To: ${h["message-id"]}`,
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
