/**
 * One-off: answer the two Fleet Leaders replies that came in on 8 Sep 2026,
 * both of which asked for terms the interview sweep cannot supply.
 *
 * Josh Rand (Bethell) said yes and asked for a deadline. Will Paxton, at the
 * PR agency Stand, said Eddie Davidson (Aegis Energy) is willing and asked for
 * a word count and a copy date. Both rows sit on "questioned", and
 * ALLOWED_TRANSITIONS only lets that status move on "answers" or "declined",
 * so the sweep classified both as "agreed" and threw them away.
 *
 * MIME is built here rather than through sendGmail(), which always stamps
 * List-Unsubscribe and would put an "Unsubscribe" chip on a 1:1 editorial
 * reply. Threads by copying Message-Id into In-Reply-To and References and
 * passing Gmail's threadId, with the subject reused verbatim because both
 * senders are on Outlook.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_send-fleet-replies.mjs [--send]
 */

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { outreachSender, isGmailConfigured, gmailSetupHint } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const SEND = process.argv.includes("--send");
const SLUG = "fleet-magazine";
const SIGNOFF = "\n\nBest,\nJames\nPublisher, The Fleet Magazine\nhttps://thefleetmagazine.co.uk";

const REPLIES = [
  {
    company: "Bethell",
    msgId: "1a08190a88e01fcb",
    to: "Josh Rand <josh.rand@bethell.co.uk>",
    cc: null,
    body: `Hi Josh,

Great to hear it, thank you.

No hard deadline, but if you can get your answers back to me by Friday 11 September I will have you published before the end of the month. 100 to 150 words per answer is plenty, and if one of the seven does not suit you, skip it.

If you have a high resolution photo of yourself you are happy for us to use, send it with the answers.

One thing: your signature says Workshop Coordinator and I had you down as a workshop management apprentice. Which would you like on the piece?` + SIGNOFF,
  },
  {
    company: "Aegis Energy",
    msgId: "1a081922c543c13e",
    to: "Will Paxton <will@thisisstand.com>",
    cc: "Aegis <Aegis@thisisstand.com>",
    // Will is the agency, so everything after this goes to him, not to the
    // Aegis inbox the row was seeded with.
    repointEmail: "will@thisisstand.com",
    body: `Hi Will,

Thanks for coming back to me, and good to hear Eddie is up for it.

It is a straight Q&A: seven questions, 100 to 150 words per answer, so around 900 words in total. It runs under Eddie's name with his photo and a short card about the business. There is no cost and no advertising attached to it.

Friday 11 September for the copy would let me publish before the end of the month. If that is tight, tell me what works and I will fit round it.

A high resolution headshot sent with the answers is the only other thing I need.` + SIGNOFF,
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlise = (body) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${body
    .split(/\n\n+/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n")}</div>`;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function buildMime({ from, to, cc, subject, text, html, inReplyTo, references }) {
  const boundary = `mime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const part = (type, body) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
      "",
    ].join("\r\n");
  return [headers.join("\r\n"), "", part("text/plain", text), part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

if (/[\u2014\u2013]/.test(REPLIES.map((r) => r.body).join(""))) {
  console.error("Dash in the copy. Fix it before sending.");
  process.exit(1);
}

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: SLUG } });
const { creds } = await siteCredentials(site.id);
if (!isGmailConfigured(creds?.outreach)) {
  console.error("Gmail not configured:", gmailSetupHint(creds?.outreach));
  process.exit(1);
}
const sender = outreachSender(creds.outreach);
console.log(`from: ${sender.name} <${sender.email}>\n`);

const readToken = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const sendToken = SEND ? await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.send"], sender.email) : null;

for (const r of REPLIES) {
  const msg = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${r.msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${readToken}` } }
  ).then((x) => x.json());
  const h = Object.fromEntries((msg?.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const subject = /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
  const raw = buildMime({
    from: `${sender.name} <${sender.email}>`,
    to: r.to,
    cc: r.cc,
    subject,
    text: r.body,
    html: htmlise(r.body),
    inReplyTo: h["message-id"],
    references: [h.references, h["message-id"]].filter(Boolean).join(" "),
  });

  console.log("=".repeat(60));
  console.log(raw.split("\r\n\r\n")[0]);
  if (!SEND) {
    console.log("\n" + r.body + "\n");
    continue;
  }
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${sendToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(raw), threadId: msg.threadId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("SEND FAILED:", body?.error?.message || `HTTP ${res.status}`);
    continue;
  }
  console.log(`SENT id=${body.id} thread=${body.threadId}`);

  // agreedAt is what the dashboard counts as a yes, and what stops the nudge
  // ever reading as though we had lost track of our own correspondence.
  const row = await prisma.interviewTarget.findFirst({ where: { siteId: site.id, company: r.company } });
  const data = { agreedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date() };
  if (r.repointEmail && row.email !== r.repointEmail) {
    data.email = r.repointEmail;
    data.emailSource = "published";
    data.triedEmails = [row.triedEmails, r.repointEmail].filter(Boolean).join("\n");
  }
  await prisma.interviewTarget.update({ where: { id: row.id }, data });
  console.log(`row ${row.personName}: ${JSON.stringify(data)}`);
}

if (!SEND) console.log("\nDRY RUN. Nothing sent, nothing written.");
await prisma.$disconnect();
