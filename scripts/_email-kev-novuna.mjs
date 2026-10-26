/**
 * Reply to Kev Gall (Nomada Digital, working for Novuna) after adding Novuna
 * to Fleet post 287. JB, 23 Oct 2026: "sort and make sure he backlinks".
 *
 * The ask is explicit and conditional: we added the entry, we want a followed
 * link back, and we say what happens if it does not appear. It also corrects
 * the pitch, because he asked for Novuna Business Finance on a leasing guide
 * and the arm that actually leases trucks is Novuna Vehicle Solutions.
 *
 * Own MIME, so no List-Unsubscribe chip on a one-to-one reply. Refuses to send
 * unless the article is live and already mentions Novuna.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_email-kev-novuna.mjs [--send]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const POST_ID = 287;
const TO = "Kev Gall <kev@nomadadigital.co.uk>";
const REPLY_TO_MSG = "1a1685fca69c4258";

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd) =>
  execFileSync("ssh", ["-i", s.privateKeyPath.replace(/^~/, os.homedir()), "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, `cd '${docroot}' && ${cmd}`],
    { encoding: "utf8", timeout: 120000, maxBuffer: 32e6 }).trim();
const status = ssh(`wp post get ${POST_ID} --field=post_status`);
const URL = ssh(`wp post url ${POST_ID}`);
const mentions = Number(ssh(`wp post get ${POST_ID} --field=post_content | grep -o Novuna | wc -l`));
console.log(`post ${POST_ID}: ${status}, ${URL}, Novuna mentions ${mentions}`);

const BODY = `Hi Kev,

Thanks for the note, and for reading the piece properly before writing. That is rarer than it should be.

Novuna is in, and the guide is updated:

${URL}

One thing worth passing back to the client. You pitched Novuna Business Finance, but on its own transport finance page that arm offers hire purchase and leasing of assets the customer ends up owning, and says plainly that it does not do business loans. That is asset finance, not truck leasing, so putting it in a contract hire comparison would have misled our readers. The arm that actually leases trucks is Novuna Vehicle Solutions, whose truck and specialist leasing covers HGVs, plant and purpose-built vehicles with maintenance and compliance management inside the agreement.

So I have done both, each in the right place. Novuna Vehicle Solutions is now in the comparison table of leasing providers and in the independents section. Novuna Business Finance is named in a new section on funding a truck you intend to own, which links to the page you sent.

What I would like in return is a followed link to the article from a Novuna page. The natural home is the commercial vehicles category of the Novuna Vehicle Solutions news and insights section, which already carries pieces on total cost of ownership and uptime, or the Business Finance resource centre. A standard followed link is all we need, no rel="nofollow" and no rel="sponsored".

That is the basis we add commercial entries to our buyer's guides, so if it turns out Novuna will not link out, tell me and I will take another look at the listing rather than leave it there on a false footing. If it is simply slow to get through their approvals, that is fine, just keep me posted.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

console.log(`\n${BODY}\n`);
const refuse = async (why) => { console.error(`NOT SENT: ${why}`); await prisma.$disconnect(); process.exit(1); };
if (/[—–]/.test(BODY)) await refuse("dash in copy");
if (!SEND) { console.log("DRY RUN: nothing sent."); await prisma.$disconnect(); process.exit(0); }
if (status !== "publish" || !/^https:\/\/thefleetmagazine\.co\.uk\/.+/.test(URL)) await refuse(`article not live (${status})`);
if (mentions < 3) await refuse(`article mentions Novuna only ${mentions} times, the edit may not have applied`);

const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());
const already = await G(`messages?maxResults=3&q=${encodeURIComponent("in:sent to:kev@nomadadigital.co.uk")}`);
if ((already.messages || []).length) await refuse(`already replied to him: ${already.messages.map((m) => m.id).join(",")}`);

const msg = await G(`messages/${REPLY_TO_MSG}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`);
const h = Object.fromEntries(msg.payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const part = (b, type, text) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(text, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${/^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`}`,
  `In-Reply-To: ${h["message-id"]}`, `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}`,
  "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "", part(b, "text/plain", BODY), part(b, "text/html", HTML), `--${b}--`, ""].join("\r\n");
const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: msg.threadId }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) await refuse(`gmail ${out?.error?.message || res.status}`);
console.log(`SENT id=${out.id} thread=${out.threadId}`);
await prisma.$disconnect();
