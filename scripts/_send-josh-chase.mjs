/**
 * One-off, 14 Sep 2026: chase Josh Rand (Bethell). He said yes on 8 Sep and
 * was given Friday 11 September; nothing since. Own MIME (no List-Unsubscribe),
 * threaded on our 8 Sep reply, questions repeated so replying is the action.
 * Refuses to send if anything has come in from bethell.co.uk since 8 Sep.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_send-josh-chase.mjs [--send]
 */
import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const OUR_LAST = "1a081aa1bb550a4b"; // our 8 Sep reply
const THEIRS = "1a08190a88e01fcb";   // his 8 Sep yes
const TO = "Josh Rand <josh.rand@bethell.co.uk>";

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "fleet-magazine" } });
const row = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, company: "Bethell" } });
const qs = String(row.questions).split("\n").map((q) => q.trim()).filter(Boolean);

const BODY = `Hi Josh,

Just making sure this has not got buried. The Friday 11 September date I gave you has been and gone, so ignore that one: if you can get your answers to me by Friday 18 September, I will have the piece live the week after.

Here are the seven questions again so you do not have to dig for the first email. 100 to 150 words each is plenty, and skip any that do not suit you.

${qs.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}

A photo of yourself with the answers would be great. And tell me whether you want Workshop Coordinator or apprentice on the piece.

Best,

James Burke
Publisher, The Fleet Magazine
https://thefleetmagazine.co.uk`;

if (/[\u2014\u2013]/.test(BODY)) { console.error("Dash in the copy."); process.exit(1); }
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${BODY.split(/\n\n+/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}</div>`;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const part = (b, type, body) => [`--${b}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"), ""].join("\r\n");

const { creds } = await siteCredentials(site.id);
const sender = outreachSender(creds.outreach);
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const G = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: { Authorization: `Bearer ${rt}` } }).then((r) => r.json());

const since = await G(`messages?maxResults=5&q=${encodeURIComponent("from:bethell.co.uk after:2026/09/08")}`);
const later = [];
for (const m of since.messages || []) if (m.id !== THEIRS) later.push(m.id);
if (later.length) { console.error("Bethell has written since 8 Sep:", later); process.exit(1); }

const hdr = async (id) => Object.fromEntries((await G(`messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References`)).payload.headers.map((x) => [x.name.toLowerCase(), x.value]));
const ours = await hdr(OUR_LAST);
const b = `mime-${Date.now().toString(36)}`;
const raw = [[`From: ${sender.name} <${sender.email}>`, `To: ${TO}`, `Subject: ${ours.subject}`, `In-Reply-To: ${ours["message-id"]}`,
  `References: ${[ours.references, ours["message-id"]].filter(Boolean).join(" ")}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${b}"`].join("\r\n"),
  "", part(b, "text/plain", BODY), part(b, "text/html", HTML), `--${b}--`, ""].join("\r\n");
console.log(raw.split("\r\n\r\n")[0] + "\n\n" + BODY);
if (!SEND) { console.log("\nDRY RUN"); process.exit(0); }

const st = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email);
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST", headers: { Authorization: `Bearer ${st}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw: b64url(raw), threadId: "1a08190a88e01fcb" }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error("SEND FAILED:", out?.error?.message || res.status); process.exit(1); }
console.log(`\nSENT id=${out.id} thread=${out.threadId}`);
await prisma.interviewTarget.update({ where: { id: row.id }, data: { email: "josh.rand@bethell.co.uk", emailSource: "published", triedEmails: [row.triedEmails, "josh.rand@bethell.co.uk"].filter(Boolean).join("\n") } });
console.log("row repointed to josh.rand@bethell.co.uk");
await prisma.$disconnect();
