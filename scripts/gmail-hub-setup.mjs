// One-time Gmail configuration for the five-title hub inbox.
//
// JB reads one inbox, not five. Every title keeps its own Workspace account —
// the outreach and interview engines impersonate each one to send as that title
// and to read its replies, so collapsing them into aliases would break both —
// but each of the four non-hub mailboxes forwards a COPY to the hub and keeps
// its own, and the sorting all happens in the hub.
//
// Labels come in two axes: Titles/<title> says which magazine, Topics/<kind>
// says what it is. Gmail labels are flat, so one axis alone gives you either
// "all Fleet mail" or "all interviews" but never both, and never the
// intersection.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/gmail-hub-setup.mjs
//   ... --apply         actually write (default is a dry run)
//   ... --keep-noise    leave bulk mail in the inbox instead of archiving it
//
// Idempotent: labels match by name, filters by query AND action, forwarding by
// address, send-as by address. A filter whose action has changed since it was
// written is deleted and rebuilt, because the Gmail API has no filter update.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const APPLY = process.argv.includes("--apply");

// What happens to bulk mail. JB asked for it deleted "as long as it's trash",
// which is a condition, not a blank cheque: trash here means Gmail's Trash, out
// of sight and recoverable for 30 days, and the guards below are what make the
// condition true. `archive` keeps it, out of the inbox and marked read;
// `inbox` leaves it where it lands.
const NOISE = (process.argv.find((a) => a.startsWith("--noise="))?.split("=")[1] || "trash").toLowerCase();
if (!["trash", "archive", "inbox"].includes(NOISE)) {
  console.error(`--noise must be trash, archive or inbox (got ${NOISE}).`);
  process.exit(1);
}

// Everything here writes into a mailbox JB actually reads, so the scopes are
// the narrow ones. settings.sharing is what forwarding and send-as need,
// settings.basic covers filters, labels covers labels.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Gmail only accepts colours from its own palette; anything else is a 400. A
// colour is a nicety, so a rejection must not take the label down with it.
const TITLE_COLOURS = {
  "Titles/SME": { backgroundColor: "#4a86e8", textColor: "#ffffff" },
  "Titles/Fleet": { backgroundColor: "#16a766", textColor: "#ffffff" },
  "Titles/Golf": { backgroundColor: "#fad165", textColor: "#000000" },
  "Titles/Barbering": { backgroundColor: "#a479e2", textColor: "#ffffff" },
  "Titles/Airports": { backgroundColor: "#fb4c2f", textColor: "#ffffff" },
};

// Which title label each mailbox earns. Keyed by slug, so a renamed site name
// cannot silently re-label a year of mail.
const TITLE_LABEL = {
  "smart-sme": "Titles/SME",
  "fleet-magazine": "Titles/Fleet",
  "golf-resort-magazine": "Titles/Golf",
  "barbering-business": "Titles/Barbering",
  "airport-business-magazine": "Titles/Airports",
};

const TOPIC_LABELS = [
  "Topics/Backlinks",
  "Topics/Interviews",
  "Topics/Enquiries",
  "Topics/Newsletter",
  "Topics/Admin",
  "Topics/Noise",
  "Needs reply",
];

// The two subjects the interview pipeline sends under. They matter twice: they
// are how interview mail gets labelled, and they are what must never be allowed
// into spam, because runInterviewSweep searches each title mailbox and Gmail
// search skips spam. A reply misfiled as spam is a piece of the franchise that
// silently never happens.
const INTERVIEW_SUBJECTS = 'subject:("Featuring you in" OR "Seven questions for")';

// Bounces, which Gmail files as spam more often than you would think: two from
// adrianflux.co.uk and one from a mail delivery subsystem were sitting in spam
// on 9 Sep 2026, and `bouncedSince` searches, and Gmail search skips spam. So
// the engine never learned those addresses were dead and kept writing to them.
const BOUNCE_SENDERS = "from:(mailer-daemon OR postmaster OR mailer-daemon@googlemail.com)";

// Out-of-office and ticket acknowledgements, in the two languages that actually
// land in these inboxes. Kept in step with ACK_SUBJECTS in lib/mail-triage.js.
const AUTO_REPLY =
  'subject:("out of office" OR "automatic reply" OR "auto-reply" OR "autoreply" OR "abwesenheit" OR "thank you for contacting" OR "we have received your")';

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

const say = (s) => console.log(`${APPLY ? "" : "[dry run] "}${s}`);

// Gmail can create and delete a filter but not edit one, so "make it match this
// list" means comparing the action too and rebuilding the ones that drifted.
const norm = (a = {}) =>
  JSON.stringify({
    add: [...(a.addLabelIds || [])].sort(),
    remove: [...(a.removeLabelIds || [])].sort(),
    forward: a.forward || null,
  });

// `ours` are the label ids this script manages. Any filter that adds one of
// them but is not in the wanted list is a rule we wrote and have since changed
// our minds about, so it goes: leaving it behind is how a message ends up with
// two title labels.
async function ensureFilters(token, wanted, who, ours = []) {
  const live = (await api(token, "/settings/filters")).filter || [];
  const keep = new Set(wanted.map((f) => f.criteria.query));
  for (const l of live) {
    if (keep.has(l.criteria?.query)) continue;
    if (!(l.action?.addLabelIds || []).some((id) => ours.includes(id))) continue;
    say(`${who}: delete stale filter: ${l.criteria?.query?.slice(0, 60)}`);
    if (APPLY) await api(token, `/settings/filters/${l.id}`, { method: "DELETE" });
  }
  for (const f of wanted) {
    const match = live.find((l) => l.criteria?.query === f.criteria.query);
    if (match && norm(match.action) === norm(f.action)) {
      say(`${who}: filter unchanged: ${f.what}`);
      continue;
    }
    if (match) {
      say(`${who}: rebuild filter: ${f.what}`);
      if (APPLY) await api(token, `/settings/filters/${match.id}`, { method: "DELETE" });
    } else {
      say(`${who}: create filter: ${f.what}`);
    }
    if (APPLY) await api(token, "/settings/filters", { method: "POST", body: { criteria: f.criteria, action: f.action } });
  }
}

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
const titles = creds
  .map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) }))
  .filter((t) => t.fromEmail && TITLE_LABEL[t.slug]);
await prisma.$disconnect();

if (!titles.some((t) => t.fromEmail === HUB)) {
  console.error(`The hub ${HUB} is not one of the title mailboxes (${titles.map((t) => t.fromEmail).join(", ")}).`);
  process.exit(1);
}

// ---------------------------------------------------------------- the hub ---
const hubToken = await getGoogleAccessToken(SCOPES, HUB);

// Labels first: filters reference them by id, so they have to exist before the
// filters that add them.
const existing = (await api(hubToken, "/labels")).labels || [];
const byName = new Map(existing.map((l) => [l.name, l]));

for (const name of [...Object.values(TITLE_LABEL), ...TOPIC_LABELS]) {
  if (byName.has(name)) {
    say(`label exists: ${name}`);
    continue;
  }
  say(`create label: ${name}`);
  if (!APPLY) {
    byName.set(name, { id: `PENDING:${name}` });
    continue;
  }
  const body = { name, labelListVisibility: "labelShow", messageListVisibility: "show" };
  let made;
  try {
    made = await api(hubToken, "/labels", {
      method: "POST",
      body: TITLE_COLOURS[name] ? { ...body, color: TITLE_COLOURS[name] } : body,
    });
  } catch (e) {
    console.log(`   colour refused (${String(e).slice(0, 90)}), creating it plain`);
    made = await api(hubToken, "/labels", { method: "POST", body });
  }
  byName.set(name, made);
}

const labelId = (name) => byName.get(name)?.id;

// Getting bulk mail out of the way means BOTH archiving it and marking it read.
// Archive alone still leaves an unread count nagging from the label.
const BURY = NOISE === "inbox" ? [] : ["INBOX", "UNREAD"];
// Gmail spells "Delete it" as a TRASH label.
const BIN = NOISE === "trash" ? ["TRASH"] : [];
const noiseAction = (extra = []) => ({
  addLabelIds: [labelId("Topics/Noise"), ...BIN, ...extra],
  removeLabelIds: BURY,
});
const noiseWord = { trash: " (binned)", archive: " (archived, marked read)", inbox: "" }[NOISE];

// The senders whose machine-shaped mail is the whole point of the mailbox.
// Hosting, DNS, billing and platform alerts arrive from no-reply@ and
// notifications@ addresses, which is precisely what the machine-sender rule
// matches, so without this exclusion turning deletion on would have binned
// every SiteGround and Vercel warning the fleet gets.
const ADMIN_SENDERS =
  "siteground.com OR vercel.com OR cloudflare.com OR ionos.co.uk OR namecheap.com OR anthropic.com OR google.com OR stripe.com";

// Nothing here may touch an interview subject or a platform alert, whatever
// else it matches.
const NEVER_TOUCH = `-from:(${ADMIN_SENDERS}) -${INTERVIEW_SUBJECTS}`;

// And the bin has one more exemption, which is the whole reason archiving and
// deleting are two different actions here. Gmail search skips Trash, and the
// engine finds a bounce by searching `from:(mailer-daemon OR postmaster)`
// (bouncedSince in lib/gmail.js) and a reply by searching `from:<contact>`
// (repliedSince). Anything binned is therefore invisible to the engine, so a
// binned bounce would leave a dead address being emailed forever. Archived mail
// is still found by both, which is why the doubtful cases below are archived
// and only the certainties are deleted.
const NEVER_BIN = `${NEVER_TOUCH} -from:(mailer-daemon OR postmaster)`;

const hubFilters = [];

// Title labelling keys off the delivery address, which survives forwarding in
// the To/Cc headers of anything sent TO a title, outreach replies included:
// they reply to the address that wrote to them.
// The hub is the exception, and getting it wrong put two title labels on every
// forwarded message. A copy forwarded from Golf arrives carrying BOTH
// `To: jb@golfresortmagazine.com` and `Delivered-To: jb@smartsme.co.uk`, so a
// hub rule that matches deliveredto: claims every message in the building.
// Titles/SME is therefore addressed-to only.
for (const t of titles) {
  const isHub = t.fromEmail === HUB;
  hubFilters.push({
    what: `${TITLE_LABEL[t.slug]} for ${t.fromEmail}${isHub ? " (addressed-to only)" : ""}`,
    criteria: {
      query: isHub
        ? `to:${t.fromEmail} OR cc:${t.fromEmail}`
        : `to:${t.fromEmail} OR cc:${t.fromEmail} OR deliveredto:${t.fromEmail}`,
    },
    action: { addLabelIds: [labelId(TITLE_LABEL[t.slug])] },
  });
}

// Never-spam comes first in intent even though Gmail applies every matching
// filter: an interview reply is the one message in this inbox that cannot be
// allowed to go missing.
hubFilters.push({
  what: "never spam: interview replies",
  criteria: { query: INTERVIEW_SUBJECTS },
  action: { removeLabelIds: ["SPAM"] },
});

hubFilters.push({
  what: "never spam: bounces",
  criteria: { query: BOUNCE_SENDERS },
  action: { removeLabelIds: ["SPAM"] },
});

// The defect this whole design was always going to have, and it bit on 9 Sep
// 2026: a forwarded copy is re-delivered by us, not by the original sender, so
// SPF and DKIM no longer align at the second hop and Gmail can score it as
// spam. Paul Mummery of the RHA replied to a Fleet outreach email, the copy
// landed in the hub's spam folder, and it would never have been seen here.
// Every forwarded copy is addressed to one of the four title mailboxes, so
// that is the thing to whitelist. The cost is that real spam sent to those
// addresses reaches this inbox too, which at one or two a week is a trade
// worth making against losing a reply.
const FEEDER_ADDRESSES = titles
  .filter((t) => t.fromEmail !== HUB)
  .map((t) => t.fromEmail)
  .join(" OR ");
if (FEEDER_ADDRESSES) {
  hubFilters.push({
    what: "never spam: copies forwarded from the other titles",
    criteria: { query: `to:(${FEEDER_ADDRESSES}) OR cc:(${FEEDER_ADDRESSES}) OR deliveredto:(${FEEDER_ADDRESSES})` },
    action: { removeLabelIds: ["SPAM"] },
  });
}

hubFilters.push({
  what: "Topics/Interviews",
  criteria: { query: INTERVIEW_SUBJECTS },
  action: { addLabelIds: [labelId("Topics/Interviews")] },
});

hubFilters.push({
  what: "Topics/Newsletter",
  criteria: { query: "from:(mailchimp.com OR mcsv.net OR mandrillapp.com)" },
  action: { addLabelIds: [labelId("Topics/Newsletter")] },
});

// Hosting, DNS, billing and the platforms the fleet runs on. Labelled, never
// archived: a SiteGround or Vercel mail is often the reason something broke.
hubFilters.push({
  what: "Topics/Admin",
  criteria: { query: `from:(${ADMIN_SENDERS})` },
  action: { addLabelIds: [labelId("Topics/Admin")] },
});

// Everything Gmail already knows is promotional. This is the one that catches
// the Microsoft Advertising class of mail: it carries no List-Id and its sender
// is not a no-reply address, so only Gmail's own classifier sees it coming.
// Archived, never binned, even when the mode is trash. Two reasons. Gmail's
// promotions classifier is exactly where a first email from an advertiser lands,
// and a marketing@ or notifications@ address is often a real person at a brand
// the engine has written to; mail-triage.js makes the same call about info@ and
// hello@. Out of the inbox is enough for both.
hubFilters.push({
  what: "promotions, social and bulk-shaped senders (archived, marked read)",
  criteria: {
    query: `(category:promotions OR category:social OR from:(marketing OR notifications OR mailer-daemon OR postmaster)) ${NEVER_TOUCH}`,
  },
  action: { addLabelIds: [labelId("Topics/Noise")], removeLabelIds: BURY },
});

// Out-of-office and ticket acknowledgements. Safe to bury HERE: the backlink
// engine reads each title's own mailbox, not this one, and it is the engine
// rather than JB that has any use for an auto-ack.
hubFilters.push({
  what: `auto-replies${noiseWord}`,
  criteria: { query: `${AUTO_REPLY} ${NEVER_BIN}` },
  action: noiseAction(),
});

// The certainties: an address that cannot receive a reply, and mail carrying a
// List-Id. Neither is ever a person writing to us.
hubFilters.push({
  what: `no-reply senders and mailing lists${noiseWord}`,
  criteria: { query: `(from:(no-reply OR noreply OR donotreply OR do-not-reply) OR list:*) ${NEVER_BIN}` },
  action: noiseAction(),
});

await ensureFilters(
  hubToken,
  hubFilters,
  "hub",
  [...Object.values(TITLE_LABEL), ...TOPIC_LABELS].map(labelId).filter(Boolean)
);

// Send-as, so a reply typed in the hub leaves as the right title rather than as
// Smart SME.
const sendAs = (await api(hubToken, "/settings/sendAs")).sendAs || [];
const haveSendAs = new Map(sendAs.map((s) => [s.sendAsEmail.toLowerCase(), s]));
for (const t of titles) {
  if (t.fromEmail === HUB) continue;
  const row = haveSendAs.get(t.fromEmail.toLowerCase());
  if (row) {
    say(`send-as exists: ${t.fromEmail} (${row.verificationStatus || "accepted"})`);
    continue;
  }
  say(`add send-as: ${t.fromEmail}`);
  if (APPLY)
    await api(hubToken, "/settings/sendAs", {
      method: "POST",
      body: {
        sendAsEmail: t.fromEmail,
        displayName: t.fromName || "James Burke",
        replyToAddress: t.fromEmail,
        treatAsAlias: false,
      },
    });
}

// ------------------------------------------------------- the four feeders ---
// leaveInInbox, not archive: the reply-detection code reads each title's own
// inbox, and an archived copy is invisible to a labelIds=INBOX listing.
for (const t of titles) {
  if (t.fromEmail === HUB) continue;
  console.log(`\n--- ${t.name} (${t.fromEmail})`);
  const token = await getGoogleAccessToken(SCOPES, t.fromEmail);

  const addrs = (await api(token, "/settings/forwardingAddresses")).forwardingAddresses || [];
  const known = addrs.find((a) => a.forwardingEmail.toLowerCase() === HUB.toLowerCase());
  if (known) say(`forwarding address exists: ${HUB} (${known.verificationStatus})`);
  else {
    say(`add forwarding address: ${HUB}`);
    if (APPLY) await api(token, "/settings/forwardingAddresses", { method: "POST", body: { forwardingEmail: HUB } });
  }

  const auto = await api(token, "/settings/autoForwarding");
  if (auto.enabled && auto.emailAddress?.toLowerCase() === HUB.toLowerCase() && auto.disposition === "leaveInInbox") {
    say("auto-forwarding already on and keeping its copy");
  } else {
    say(`turn on auto-forwarding to ${HUB}, keeping a copy in this inbox`);
    if (APPLY)
      await api(token, "/settings/autoForwarding", {
        method: "PUT",
        body: { enabled: true, emailAddress: HUB, disposition: "leaveInInbox" },
      });
  }

  // The one filter every title mailbox needs in its own right. Nothing is
  // archived or labelled here: this mailbox is read by machines, and the only
  // thing that can hurt it is Gmail hiding a reply in spam.
  await ensureFilters(
    token,
    [
      { what: "never spam: interview replies", criteria: { query: INTERVIEW_SUBJECTS }, action: { removeLabelIds: ["SPAM"] } },
      { what: "never spam: bounces", criteria: { query: BOUNCE_SENDERS }, action: { removeLabelIds: ["SPAM"] } },
    ],
    t.name
  );
}

console.log(`\n${APPLY ? "Applied." : "Dry run only. Re-run with --apply to write."}`);
