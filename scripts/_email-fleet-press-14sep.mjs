/**
 * One-off, 14 Sep 2026: two threaded replies from the Fleet mailbox to mail
 * that came in on press@.
 *
 *  1. Clare Summers-Taylor (Fleetclear StreetVision release): the piece is
 *     live, ask for a followed link. Refuses unless post 929 is published.
 *  2. Cameron Jevon (Bene Finance) pitched a whole-life funding checklist:
 *     yes, on the usual condition of a followed backlink.
 *
 * Own MIME, no List-Unsubscribe. Built from _email-stellantis-live.mjs.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_email-fleet-press-14sep.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const POST_ID = 929;
const SIGNOFF = `Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

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

const REPLIES = [
  {
    msgId: "1a09fe001cf2055f",
    to: "Clare Summers-Taylor <clare@summersmarketing.com>",
    body: `Hi Clare,

Thank you for the StreetVision release and image. The story is now live on The Fleet Magazine:

${URL}

If Fleetclear has a news or media coverage page, a link to the article would be much appreciated. A standard followed link is all we need.

Happy to take further news and images from Fleetclear any time.

${SIGNOFF}`,
  },
  {
    msgId: "1a09fe2348af298a",
    to: "Cameron Jevon <enquiries@benefinance.co.uk>",
    body: `Hi Cameron,

Thanks for the pitch. A whole-life funding checklist would be useful for our readers, so yes, please go ahead.

A few things so it runs smoothly:

- 800 to 1,200 words, original and not published elsewhere, in UK English.
- Evidence-led as you describe, with a source for any figures and no product promotion.
- One link to the funding-requirement calculator is fine where it sits naturally in the checklist.
- A two-line author bio and a headshot for the byline.

There is no charge. In return we ask for a followed link to the article from your site, for example a news or resources page, once it is live.

Send it over whenever it is ready.

${SIGNOFF}`,
  },
];

const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlise = (body) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${body
    .split(/\n\n+/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeHeader = (v) => (/^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`);

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const st = SEND ? await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email) : null;

for (const r of REPLIES) {
  if (/[—–]/.test(r.body)) {
    console.error("Dash in the copy to", r.to);
    process.exit(1);
  }
  const msg = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`,
    { headers: { Authorization: `Bearer ${rt}` } }
  ).then((x) => x.json());
  const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
  const b = `mime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const part = (type, body) =>
    [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
  const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
  const raw = [
    [
      `From: ${sender.name} <${sender.email}>`,
      `To: ${r.to}`,
      `Subject: ${encodeHeader(subject)}`,
      h["message-id"] ? `In-Reply-To: ${h["message-id"]}` : null,
      h["message-id"] ? `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}` : null,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${b}"`,
    ].filter(Boolean).join("\r\n"),
    "",
    part("text/plain", r.body),
    part("text/html", htmlise(r.body)),
    `--${b}--`,
    "",
  ].join("\r\n");

  console.log("\n" + raw.split("\r\n\r\n")[0] + "\n\n" + r.body);
  if (!SEND) continue;
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
  console.log(`SENT id=${out.id} thread=${out.threadId}`);
}
if (!SEND) console.log("\nDRY RUN");
