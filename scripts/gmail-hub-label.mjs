// The labelling Gmail filters cannot do, plus the back-fill for mail that
// arrived before the filters existed.
//
// Backlink replies have no signature a filter can match: the subject lines are
// written per brand by the model, so the only way to know a message is one is to
// recognise the sender as somebody the outreach engine wrote to. The database
// knows that, Gmail does not. Same reasoning as lib/mail-triage.js, whose sender
// heuristics this reuses rather than growing a second copy of the lists.
//
// Filters also only ever run on arrival, so everything already in the hub stays
// unlabelled until something walks it. That is this script too.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/gmail-hub-label.mjs
//   ... --apply        actually label (default is a dry run)
//   ... --days 400     how far back to walk (default 30, use a big number once)
//   ... --max 500      cap on messages examined
//
// Safe to run repeatedly and cheap to run hourly: it only ever ADDS labels, and
// skips a message that already carries the label it would apply.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
import { parseAddress, isMachineSender, isAutomated } from "../lib/mail-triage.js";

const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const APPLY = process.argv.includes("--apply");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const DAYS = arg("days", 30);
const MAX = arg("max", 400);

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const TITLE_LABEL = {
  "smart-sme": "Titles/SME",
  "fleet-magazine": "Titles/Fleet",
  "golf-resort-magazine": "Titles/Golf",
  "barbering-business": "Titles/Barbering",
  "airport-business-magazine": "Titles/Airports",
};

async function api(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json?.error?.message || text.slice(0, 200)}`);
  return json;
}

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { slug: true } } },
});
// address -> title label, for reading the delivery headers back.
const titleByAddress = new Map();
for (const c of creds) {
  const p = decryptJson(c.payloadEnc);
  if (p.fromEmail && TITLE_LABEL[c.site.slug]) titleByAddress.set(p.fromEmail.toLowerCase(), TITLE_LABEL[c.site.slug]);
}

// Everyone the engine has ever written to, and their companies. Domain as well
// as address because press teams reply from a colleague's mailbox.
const contacts = await prisma.outreachEmail.findMany({
  where: { contactEmail: { not: null } },
  select: { contactEmail: true },
});
await prisma.$disconnect();
const contactEmails = new Set(contacts.map((r) => r.contactEmail.toLowerCase()));
const contactDomains = new Set([...contactEmails].map((e) => e.split("@")[1]).filter(Boolean));

const token = await getGoogleAccessToken(SCOPES, HUB);

const labels = (await api(token, "/labels")).labels || [];
const idByName = new Map(labels.map((l) => [l.name, l.id]));
const nameById = new Map(labels.map((l) => [l.id, l.name]));
const missing = [
  ...Object.values(TITLE_LABEL),
  "Topics/Backlinks",
  "Topics/Interviews",
  "Topics/Enquiries",
  "Needs reply",
].filter((n) => !idByName.has(n));
if (missing.length) {
  console.error(`Labels not created yet: ${missing.join(", ")}. Run gmail-hub-setup.mjs --apply first.`);
  process.exit(1);
}

// Walk the hub, newest first, one page at a time.
const ids = [];
let pageToken;
do {
  const page = await api(
    token,
    `/messages?q=${encodeURIComponent(`newer_than:${DAYS}d -in:chats`)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`
  );
  ids.push(...(page.messages || []).map((m) => m.id));
  pageToken = page.nextPageToken;
} while (pageToken && ids.length < MAX);

console.log(`${ids.length} messages in the last ${DAYS} days${APPLY ? "" : " (dry run)"}`);

const HEADERS = ["From", "To", "Cc", "Delivered-To", "X-Forwarded-To", "Subject", "List-Unsubscribe", "Auto-Submitted", "Precedence", "X-Auto-Response-Suppress"];
const toAdd = new Map(); // labelId -> [messageId]
const toRemove = new Map();
const counts = {};

for (const id of ids.slice(0, MAX)) {
  const m = await api(
    token,
    `/messages/${id}?format=metadata&${HEADERS.map((h) => `metadataHeaders=${h}`).join("&")}`
  );
  const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const have = new Set((m.labelIds || []).map((x) => nameById.get(x) || x));

  const msg = {
    subject: h.subject || "",
    listUnsubscribe: Boolean(h["list-unsubscribe"]),
    autoSubmitted: (h["auto-submitted"] || "no").toLowerCase() !== "no" || Boolean(h["x-auto-response-suppress"]),
    precedence: (h.precedence || "").toLowerCase(),
  };
  const from = parseAddress(h.from || "");
  const wants = [];

  // Which title. Addressed-to is the honest signal. Delivered-To is only usable
  // for the four feeders: a copy forwarded from Golf carries
  // `Delivered-To: jb@smartsme.co.uk` as well as its own, so trusting it for the
  // hub stamps Titles/SME on every message in the building.
  //
  // From counts as much as To. Most of the imported history is outreach the
  // engine SENT, where the title address is the sender and the recipient is a
  // stranger; reading only the recipient headers stripped the label off 235 of
  // them in one pass.
  const involved = [h.from, h.to, h.cc].filter(Boolean).join(" ").toLowerCase();
  const deliveredTo = [h["delivered-to"], h["x-forwarded-to"]].filter(Boolean).join(" ").toLowerCase();
  const titleWants = [];
  for (const [addr, label] of titleByAddress) {
    const viaHub = addr === HUB.toLowerCase();
    if (involved.includes(addr) || (!viaHub && deliveredTo.includes(addr))) titleWants.push(label);
  }
  wants.push(...titleWants);

  // Title labels are also taken AWAY, which is the only way to undo the
  // deliveredto: mistake on mail that has already been filed.
  for (const name of Object.values(TITLE_LABEL)) {
    if (!have.has(name) || titleWants.includes(name)) continue;
    const lid = idByName.get(name);
    if (!toRemove.has(lid)) toRemove.set(lid, []);
    toRemove.get(lid).push(id);
    counts[`- ${name}`] = (counts[`- ${name}`] || 0) + 1;
  }

  // What kind. Interviews are exact (two subject lines, ours), backlinks are a
  // sender the engine wrote to, enquiries are whatever human mail is left.
  const isInterview = /featuring you in|seven questions for/i.test(msg.subject);
  const isBacklink = contactEmails.has(from.email) || contactDomains.has(from.domain);
  if (isInterview) wants.push("Topics/Interviews");
  else if (isBacklink) wants.push("Topics/Backlinks");
  else if (!isMachineSender(from) && !isAutomated(msg) && from.email && !from.email.startsWith("jb@"))
    wants.push("Topics/Enquiries");

  for (const name of wants) {
    if (have.has(name)) continue;
    const lid = idByName.get(name);
    if (!toAdd.has(lid)) toAdd.set(lid, []);
    toAdd.get(lid).push(id);
    counts[name] = (counts[name] || 0) + 1;
  }
}

for (const [name, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${name}: ${n}`);
if (!Object.keys(counts).length) console.log("  nothing to add");

if (APPLY) {
  for (const [lid, msgIds] of toAdd) {
    for (let i = 0; i < msgIds.length; i += 900) {
      await api(token, "/messages/batchModify", {
        method: "POST",
        body: { ids: msgIds.slice(i, i + 900), addLabelIds: [lid] },
      });
    }
  }
  for (const [lid, msgIds] of toRemove) {
    for (let i = 0; i < msgIds.length; i += 900) {
      await api(token, "/messages/batchModify", {
        method: "POST",
        body: { ids: msgIds.slice(i, i + 900), removeLabelIds: [lid] },
      });
    }
  }
  console.log("Applied.");
} else {
  console.log("Dry run only. Re-run with --apply to label.");
}

// --------------------------------------------------------- who is waiting ---
//
// The question an inbox never answers on its own: of everything in here, which
// conversations are sitting on OUR reply? A thread whose last message came from
// them and has not been answered is the only pile that is actually work.
// Thread-level, because that is the unit of a conversation, and reversible in
// both directions: answering a thread takes the label off again on the next run.
const OURS = new Set([...titleByAddress.keys()]);
const NEEDS = idByName.get("Needs reply");

const threadQ = 'newer_than:90d (label:"Topics/Backlinks" OR label:"Topics/Interviews" OR label:"Topics/Enquiries")';
const threadIds = [];
let tPage;
do {
  const page = await api(token, `/threads?q=${encodeURIComponent(threadQ)}&maxResults=100${tPage ? `&pageToken=${tPage}` : ""}`);
  threadIds.push(...(page.threads || []).map((t) => t.id));
  tPage = page.nextPageToken;
} while (tPage && threadIds.length < MAX);

const needAdd = [];
const needClear = [];
for (const tid of threadIds) {
  const th = await api(token, `/threads/${tid}?format=metadata&metadataHeaders=From`);
  const msgs = th.messages || [];
  if (!msgs.length) continue;
  const last = msgs[msgs.length - 1];
  const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const from = parseAddress(h.from || "");
  const flagged = (last.labelIds || []).includes(NEEDS);
  const waiting = !OURS.has(from.email) && !isMachineSender(from);
  if (waiting && !flagged) needAdd.push(tid);
  if (!waiting && flagged) needClear.push(tid);
}

console.log(`\nNeeds reply: ${needAdd.length} to flag, ${needClear.length} to clear, over ${threadIds.length} threads`);
if (APPLY) {
  for (const tid of needAdd) await api(token, `/threads/${tid}/modify`, { method: "POST", body: { addLabelIds: [NEEDS] } });
  for (const tid of needClear) await api(token, `/threads/${tid}/modify`, { method: "POST", body: { removeLabelIds: [NEEDS] } });
  console.log("Applied.");
}
