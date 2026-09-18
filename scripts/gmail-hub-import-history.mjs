// Copy the mail that predates the hub into the hub.
//
// Forwarding only ever acts on new mail, so the four title mailboxes still hold
// every conversation that happened before 8 Sep 2026 and the hub holds none of
// it. This walks each one and inserts a copy into the hub, carrying its original
// date, its read/unread state and its title label.
//
// Inserted, not delivered: users.messages.insert skips filters, skips spam
// classification and sends nothing. Copies land archived rather than in the
// inbox, because 350-odd messages arriving in the inbox at once would bury the
// mail JB has not read yet. They are reachable under Titles/<title>.
//
// Every copy also gets an `Imported` label, so if the whole idea turns out to be
// a mistake it is one search and one bulk delete to undo.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/gmail-hub-import-history.mjs
//   ... --apply           actually insert (default is a dry run)
//   ... --inbox-only      just what is sitting in each inbox, not the archive
//
// Idempotent by RFC822 Message-ID: every candidate is looked up in the hub with
// rfc822msgid: before anything is written, so a second run inserts nothing.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const APPLY = process.argv.includes("--apply");
const INBOX_ONLY = process.argv.includes("--inbox-only");

const READ = ["https://www.googleapis.com/auth/gmail.readonly"];
const WRITE = ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.labels"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Gmail's own cap on a non-resumable insert. Anything fatter is a message with
// a video attached, and there are not enough of those to justify the multipart
// upload path.
const MAX_RAW = 4 * 1024 * 1024;

// One list, kept in lib/inbox-labels.js, so a new title is added in one place.
import { TITLE_LABEL } from "../lib/inbox-labels.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A few hundred messages is a few thousand round trips, and Google will drop
// one of them. ECONNRESET killed the first run three mailboxes in; without a
// retry the whole import has to be started again to make up one message.
async function withRetry(fn, what) {
  let wait = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e);
      const retryable = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up| 429| 500| 502| 503| 504/.test(msg);
      if (!retryable || attempt >= 4) throw e;
      console.log(`   retry ${attempt} after ${msg.slice(0, 60)} (${what})`);
      await sleep(wait);
      wait *= 2;
    }
  }
}

async function api(token, path, { method = "GET", body } = {}) {
  return withRetry(async () => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json?.error?.message || text.slice(0, 200)}`);
    return json;
  }, path.slice(0, 40));
}

// Anything past the inline limit goes up the media endpoint as raw RFC822 and
// gets its labels in a second call. Two calls rather than one, but a 6MB thread
// with the attachments still on it is usually the one worth keeping.
async function insertLarge(token, rawB64url, labelIds) {
  const bytes = Buffer.from(rawB64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const made = await withRetry(async () => {
    const res = await fetch(
      "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages?uploadType=media&internalDateSource=dateHeader",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "message/rfc822" }, body: bytes }
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`upload -> ${res.status} ${text.slice(0, 200)}`);
    return JSON.parse(text);
  }, "media upload");
  await api(token, `/messages/${made.id}/modify`, { method: "POST", body: { addLabelIds: labelIds } });
  return made;
}

let unsearchable = 0;

async function alreadyInHub(mid) {
  for (const q of [`rfc822msgid:${mid}`, `rfc822msgid:"${mid}"`]) {
    try {
      const hit = await api(hub, `/messages?q=${encodeURIComponent(q)}&maxResults=1`);
      return hit.resultSizeEstimate > 0;
    } catch (e) {
      if (!/Precondition check failed|-> 400/.test(String(e))) throw e;
    }
  }
  unsearchable++;
  return false;
}

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();
const titles = creds
  .map((c) => ({ name: c.site.name, slug: c.site.slug, ...decryptJson(c.payloadEnc) }))
  .filter((t) => t.fromEmail && TITLE_LABEL[t.slug] && t.fromEmail !== HUB);

const hub = await getGoogleAccessToken(WRITE, HUB);

// Labels have to exist before anything is inserted against them.
const labels = (await api(hub, "/labels")).labels || [];
const idByName = new Map(labels.map((l) => [l.name, l.id]));
if (!idByName.has("Imported")) {
  console.log(`${APPLY ? "" : "[dry run] "}create label: Imported`);
  if (APPLY) {
    const made = await api(hub, "/labels", {
      method: "POST",
      body: { name: "Imported", labelListVisibility: "labelShow", messageListVisibility: "show" },
    });
    idByName.set("Imported", made.id);
  }
}

let inserted = 0;
let skipped = 0;
let toobig = 0;

for (const t of titles) {
  const titleLabelId = idByName.get(TITLE_LABEL[t.slug]);
  if (!titleLabelId) {
    console.error(`${TITLE_LABEL[t.slug]} does not exist in the hub. Run gmail-hub-setup.mjs --apply first.`);
    process.exit(1);
  }
  console.log(`\n--- ${t.name} (${t.fromEmail})`);
  const src = await getGoogleAccessToken(READ, t.fromEmail);

  // Spam and trash stay behind. Everything else, including sent mail, comes
  // across: a thread reads as nonsense when only one side of it is present.
  const q = INBOX_ONLY ? "in:inbox" : "-in:spam -in:trash";
  const ids = [];
  let pageToken;
  do {
    const page = await api(
      src,
      `/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`
    );
    ids.push(...(page.messages || []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken);
  console.log(`   ${ids.length} messages to consider`);

  for (const id of ids) {
    const meta = await api(src, `/messages/${id}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject`);
    const headers = Object.fromEntries((meta.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
    const mid = (headers["message-id"] || "").replace(/^<|>$/g, "");
    const subject = (headers.subject || "(no subject)").slice(0, 60);

    // Already there? Two runs of this script, or a message that was cc'd to the
    // hub in the first place, must not produce a duplicate.
    //
    // Gmail rejects a rfc822msgid: search outright for some ids — a "+" in the
    // local part comes back 400 Precondition check failed however it is encoded,
    // which killed the first run one mailbox in. Quoting fixes most of them, and
    // an id that still cannot be searched is imported rather than dropped: a
    // duplicate is a nuisance, a missing message is a loss.
    if (mid && (await alreadyInHub(mid))) {
      skipped++;
      continue;
    }

    const full = await api(src, `/messages/${id}?format=raw`);
    if (!full.raw) {
      toobig++;
      console.log(`   no raw body, skipped: ${subject}`);
      continue;
    }

    const labelIds = [titleLabelId, idByName.get("Imported")].filter(Boolean);
    // Unread in the title mailbox stays unread in the hub. It is the honest
    // state, and it is what tells JB which of these he never got to.
    if ((meta.labelIds || []).includes("UNREAD")) labelIds.push("UNREAD");

    const large = full.raw.length > MAX_RAW;
    if (large) {
      toobig++;
      console.log(`   large, using the upload endpoint: ${subject}`);
    }
    if (APPLY) {
      if (large) await insertLarge(hub, full.raw, labelIds);
      else
        await api(hub, "/messages?internalDateSource=dateHeader", {
          method: "POST",
          body: { raw: full.raw, labelIds },
        });
    }
    inserted++;
  }
  console.log(`   ${APPLY ? "inserted" : "would insert"} so far: ${inserted}`);
}

console.log(
  `\n${APPLY ? "Imported" : "Would import"} ${inserted}, skipped ${skipped} already present, ${toobig} oversized, ${unsearchable} not dedupe-checkable.` +
    (APPLY ? "" : "\nDry run only. Re-run with --apply to write.")
);
