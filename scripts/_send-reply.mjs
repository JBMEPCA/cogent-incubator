/**
 * Reply from a title's own mailbox with a just-published article's URL.
 *
 * Generic version of the _email-*-live.mjs one-offs. Reads a JSON spec:
 *   { "site": "nursery-daily", "to": "...", "toName": "...",
 *     "threadQuery": "from:x subject:y",
 *     "postId": 1372, "body": "Hi ...\n\n${URL}\n..." }
 *
 * "site" is the Site slug and decides which mailbox sends and which WordPress
 * is asked for the URL. It defaults to "smart-sme" so the older specs in
 * scripts/replies/ keep working unchanged.
 * Refuses unless the post is published. Threads onto the newest message
 * matching threadQuery. Clean MIME: no List-Unsubscribe, RFC 2047 subject,
 * no em dashes allowed in the body.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_send-reply.mjs --spec=path.json [--send]
 */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const specPath = (process.argv.find((a) => a.startsWith("--spec=")) || "").split("=").slice(1).join("=");
if (!specPath) throw new Error("--spec=path.json required");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
for (const k of ["to", "toName", "postId", "body"]) if (!spec[k]) throw new Error(`spec missing ${k}`);
if (/[—–]/.test(spec.body)) throw new Error("em or en dash in the body");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: spec.site || "smart-sme" } });
if (!site) throw new Error(`no site with slug "${spec.site}"`);
const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const s = creds.sftp;
await prisma.$disconnect();
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 120000 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (a) => ssh(`cd ${sq(docroot)} && wp ${a}`);

const status = wp(`post get ${spec.postId} --field=post_status`);
if (status !== "publish") { console.error(`post ${spec.postId} is "${status}", not publish. Not sending.`); process.exit(1); }
const URL = wp(`post url ${spec.postId}`);
// Validate against whatever the title's own home is, not a hardcoded host, so
// this works for every title. Still refuses anything that is not a clean
// top-level post permalink on that domain.
const HOME = wp(`option get home`).replace(/\/+$/, "");
if (!new RegExp(`^${HOME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[a-z0-9-]+/$`).test(URL))
  throw new Error(`live URL looks wrong for ${HOME}: "${URL}"`);
const BODY = spec.body.replaceAll("${URL}", URL);

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeHeader = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);
function buildMime({ from, to, cc, subject, text, html, inReplyTo, references }) {
  const boundary = `mime-${Date.now().toString(36)}`;
  const headers = [`From: ${from}`, `To: ${to}`, cc ? `Cc: ${cc}` : null, `Subject: ${encodeHeader(subject)}`, inReplyTo ? `In-Reply-To: ${inReplyTo}` : null, references ? `References: ${references}` : null, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`].filter(Boolean);
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

// Threaded when the sender's own message is in the hub; a fresh send when it
// is not (spec gives "subject" instead of "threadQuery"). Never thread onto a
// forward from someone else: the recipient would see a conversation they were
// never part of.
let subject, inReplyTo, references, threadId = null;
if (spec.threadQuery) {
  const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
  const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(spec.threadQuery)}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
  if (!list.messages?.length) throw new Error(`no message matches threadQuery: ${spec.threadQuery}`);
  const last = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=From`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
  const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  if (!h.from?.toLowerCase().includes(spec.to.toLowerCase())) throw new Error(`newest match is from ${h.from}, not ${spec.to}; refusing to thread onto it`);
  subject = /^re:/i.test(h.subject || "") ? h.subject : `Re: ${h.subject}`;
  inReplyTo = h["message-id"];
  references = [h.references, h["message-id"]].filter(Boolean).join(" ");
  threadId = last.threadId;
} else if (spec.subject) {
  subject = spec.subject;
} else {
  throw new Error("spec needs threadQuery (reply) or subject (fresh send)");
}
// spec.cc is a ready-formatted header value: "Name <a@b>" or a comma-separated list.
const cc = spec.cc || null;
const raw = buildMime({ from: `${sender.name} <${sender.email}>`, to: `${spec.toName} <${spec.to}>`, cc, subject, text: BODY, html: HTML, inReplyTo, references });
console.log(`live url: ${URL}\nto:      ${spec.to}\ncc:      ${cc || "(none)"}\nsubject: ${subject}\nthread:  ${threadId || "(fresh send)"}`);
if (!SEND) { console.log("\n--- DRY RUN, nothing sent ---\n" + BODY); process.exit(0); }

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64url(raw), ...(threadId ? { threadId } : {}) }) });
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || `HTTP ${res.status}`); process.exit(1); }
console.log(`SENT id=${out.id} thread=${out.threadId}`);
