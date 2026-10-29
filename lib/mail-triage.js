// Which inbox messages deserve a human's eyes.
//
// The titles' mailboxes collect three kinds of mail: replies from people we
// asked for backlinks (the whole point), other real correspondence, and a sea
// of marketing, notifications and auto-replies. The dashboard widget should
// show the first two and none of the third, so the sorting lives here rather
// than in a component.
import { listInbox } from "./gmail";

// "Jane Doe <jane@acme.com>" → { name, email, domain }
export function parseAddress(from) {
  const m = String(from).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : String(from)).trim().toLowerCase();
  return {
    name: (m && m[1].trim()) || email,
    email,
    domain: email.split("@")[1] || "",
  };
}

// Local-part fragments that are machinery, never a correspondent. Matched on
// word boundaries anywhere in the local part, because Google alone sends from
// workspace-noreply@, mail-noreply@ and gmail-noreply@ — an anchored match let
// all three through. info@ and hello@ are deliberately NOT here: they are
// exactly where a small company's press replies come from.
const MACHINE_LOCALPARTS =
  /(^|[._+-])(no-?reply|do-?not-?reply|donotreply|mailer|daemon|postmaster|bounce[s]?|notifications?|newsletters?|marketing|updates?|alerts?|billing|receipts?)([._+-]|$)/i;

// Senders that are a product talking, not a person: webmaster-tools nags,
// onboarding tours, platform notifications. Never correspondence, and never a
// backlink reply either — Bing Webmaster Tools mails from a microsoft.com
// address, which also happens to be a domain the engine once emailed, and
// wore a "backlink reply" badge for it.
const NOISE_DOMAINS = [
  "google.com", "bing.com", "microsoft.com", "youtube.com", "vercel.com",
  "mailchimp.com", "godaddy.com", "siteground.com", "linkedin.com",
  "facebookmail.com", "x.com", "twitter.com", "cloudflare.com",
];

function isNoiseDomain(domain) {
  return NOISE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// A machine by identity: the sender itself is plumbing, whatever the message
// says. These can never be correspondence OR a backlink reply.
export function isMachineSender(fromParsed) {
  return isNoiseDomain(fromParsed.domain) || MACHINE_LOCALPARTS.test(fromParsed.email.split("@")[0]);
}

// Subjects that are an auto-acknowledgement whatever the headers say. AVILOO's
// "Danke für den Kontakt / thanks for the contact" carries not one automation
// marker, so the phrasing itself has to count. English and German, because
// that is what actually lands in these inboxes.
const ACK_SUBJECTS =
  /auto[- ]?repl|automatic reply|out of (the )?office|abwesenheit|we( have|'ve)? received your|support (case|ticket|request)|ticket (has been|was)? ?(created|received|opened)|case (number|#)|thank you for (contacting|reaching out|your (enquiry|inquiry|message|email|request))|danke für (den kontakt|ihre (anfrage|nachricht))|thanks for (the|your) contact/i;

// A machine by behaviour: bulk markers, or auto-ack phrasing, on an otherwise
// human-looking sender.
export function isAutomated(msg) {
  if (msg.autoSubmitted) return true;
  if (["bulk", "junk", "auto_reply", "list"].includes(msg.precedence)) return true;
  if (msg.listUnsubscribe) return true;
  return ACK_SUBJECTS.test(msg.subject || "");
}

// The websites' contact form (cogent-base inc/enquiries.php) mails each title
// as "[Nursery Daily] Correction enquiry from Daniel Edwards", From the
// title's own noreply@ (SPF) and the reader in Reply-To. noreply@ is a machine
// by every rule above, so until 29 Oct 2026 not one form enquiry reached the
// mailbox: only a reader's own reply to JB's answer ever showed. The topic is
// whatever the form's dropdown said.
const FORM_SUBJECT = /^(?:(?:re|fwd?):\s*)*\[[^\]]+\]\s+(.+?)\s+enquiry from\s/i;

/** The dropdown's wording, as the three kinds of enquiry plus the rest. */
export function enquiryType(topic = "") {
  if (/advertis/i.test(topic)) return "advertising";
  if (/editorial|story/i.test(topic)) return "editorial";
  if (/correction/i.test(topic)) return "correction";
  return "other";
}

/**
 * A form enquiry, or a reply in one's thread: { type, sender }, where sender
 * is the reader (parsed Reply-To) for the form's own notification and null for
 * a reply, whose From is already the person. Null for anything else.
 */
export function formEnquiry(msg) {
  const m = String(msg.subject || "").match(FORM_SUBJECT);
  if (!m) return null;
  const from = parseAddress(msg.from);
  const notice = /^no-?reply@/.test(from.email);
  if (notice && !msg.replyTo) return null;
  return { type: enquiryType(m[1]), sender: notice ? parseAddress(msg.replyTo) : null };
}

/**
 * One title's inbox, sorted into what matters.
 *
 * A message counts as a backlink reply when its sender — or anyone at the same
 * company domain, since press teams reply from colleagues' addresses — is a
 * contact the outreach engine has a row for. Backlink replies survive the
 * automation filter (an out-of-office from a prospect still tells you the
 * address is alive); everything else must look like a person to appear.
 */
export async function noteworthyMail(site, creds, db, { max = 15 } = {}) {
  const inbox = await listInbox(creds?.outreach, { max });
  if (!inbox.available) return { available: false, reason: inbox.reason, items: [] };

  const rows = await db.outreachEmail.findMany({
    where: { contactEmail: { not: null } },
    select: { contactEmail: true },
  });
  const contactEmails = new Set(rows.map((r) => r.contactEmail.toLowerCase()));
  const contactDomains = new Set([...contactEmails].map((e) => e.split("@")[1]).filter(Boolean));

  const items = [];
  for (const msg of inbox.messages) {
    // A form enquiry is a person writing to us through the website, so the
    // form's own notification goes in as the reader and skips the machine
    // checks that would see noreply@. Replies in its thread take them as
    // usual. Never a backlink reply, even when the reader's domain is one the
    // engine wrote to: "Advertising enquiry" says what it is.
    const enquiry = formEnquiry(msg);
    const from = enquiry?.sender || parseAddress(msg.from);
    // Humans only. A prospect's auto-ack briefly kept its badge here on the
    // theory that "the address is alive" is information; JB's verdict was
    // that a robot saying thanks is still a robot, so automated mail is out
    // no matter who sent it.
    if (!enquiry?.sender && (isMachineSender(from) || isAutomated(msg))) continue;

    const isBacklink = !enquiry && (contactEmails.has(from.email) || contactDomains.has(from.domain));
    items.push({
      ...msg,
      fromParsed: from,
      kind: enquiry ? "enquiry" : isBacklink ? "backlink" : "human",
      enquiryType: enquiry?.type || null,
      site: { slug: site.slug, name: site.name },
    });
  }
  return { available: true, address: inbox.address, items };
}
