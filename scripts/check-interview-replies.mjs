// Has anyone answered?
//
// Nothing in the app watches the interview queue, so a row sits on "asked"
// forever whether the person ignored us or wrote back the same afternoon. That
// is how 31 pre-asks sat for six days looking exactly like silence, which is
// what they turned out to be, but nobody could have known without looking.
//
// This reports, it does not write. Moving someone to "agreed" is a judgement
// about what they actually said, and a two line reply saying "who are you"
// is not a yes.
//
// node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
//   scripts/check-interview-replies.mjs [slug]

import { PrismaClient } from "@prisma/client";
import { siteCredentials } from "../lib/site.js";
import { repliedSince, bouncedSince, isGmailConfigured, outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const prisma = new PrismaClient();
const SLUG = process.argv.find((a) => !a.startsWith("--") && !a.includes("node") && !a.endsWith(".mjs")) || "smart-sme";

const site = await prisma.site.findUnique({ where: { slug: SLUG } });
if (!site) { console.log(`No site ${SLUG}`); process.exit(1); }
const { creds } = await siteCredentials(site.id);
if (!isGmailConfigured(creds?.outreach)) { console.log("Gmail is not configured for this title."); process.exit(1); }

const rows = await prisma.interviewTarget.findMany({
  where: { siteId: site.id, status: { in: ["asked", "questioned"] } },
  orderBy: { askedAt: "asc" },
});
if (!rows.length) { console.log("Nobody is waiting on a reply."); process.exit(0); }

const earliest = rows.reduce((a, r) => (r.askedAt && (!a || r.askedAt < a) ? r.askedAt : a), null);

const b = await bouncedSince(creds?.outreach, earliest);
console.log(`bounces since ${earliest?.toISOString().slice(0, 10)}: ${b.available ? b.addresses.size : "(scan unavailable)"}`);
for (const [addr] of b.addresses || []) console.log(`   BOUNCED ${addr}`);

// repliedSince only matches the exact address we wrote to. Someone answering
// from a different mailbox, or a colleague answering on their behalf, is
// invisible to it, so sweep the whole mailbox for the subject lines too.
const sender = outreachSender(creds?.outreach);
let threadHits = [];
try {
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
  const q = `-from:me after:${new Date(earliest).toISOString().slice(0, 10).replace(/-/g, "/")} (subject:"Featuring you in" OR subject:"Seven questions for")`;
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await res.json();
  for (const m of d.messages || []) {
    const mr = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const md = await mr.json();
    const h = Object.fromEntries((md.payload?.headers || []).map((x) => [x.name, x.value]));
    threadHits.push(`${h.From} | ${h.Subject}`);
  }
} catch (e) {
  console.log(`(subject sweep unavailable: ${e.message})`);
}

console.log(`\nanything inbound on an interview subject: ${threadHits.length}`);
for (const t of threadHits) console.log(`   ${t}`);

console.log("");
let replies = 0;
for (const r of rows) {
  const hit = await repliedSince(creds?.outreach, r.email, r.askedAt);
  if (hit) replies++;
  const chased = r.followUpSentAt ? "chased" : "";
  console.log(`${(hit ? "REPLY" : hit === null ? "?" : "-").padEnd(6)} ${String(r.emailSource).padEnd(10)} ${String(r.email).padEnd(40)} ${r.personName} ${chased}`);
}
console.log(`\nreplies from the address written to: ${replies} of ${rows.length}`);
await prisma.$disconnect();
