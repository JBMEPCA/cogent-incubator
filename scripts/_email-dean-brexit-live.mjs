/**
 * Reply to Dean Butt in his 15 Sep "BREXIT: THE COST TO US" thread: the Brexit
 * piece is live, the sustainability piece went live on 3 Sep and the note with
 * that link never reached him, the two Press Room links, and yes to an
 * original piece next.
 *
 * Refuses to send unless post 1319 is published. Clean MIME, no
 * List-Unsubscribe, RFC 2047 subject (his has an em dash in it), threaded.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-dean-brexit-live.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const TO = "dean@appleandbears.com";
const TO_NAME = "Dean Butt";
const POST_ID = 1319;
const SUSTAINABILITY_URL = "https://smartsme.co.uk/sustainability-without-pretending-to-be-perfect/";

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 120000 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);
await prisma.$disconnect();

const status = wp(`post get ${POST_ID} --field=post_status`);
if (status !== "publish") { console.error(`post ${POST_ID} is "${status}", not publish. Not sending.`); process.exit(1); }
// `post list --post__in=` returns nothing on this wp-cli; `post url` is reliable.
const URL = wp(`post url ${POST_ID}`);
if (!/^https:\/\/smartsme\.co\.uk\/[a-z0-9-]+\/$/.test(URL)) throw new Error(`live URL looks wrong: "${URL}"`);
console.log(`live url: ${URL}`);

const BODY = `Hi Dean,

Thanks for sending this over. It is live on Smart SME:

${URL}

It runs as a guest perspective under your byline, with a line at the end saying it first appeared on the Apple & Bears blog, linking to your original. I have added a short editor's box at the end with the practical side for a small business reading it: selling into the EU delivered duty paid, IOSS, and why a paperwork mismatch is what holds a pallet. That part is marked as ours, not yours.

One thing I owe you an apology for. The sustainability piece went live on 3 September and my note with the link never reached you. That is on me. It is here:

${SUSTAINABILITY_URL}

Two asks, when you have a moment:

1. A link to each of the two Smart SME articles from your Press Room, alongside the SME Today one. Standard followed links are all we need.

2. Yes please to an original piece. The angle I would take is the practical follow-up to this one: what Apple & Bears would do differently selling into the EU today, from your own experience. Duty paid at checkout, EU stock or not, what the paperwork has to look like to get a pallet through first time. Around 900 words, exclusive to Smart SME, and it would sit well alongside this piece rather than repeating it. No rush, and if a different angle is closer to what you want to write, tell me.

Thanks again, Dean.

Best regards,

JB
Editor, Smart SME`;

if (/[—–]/.test(BODY)) throw new Error("em or en dash in the email body");

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeHeader = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
function buildMime({ from, to, subject, text, html, inReplyTo, references }) {
  const boundary = `mime-${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`, `To: ${to}`, `Subject: ${encodeHeader(subject)}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null, references ? `References: ${references}` : null,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "",
    Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

// Thread onto his Brexit email, which came in as a new thread.
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(`from:${TO} subject:brexit`)}`,
  { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
if (!list.messages?.length) throw new Error("could not find his Brexit email to thread onto");
const last = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
const subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject}`;
const references = [h.references, h["message-id"]].filter(Boolean).join(" ");

const raw = buildMime({ from: `${sender.name} <${sender.email}>`, to: `${TO_NAME} <${TO}>`, subject, text: BODY, html: HTML, inReplyTo: h["message-id"], references });
console.log(`to:      ${TO}\nsubject: ${subject}\nthread:  ${last.threadId}`);

if (!SEND) { console.log("\n--- DRY RUN, nothing sent ---\n" + BODY); process.exit(0); }

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), threadId: last.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || `HTTP ${res.status}`); process.exit(1); }
console.log(`SENT id=${out.id} thread=${out.threadId}`);
