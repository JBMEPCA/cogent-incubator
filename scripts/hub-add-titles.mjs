// Bring every title into the hub inbox, and keep the rules that protect it
// honest. Safe to run again after every launch: it only ever adds what is
// missing, and removes exactly two kinds of filter it knows it wrote wrong.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/hub-add-titles.mjs
//   ... --apply     write (default is a dry run)
//
// A title is included when it is in TITLE_LABEL (lib/inbox-labels.js) AND has
// an outreach credential naming its mailbox. Seed the credential first:
//   scripts/seed-outreach-credential.mjs <slug> jb@<domain>
//
// Why this and not gmail-hub-setup.mjs: that script prunes any filter applying
// one of our labels that it does not itself describe. The press@ intake rules
// were built on top of it in a separate change, so running an older copy of it
// deletes them. This one never prunes by label. Its title filter is written in
// the same press-aware form the live rules already use, so the two stay in step.
//
// Per title mailbox that is not the hub:
//   forward a copy to the hub, keeping its own (reply detection reads it)
//   never-spam for interview replies, inbound only
//   never-spam for bounces
// On the hub:
//   Titles/<name> label, and the filter that applies it
//   send-as, so a reply leaves from the right title
//   one never-spam rule covering every forwarded copy
//   never-spam for interview replies, inbound only
// Everywhere:
//   take our own sent mail back out of the inbox
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";
import { TITLE_LABEL } from "../lib/inbox-labels.js";

const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const APPLY = process.argv.includes("--apply");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Gmail's own palette only; a refused colour falls back to a plain label.
const COLOUR = {
  "Titles/SME": "#4a86e8",
  "Titles/Fleet": "#16a766",
  "Titles/Golf": "#fad165",
  "Titles/Barbering": "#a479e2",
  "Titles/Airports": "#fb4c2f",
  "Titles/Gym": "#ffad47",
  "Titles/Nursery": "#f691b3",
  "Titles/Farming": "#43d692",
  "Titles/Retirement": "#8e63ce",
  "Titles/Dental": "#2da2bb",
};

const INTERVIEW_SUBJECTS = 'subject:("Featuring you in" OR "Seven questions for")';

// Gmail runs filters over mail you SEND, and a never-spam action on an outgoing
// message files it in the inbox. Without -from:me every interview ask the
// engine sent landed in JB's inbox, already read. The first fix added this
// safe rule but left the unsafe one in place, so it kept happening for another
// week; that is why the unsafe form is deleted by exact match below.
const INTERVIEW_INBOUND = `${INTERVIEW_SUBJECTS} -from:me`;
const BOUNCES = "from:(mailer-daemon OR postmaster OR mailer-daemon@googlemail.com)";

const say = (s) => console.log(`${APPLY ? "" : "[dry run] "}${s}`);

async function api(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

const onlyUnspam = (f) =>
  !(f.action?.addLabelIds || []).length && JSON.stringify(f.action?.removeLabelIds || []) === '["SPAM"]';

// Add the filters in `wanted` that are missing, and delete the filters the
// `drop` predicate identifies. Nothing else is touched.
async function reconcile(token, who, wanted, drop = () => false) {
  const live = (await api(token, "/settings/filters")).filter || [];
  for (const f of live) {
    if (!drop(f)) continue;
    say(`${who}: delete ${f.criteria?.query?.slice(0, 70)}`);
    if (APPLY) await api(token, `/settings/filters/${f.id}`, { method: "DELETE" });
  }
  for (const w of wanted) {
    const have = live.some(
      (f) =>
        !drop(f) &&
        f.criteria?.query === w.criteria.query &&
        JSON.stringify([...(f.action?.addLabelIds || [])].sort()) === JSON.stringify([...(w.action.addLabelIds || [])].sort()) &&
        JSON.stringify([...(f.action?.removeLabelIds || [])].sort()) === JSON.stringify([...(w.action.removeLabelIds || [])].sort())
    );
    if (have) continue;
    say(`${who}: add ${w.what}`);
    if (APPLY) await api(token, "/settings/filters", { method: "POST", body: { criteria: w.criteria, action: w.action } });
  }
}

async function unInboxOurSends(token, who) {
  const ids = [];
  let page;
  do {
    const r = await api(token, `/messages?q=${encodeURIComponent("in:inbox in:sent")}&maxResults=500${page ? `&pageToken=${page}` : ""}`);
    ids.push(...(r.messages || []).map((m) => m.id));
    page = r.nextPageToken;
  } while (page);
  if (!ids.length) return;
  say(`${who}: take ${ids.length} of our own sent messages out of the inbox`);
  if (!APPLY) return;
  for (let i = 0; i < ids.length; i += 900) {
    await api(token, "/messages/batchModify", { method: "POST", body: { ids: ids.slice(i, i + 900), removeLabelIds: ["INBOX"] } });
  }
}

// ------------------------------------------------------------- the titles ---
const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();

const titles = [];
for (const c of creds) {
  const label = TITLE_LABEL[c.site.slug];
  if (!label) continue;
  let email;
  try {
    email = decryptJson(c.payloadEnc)?.fromEmail;
  } catch {
    continue;
  }
  if (email) titles.push({ name: c.site.name, slug: c.site.slug, email: email.toLowerCase(), label, fromName: "James Burke" });
}
const missing = Object.keys(TITLE_LABEL).filter((s) => !titles.some((t) => t.slug === s));
if (missing.length) console.log(`Not included, no outreach credential yet: ${missing.join(", ")}\n`);
if (!titles.some((t) => t.email === HUB)) {
  console.error(`${HUB} is not among the title mailboxes.`);
  process.exit(1);
}
const feeders = titles.filter((t) => t.email !== HUB);
const pending = [];
console.log(`${titles.length} titles, hub ${HUB}, ${feeders.length} forwarding into it\n`);

// ------------------------------------------------------------- the feeders ---
for (const t of feeders) {
  const token = await getGoogleAccessToken(SCOPES, t.email);
  const who = t.name;

  let addrs = (await api(token, "/settings/forwardingAddresses")).forwardingAddresses || [];
  if (!addrs.some((a) => a.forwardingEmail.toLowerCase() === HUB)) {
    say(`${who}: add forwarding address ${HUB}`);
    if (APPLY) {
      await api(token, "/settings/forwardingAddresses", { method: "POST", body: { forwardingEmail: HUB } });
      addrs = (await api(token, "/settings/forwardingAddresses")).forwardingAddresses || [];
    }
  }
  // Inside one Workspace organisation Google accepts a forwarding address on
  // the spot. The 18 Sep titles came back `pending`, meaning Google treats them
  // as outside the hub's organisation and has emailed a confirmation link to
  // the hub. Until someone clicks it, switching forwarding on is refused with
  // "Invalid forwarding address", so say what is needed and carry on with the
  // rest rather than dying on the first title.
  const status = addrs.find((a) => a.forwardingEmail.toLowerCase() === HUB)?.verificationStatus;
  if (APPLY && status && status !== "accepted") {
    console.log(`${who}: forwarding to ${HUB} is ${status} — confirm the Google email in the hub, then re-run`);
    pending.push(t.email);
  }
  const auto = await api(token, "/settings/autoForwarding");
  if (status === "accepted" || !APPLY) if (!(auto.enabled && auto.emailAddress?.toLowerCase() === HUB && auto.disposition === "leaveInInbox")) {
    say(`${who}: forward a copy of everything to ${HUB}, keeping its own`);
    if (APPLY)
      await api(token, "/settings/autoForwarding", {
        method: "PUT",
        body: { enabled: true, emailAddress: HUB, disposition: "leaveInInbox" },
      });
  }

  await reconcile(
    token,
    who,
    [
      { what: "never spam: interview replies (inbound only)", criteria: { query: INTERVIEW_INBOUND }, action: { removeLabelIds: ["SPAM"] } },
      { what: "never spam: bounces", criteria: { query: BOUNCES }, action: { removeLabelIds: ["SPAM"] } },
    ],
    (f) => onlyUnspam(f) && f.criteria?.query === INTERVIEW_SUBJECTS
  );
  await unInboxOurSends(token, who);
}

// ----------------------------------------------------------------- the hub ---
const hub = await getGoogleAccessToken(SCOPES, HUB);

const labels = (await api(hub, "/labels")).labels || [];
const labelId = new Map(labels.map((l) => [l.name, l.id]));
for (const t of titles) {
  if (labelId.has(t.label)) continue;
  say(`hub: create label ${t.label}`);
  if (!APPLY) {
    labelId.set(t.label, `PENDING:${t.label}`);
    continue;
  }
  const body = { name: t.label, labelListVisibility: "labelShow", messageListVisibility: "show" };
  let made;
  try {
    made = await api(hub, "/labels", {
      method: "POST",
      body: COLOUR[t.label] ? { ...body, color: { backgroundColor: COLOUR[t.label], textColor: "#ffffff" } } : body,
    });
  } catch {
    made = await api(hub, "/labels", { method: "POST", body });
  }
  labelId.set(t.label, made.id);
}

const feederList = feeders.map((t) => t.email).join(" OR ");
const forwardedQuery = `to:(${feederList}) OR cc:(${feederList}) OR deliveredto:(${feederList})`;

const hubWanted = [
  { what: "never spam: interview replies (inbound only)", criteria: { query: INTERVIEW_INBOUND }, action: { removeLabelIds: ["SPAM"] } },
  { what: "never spam: bounces", criteria: { query: BOUNCES }, action: { removeLabelIds: ["SPAM"] } },
  // A forwarded copy is re-delivered by us, so SPF and DKIM no longer align at
  // the second hop and Gmail can score a real reply as spam. It did, on 9 Sep.
  { what: `never spam: copies forwarded from ${feeders.length} titles`, criteria: { query: forwardedQuery }, action: { removeLabelIds: ["SPAM"] } },
];
for (const t of titles) {
  // The same press-aware form the live rules use: jb@ is the person, press@ the
  // PR intake alias, and a release earns the title label like a reply does.
  const domain = t.email.split("@")[1];
  const a = `${t.email} OR press@${domain}`;
  const isHub = t.email === HUB;
  hubWanted.push({
    what: `${t.label} for ${t.email} and its press alias`,
    criteria: {
      // Never deliveredto: for the hub. Every forwarded copy carries the hub's
      // Delivered-To as well as its own, so that clause claimed every message.
      query: isHub ? `to:(${a}) OR cc:(${a})` : `to:(${a}) OR cc:(${a}) OR deliveredto:(${a})`,
    },
    action: { addLabelIds: [labelId.get(t.label)] },
  });
}

await reconcile(
  hub,
  "hub",
  hubWanted,
  (f) =>
    onlyUnspam(f) &&
    // the unsafe interview rule, by exact match
    (f.criteria?.query === INTERVIEW_SUBJECTS ||
      // an older forwarded-copies rule that lists fewer titles than this one
      (/^to:\(jb@/.test(f.criteria?.query || "") && /deliveredto:\(/.test(f.criteria?.query || "") && f.criteria.query !== forwardedQuery))
);

const sendAs = (await api(hub, "/settings/sendAs")).sendAs || [];
const have = new Set(sendAs.map((s) => s.sendAsEmail.toLowerCase()));
for (const t of feeders) {
  if (have.has(t.email)) continue;
  say(`hub: send as ${t.email}`);
  if (APPLY)
    await api(hub, "/settings/sendAs", {
      method: "POST",
      body: { sendAsEmail: t.email, displayName: t.fromName, replyToAddress: t.email, treatAsAlias: false },
    });
}

await unInboxOurSends(hub, "hub");

// Pending, and on 18 Sep no confirmation email was ever sent: the four
// affected mailboxes had identical DNS to the one that went through, so the
// cause is on the Admin console side (automatic forwarding allowed per
// organisational unit), not something a click can clear.
if (pending.length) {
  console.log(`\nForwarding NOT on yet for: ${pending.join(", ")}`);
  console.log("Check Admin console > Apps > Google Workspace > Gmail > End User Access >");
  console.log("automatic forwarding, for the organisational unit those users are in. Then re-run.");
}
console.log(`\n${APPLY ? "Applied." : "Dry run only. Re-run with --apply."}`);
