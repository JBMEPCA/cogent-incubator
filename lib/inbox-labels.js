// The two labelling jobs Gmail's own filters cannot do, run hourly against the
// hub inbox.
//
// Filters handle everything a rule can express: which title a message belongs
// to, interviews by subject, promotions, no-reply senders. Two things are left
// over and both need the database.
//
// Backlinks: the subject lines are written per brand by the model, so the only
// signal that a message is a backlink reply is that its sender is somebody the
// outreach engine wrote to. Gmail has never heard of OutreachEmail.
//
// Needs reply: whether a thread is waiting on us is a fact about the LAST
// message in it, which no filter sees. It is also the only pile in the inbox
// that is actually work, so it earns the extra pass.
//
// The sender heuristics come from mail-triage.js rather than a second copy:
// those lists earned their entries one wrong badge at a time.
import { getGoogleAccessToken } from "./google";
import { decryptJson } from "./crypto";
import { fleetRead } from "./prisma";
import { parseAddress, isMachineSender, isAutomated } from "./mail-triage";

// The hub is the mailbox the other four forward into. It is Smart SME's own
// mailbox rather than a sixth account, so this is a real title address and not
// a special case anywhere else in the code.
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const TITLE_LABEL = {
  "smart-sme": "Titles/SME",
  "fleet-magazine": "Titles/Fleet",
  "golf-resort-magazine": "Titles/Golf",
  "barbering-business": "Titles/Barbering",
  "airport-business-magazine": "Titles/Airports",
};

const TOPIC = {
  backlinks: "Topics/Backlinks",
  interviews: "Topics/Interviews",
  enquiries: "Topics/Enquiries",
  needsReply: "Needs reply",
};

const HEADERS = [
  "From",
  "To",
  "Cc",
  "Delivered-To",
  "X-Forwarded-To",
  "Subject",
  "List-Unsubscribe",
  "Auto-Submitted",
  "Precedence",
  "X-Auto-Response-Suppress",
];

/**
 * Every title's sending mailbox, lowercased, keyed to its label.
 *
 * Also what tells one title's mail from another's now that they all land in the
 * same inbox: the interview sweep uses it to exclude the four addresses that
 * are not its own.
 */
export async function titleAddresses() {
  const rows = await fleetRead().siteCredential.findMany({
    where: { kind: "outreach" },
    select: { payloadEnc: true, site: { select: { slug: true } } },
  });
  const map = new Map();
  for (const r of rows) {
    const label = TITLE_LABEL[r.site.slug];
    if (!label) continue;
    let payload;
    try {
      payload = decryptJson(r.payloadEnc);
    } catch {
      continue;
    }
    if (payload?.fromEmail) map.set(payload.fromEmail.toLowerCase(), label);
  }
  return map;
}

async function api(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} -> ${res.status} ${json?.error?.message || ""}`.trim());
  return json;
}

/**
 * One pass over the hub.
 *
 * `days` is deliberately small: this runs every hour, so it only ever has an
 * hour of new mail to catch up on, and the wall-clock budget of the cron route
 * it hangs off is shared with the interview sweep. The Needs reply pass always
 * looks at every thread already carrying the label however far back it goes,
 * because clearing one JB has answered matters as much as flagging a new one.
 */
export async function runInboxLabels({ days = 2, maxMessages = 150, maxThreads = 150 } = {}) {
  const db = fleetRead();

  const titleByAddress = await titleAddresses();
  if (!titleByAddress.has(HUB.toLowerCase())) {
    return { available: false, reason: `${HUB} has no outreach credential, so the hub cannot be identified.` };
  }

  let token;
  try {
    token = await getGoogleAccessToken(SCOPES, HUB);
  } catch {
    return { available: false, reason: `gmail.modify is not delegated for ${HUB}.` };
  }

  const labels = (await api(token, "/labels")).labels || [];
  const idByName = new Map(labels.map((l) => [l.name, l.id]));
  const nameById = new Map(labels.map((l) => [l.id, l.name]));
  const missing = [...Object.values(TITLE_LABEL), ...Object.values(TOPIC)].filter((n) => !idByName.has(n));
  if (missing.length) {
    return { available: false, reason: `labels missing from ${HUB}: ${missing.join(", ")}` };
  }

  const contacts = await db.outreachEmail.findMany({
    where: { contactEmail: { not: null } },
    select: { contactEmail: true },
  });
  const contactEmails = new Set(contacts.map((r) => r.contactEmail.toLowerCase()));
  const contactDomains = new Set([...contactEmails].map((e) => e.split("@")[1]).filter(Boolean));

  // ------------------------------------------------------------ messages ---
  const list = await api(
    token,
    `/messages?q=${encodeURIComponent(`newer_than:${days}d -in:chats`)}&maxResults=${Math.min(maxMessages, 100)}`
  );
  const ids = (list.messages || []).slice(0, maxMessages).map((m) => m.id);

  const toAdd = new Map();
  const toRemove = new Map();
  const counts = {};
  const bump = (k) => (counts[k] = (counts[k] || 0) + 1);

  for (const id of ids) {
    const m = await api(token, `/messages/${id}?format=metadata&${HEADERS.map((h) => `metadataHeaders=${h}`).join("&")}`);
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const have = new Set((m.labelIds || []).map((x) => nameById.get(x) || x));

    // Which title. From counts as much as To: most of what sits in this mailbox
    // is outreach the engine SENT, where the title address is the sender.
    // Delivered-To is usable only for the four feeders, never for the hub — a
    // copy forwarded from Golf carries `Delivered-To: <hub>` too, and trusting
    // that stamped every message in the building with the hub's title.
    const involved = [h.from, h.to, h.cc].filter(Boolean).join(" ").toLowerCase();
    const delivered = [h["delivered-to"], h["x-forwarded-to"]].filter(Boolean).join(" ").toLowerCase();
    const titleWants = [];
    for (const [addr, label] of titleByAddress) {
      const isHub = addr === HUB.toLowerCase();
      if (involved.includes(addr) || (!isHub && delivered.includes(addr))) titleWants.push(label);
    }

    const wants = [...titleWants];
    const subject = h.subject || "";
    const from = parseAddress(h.from || "");
    const automated = {
      subject,
      listUnsubscribe: Boolean(h["list-unsubscribe"]),
      autoSubmitted: (h["auto-submitted"] || "no").toLowerCase() !== "no" || Boolean(h["x-auto-response-suppress"]),
      precedence: (h.precedence || "").toLowerCase(),
    };

    if (/featuring you in|seven questions for/i.test(subject)) wants.push(TOPIC.interviews);
    else if (contactEmails.has(from.email) || contactDomains.has(from.domain)) wants.push(TOPIC.backlinks);
    else if (from.email && !titleByAddress.has(from.email) && !isMachineSender(from) && !isAutomated(automated))
      wants.push(TOPIC.enquiries);

    for (const name of wants) {
      if (have.has(name)) continue;
      const lid = idByName.get(name);
      if (!toAdd.has(lid)) toAdd.set(lid, []);
      toAdd.get(lid).push(id);
      bump(name);
    }

    // Title labels come off as well as on. Without this there is no way to undo
    // a bad rule on mail that has already been filed.
    for (const name of Object.values(TITLE_LABEL)) {
      if (!have.has(name) || titleWants.includes(name)) continue;
      const lid = idByName.get(name);
      if (!toRemove.has(lid)) toRemove.set(lid, []);
      toRemove.get(lid).push(id);
      bump(`-${name}`);
    }
  }

  for (const [lid, msgIds] of toAdd) {
    for (let i = 0; i < msgIds.length; i += 900) {
      await api(token, "/messages/batchModify", { method: "POST", body: { ids: msgIds.slice(i, i + 900), addLabelIds: [lid] } });
    }
  }
  for (const [lid, msgIds] of toRemove) {
    for (let i = 0; i < msgIds.length; i += 900) {
      await api(token, "/messages/batchModify", { method: "POST", body: { ids: msgIds.slice(i, i + 900), removeLabelIds: [lid] } });
    }
  }

  // ------------------------------------------------------------- threads ---
  // Recent conversations, plus everything already flagged however old, so a
  // thread JB has answered stops nagging.
  const needsId = idByName.get(TOPIC.needsReply);
  const threadQ =
    `label:"${TOPIC.needsReply}" OR (newer_than:${days * 15}d ` +
    `(label:"${TOPIC.backlinks}" OR label:"${TOPIC.interviews}" OR label:"${TOPIC.enquiries}"))`;
  const threads = await api(token, `/threads?q=${encodeURIComponent(threadQ)}&maxResults=${Math.min(maxThreads, 100)}`);

  let flagged = 0;
  let cleared = 0;
  for (const t of (threads.threads || []).slice(0, maxThreads)) {
    const th = await api(token, `/threads/${t.id}?format=metadata&metadataHeaders=From`);
    const msgs = th.messages || [];
    if (!msgs.length) continue;
    const last = msgs[msgs.length - 1];
    const h = Object.fromEntries((last.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const from = parseAddress(h.from || "");
    const isFlagged = (last.labelIds || []).includes(needsId);
    // Waiting on us when the last word was theirs, and they are a person.
    const waiting = !titleByAddress.has(from.email) && !isMachineSender(from);
    if (waiting && !isFlagged) {
      await api(token, `/threads/${t.id}/modify`, { method: "POST", body: { addLabelIds: [needsId] } });
      flagged++;
    } else if (!waiting && isFlagged) {
      await api(token, `/threads/${t.id}/modify`, { method: "POST", body: { removeLabelIds: [needsId] } });
      cleared++;
    }
  }

  return { available: true, hub: HUB, messages: ids.length, changes: counts, needsReply: { flagged, cleared } };
}
