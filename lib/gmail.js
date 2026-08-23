// Sending mail as a real person from a real mailbox.
//
// Outreach lands in a stranger's inbox and asks them to act, so it has to come
// from jb@smartsme.co.uk itself: replies belong in the inbox JB already reads,
// and the domain's own reputation is the only sending reputation this engine
// has. That rules out a transactional provider on a fresh subdomain and points
// at Gmail, which a service account can only reach by impersonating the user
// through domain-wide delegation. Hence the `subject` argument below.
import { getGoogleAccessToken, isGoogleConfigured, googleServiceAccountEmail } from "./google";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const READ_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

// The sending identity comes from the title's `outreach` credential, not the
// environment. The service-account key stays fleet-wide — one Google project
// impersonates every title's mailbox — but WHICH mailbox is per title, and
// twenty-five titles cannot share one OUTREACH_FROM_EMAIL.
export function outreachSender(outreach) {
  const email = outreach?.fromEmail;
  if (!email) return null;
  return {
    email,
    name: outreach.fromName || "James Burke",
    replyTo: outreach.replyTo || email,
  };
}

export function isGmailConfigured(outreach) {
  return Boolean(isGoogleConfigured() && outreach?.fromEmail);
}

// Why sending is unavailable, in the words of whoever has to fix it.
export function gmailSetupHint(outreach) {
  if (!isGoogleConfigured()) return "No Google service-account key (GOOGLE_SERVICE_ACCOUNT_JSON).";
  if (!outreach?.fromEmail)
    return "Add the outreach credential: the mailbox this title sends from.";
  return null;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Headers are latin-1 on the wire, so anything outside it needs RFC 2047. A
// brand called Wärtsilä in the subject line is not hypothetical in this sector.
function encodeHeader(value) {
  const v = String(value || "");
  if (/^[\x20-\x7E]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
}

function formatAddress(email, name) {
  if (!name) return email;
  return `${encodeHeader(name)} <${email}>`;
}

// Base64 for both parts rather than quoted-printable: it sidesteps line-length
// limits and 8-bit characters in one go, and Gmail is happy to take it.
function buildMime({ from, to, subject, text, html, replyTo, unsubscribeUrl, unsubscribeMailto }) {
  const boundary = `mime-${b64url(`${subject}${to}`).slice(0, 24)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];
  // One-click unsubscribe. Required by Gmail and Yahoo for bulk senders, and
  // the honest version of the opt-out promised in the footer.
  const unsub = [
    unsubscribeMailto ? `<mailto:${unsubscribeMailto}?subject=unsubscribe>` : null,
    unsubscribeUrl ? `<${unsubscribeUrl}>` : null,
  ].filter(Boolean);
  if (unsub.length) {
    headers.push(`List-Unsubscribe: ${unsub.join(", ")}`);
    if (unsubscribeUrl) headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const part = (type, body) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
      "",
    ].join("\r\n");

  return [
    headers.filter(Boolean).join("\r\n"),
    "",
    part("text/plain", text),
    part("text/html", html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function sendGmail({
  outreach,
  to,
  toName,
  subject,
  text,
  html,
  unsubscribeUrl,
  unsubscribeMailto,
}) {
  const sender = outreachSender(outreach);
  if (!sender) throw new Error(gmailSetupHint(outreach) || "Gmail sending is not configured.");
  if (!to) throw new Error("No recipient address.");

  const raw = buildMime({
    from: formatAddress(sender.email, sender.name),
    to: formatAddress(to, toName),
    replyTo: sender.replyTo === sender.email ? null : sender.replyTo,
    subject,
    text,
    html,
    unsubscribeUrl,
    unsubscribeMailto: unsubscribeMailto || sender.replyTo,
  });

  const token = await getGoogleAccessToken(SCOPES, sender.email);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    // Two different 403s that need two different consoles, and Google's own
    // wording is the only way to tell them apart. Guessing wrong sends you to
    // the wrong admin screen, so match the API-disabled case explicitly first.
    if (/has not been used in project|is disabled/i.test(msg)) {
      throw new Error(
        `The Gmail API is not enabled on the Google Cloud project. Enable it at console.cloud.google.com → APIs and services → Library → Gmail API, then retry. Full message: ${msg}`
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Gmail refused the send: ${msg}. Check that gmail.send is one of the scopes on the domain-wide delegation for ${googleServiceAccountEmail() || "the service account"}.`
      );
    }
    throw new Error(`Gmail send failed: ${msg}`);
  }
  return { id: body.id, threadId: body.threadId };
}

// Has this address written back?
//
// Replies land in a human inbox, so without this the queue only knows what JB
// remembers to tick off, and "who replied" becomes a question the engine cannot
// answer. Read access is a SEPARATE scope from sending: if it has not been added
// to the domain-wide delegation this returns null rather than throwing, and the
// caller falls back to whatever has been marked by hand.
export async function repliedSince(outreach, fromEmail, sinceDate) {
  if (!isGmailConfigured(outreach) || !fromEmail) return null;
  const sender = outreachSender(outreach);
  // Gmail's after: takes a date, not a timestamp, and rounds the wrong way for
  // us. A day of slack costs nothing here and avoids missing a same-day reply.
  const after = new Date((sinceDate ? new Date(sinceDate).getTime() : Date.now()) - 86400000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "/");
  const q = `from:${fromEmail} after:${after}`;

  let token;
  try {
    token = await getGoogleAccessToken(READ_SCOPES, sender.email);
  } catch {
    return null; // readonly not delegated
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return Boolean(body.resultSizeEstimate) && Array.isArray(body.messages) && body.messages.length > 0;
}

// The inbox itself, read for display on the Mail tab rather than for the
// engine. Same delegation and the same graceful degradation as repliedSince:
// a mailbox whose readonly scope is missing renders a hint, not a crash.
export async function listInbox(outreach, { max = 25 } = {}) {
  const empty = { available: false, reason: gmailSetupHint(outreach) || "Gmail is not configured." };
  if (!isGmailConfigured(outreach)) return empty;
  const sender = outreachSender(outreach);

  let token;
  try {
    token = await getGoogleAccessToken(READ_SCOPES, sender.email);
  } catch {
    return { available: false, reason: `gmail.readonly is not delegated for ${sender.email}.` };
  }

  const list = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!list.ok) return { available: false, reason: `Gmail refused the inbox read (HTTP ${list.status}).` };
  const ids = (await list.json().catch(() => ({}))).messages || [];

  const messages = (
    await Promise.all(
      ids.map(async ({ id }) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=Auto-Submitted&metadataHeaders=Precedence&metadataHeaders=X-Auto-Response-Suppress`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        if (!res.ok) return null;
        const m = await res.json().catch(() => null);
        if (!m) return null;
        const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
        return {
          id: m.id,
          threadId: m.threadId,
          from: h.from || "",
          subject: h.subject || "(no subject)",
          date: h.date ? new Date(h.date).toISOString() : null,
          snippet: m.snippet || "",
          unread: (m.labelIds || []).includes("UNREAD"),
          // Bulk-mail and auto-reply markers, for the triage on the fleet
          // dashboard. Real correspondence carries none of these.
          listUnsubscribe: Boolean(h["list-unsubscribe"]),
          autoSubmitted:
            (h["auto-submitted"] || "no").toLowerCase() !== "no" ||
            // Exchange's way of saying "I am a robot, please don't reply".
            Boolean(h["x-auto-response-suppress"]),
          precedence: (h.precedence || "").toLowerCase(),
        };
      })
    )
  ).filter(Boolean);

  return { available: true, address: sender.email, messages };
}

/** One full message for the reading pane. Body is returned as plain text:
 * a stranger's HTML email rendered inside the dashboard is an XSS looking
 * for somewhere to happen, so the HTML part is stripped, never displayed. */
export async function readInboxMessage(outreach, id) {
  if (!isGmailConfigured(outreach)) return null;
  const sender = outreachSender(outreach);
  let token;
  try {
    token = await getGoogleAccessToken(READ_SCOPES, sender.email);
  } catch {
    return null;
  }

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const m = await res.json().catch(() => null);
  if (!m) return null;

  const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  const part = (payload, mime) => {
    if (!payload) return null;
    if (payload.mimeType === mime && payload.body?.data) return dsnDecode(payload.body.data);
    for (const p of payload.parts || []) {
      const hit = part(p, mime);
      if (hit) return hit;
    }
    return null;
  };

  let body = part(m.payload, "text/plain");
  if (!body) {
    const html = part(m.payload, "text/html");
    if (html) {
      body = html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }

  return {
    id: m.id,
    threadId: m.threadId,
    from: h.from || "",
    to: h.to || "",
    subject: h.subject || "(no subject)",
    date: h.date ? new Date(h.date).toISOString() : null,
    body: body || m.snippet || "(no readable body)",
  };
}

// Which addresses have permanently bounced.
//
// A hard bounce is the only reliable proof that an address does not exist, and
// without reading them the engine cannot tell "nobody replied yet" from "nobody
// ever received it". Nine of the first sends bounced and every one of them sat
// in the queue afterwards as a live prospect waiting on a reply.
//
// Read out of the delivery-status report rather than by searching Gmail for the
// address inside the bounce text: Final-Recipient is a header defined by RFC
// 3464 and names the failed address exactly, whereas Gmail's search tokenises
// addresses in ways that quietly miss.
const dsnDecode = (data) =>
  Buffer.from(String(data || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");

// A bounce is multipart: a human-readable part, the machine-readable
// delivery-status part, and usually the original message. The one we need is
// nested, so flatten the lot rather than guess at the tree shape.
function flattenParts(payload) {
  const out = [];
  const walk = (part) => {
    if (!part) return;
    if (part.body?.data) out.push(dsnDecode(part.body.data));
    for (const child of part.parts || []) walk(child);
  };
  walk(payload);
  return out.join("\n");
}

export async function bouncedSince(outreach, sinceDate, max = 40) {
  const empty = { available: false, addresses: new Map() };
  if (!isGmailConfigured(outreach)) return empty;
  const sender = outreachSender(outreach);
  const after = new Date((sinceDate ? new Date(sinceDate).getTime() : Date.now()) - 86400000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "/");

  let token;
  try {
    token = await getGoogleAccessToken(READ_SCOPES, sender.email);
  } catch {
    return empty; // readonly not delegated
  }
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const q = `from:(mailer-daemon OR postmaster) after:${after}`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`,
    auth
  );
  if (!listRes.ok) return empty;
  const list = await listRes.json().catch(() => ({}));

  const addresses = new Map();
  for (const { id } of list.messages || []) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      auth
    );
    if (!res.ok) continue;
    const msg = await res.json().catch(() => null);
    if (!msg?.payload) continue;

    const text = flattenParts(msg.payload);
    let found = 0;
    for (const m of text.matchAll(/final-recipient:\s*rfc822;\s*([^\s<>]+)/gi)) {
      // Status and Diagnostic-Code belong to the recipient block they follow, so
      // read them from the text after this match rather than from the message.
      const block = text.slice(m.index, m.index + 600);
      const status = block.match(/status:\s*(\d)\.\d+\.\d+/i);
      // 4.x.x is a deferral, not a refusal: the mail may still be delivered, and
      // treating it as dead would retire a perfectly good address.
      if (status && status[1] !== "5") continue;
      const diagnostic = block.match(/diagnostic-code:\s*[^;]*;\s*([^\n]+)/i);
      addresses.set(m[1].toLowerCase().replace(/^<|>$/g, ""), (diagnostic?.[1] || "address not found").trim().slice(0, 300));
      found += 1;
    }

    // Some senders emit no delivery-status part at all. Google still names the
    // casualty in a header, so fall back to it rather than lose the bounce.
    if (!found) {
      const header = (msg.payload.headers || []).find((h) => h.name?.toLowerCase() === "x-failed-recipients");
      for (const addr of String(header?.value || "").split(",")) {
        const clean = addr.trim().toLowerCase();
        if (clean) addresses.set(clean, "address not found");
      }
    }
  }
  return { available: true, addresses };
}
