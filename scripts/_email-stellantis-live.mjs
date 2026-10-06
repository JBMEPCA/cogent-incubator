/**
 * One-off, 14 Sep 2026: tell Stellantis the IAA piece is live on Fleet and ask
 * for a link. The release came from newsletter-pressoffice@stellantis.com, a
 * mailing address, so this goes to the press contact named in the release.
 * Threaded on the release in our mailbox. Own MIME, no List-Unsubscribe.
 * Refuses to send unless post 926 is published.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_email-stellantis-live.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const POST_ID = 926;
const RELEASE_MSG = "1a09f16465ff80c1";
const TO = "Marinella Vincenzini <marinella.vincenzini@stellantis.com>";

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();

const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && ${cmd}`], { encoding: "utf8", timeout: 120000 }).trim();
const status = ssh(`wp post get ${POST_ID} --field=post_status`);
if (status !== "publish") {
  console.error(`post ${POST_ID} is "${status}", not publish. Not sending.`);
  process.exit(1);
}
const URL = ssh(`wp post list --post__in=${POST_ID} --fields=url --format=csv | tail -1`);

const BODY = `Hi Marinella,

Thank you for the Stellantis Pro One release from IAA Hannover. We have covered it for UK fleet operators in The Fleet Magazine, leading on the Pro One NEXT command centre that is already running in the UK:

${URL}

If Stellantis Pro One or the UK newsroom has a page listing media coverage, a link to the article would be much appreciated. A standard followed link is all we need.

And if there is a UK press contact for Stellantis Pro One who should see our coverage directly, I would be glad to have their details.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

if (/[—–]/.test(BODY)) {
  console.error("Dash in the copy.");
  process.exit(1);
}
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/)
  .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const part = (b, type, body) =>
  [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const encodeHeader = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const msg = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${RELEASE_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
  { headers: { Authorization: `Bearer ${rt}` } }
).then((r) => r.json());
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const b = `mime-${Date.now().toString(36)}`;
const raw = [
  [
    `From: ${sender.name} <${sender.email}>`,
    `To: ${TO}`,
    `Subject: ${encodeHeader(`Re: ${h.subject}`)}`,
    h["message-id"] ? `In-Reply-To: ${h["message-id"]}` : null,
    h["message-id"] ? `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${b}"`,
  ].filter(Boolean).join("\r\n"),
  "",
  part(b, "text/plain", BODY),
  part(b, "text/html", HTML),
  `--${b}--`,
  "",
].join("\r\n");

console.log(raw.split("\r\n\r\n")[0] + "\n\n" + BODY);
if (!SEND) {
  console.log("\nDRY RUN");
  process.exit(0);
}
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("SEND FAILED:", out?.error?.message || res.status);
  process.exit(1);
}
console.log(`\nSENT id=${out.id} thread=${out.threadId}`);
