// Labels and filters for the press@ addresses, on every title mailbox and the hub.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/press-inbox-setup.mjs
//   ... --apply
//
// Three jobs, in order of importance.
//
// NEVER SPAM. A press release is bulk mail from an agency to an address with no
// sending history, which is the exact shape Gmail flags. JB's own test to
// press@airportbusinessmagazine.com landed in spam on 11 Sep. That matters more
// than tidiness: Gmail search skips Spam, so anything filed there is invisible
// to the intake automation as well as to JB, and the release silently never
// happens. The forwarded copy in the hub is worse again, because forwarding
// breaks SPF and DKIM alignment at the second hop.
//
// ONE PLACE TO LOOK. Topics/Press on the title mailbox and on the hub, with the
// hub copy also carrying the title label, so "all press" and "Fleet press" are
// both one click.
//
// A STATE MACHINE THE AUTOMATION WRITES AND A HUMAN CAN READ. Press/Published,
// Press/Needs review and Press/Replied are applied by the intake job, so the
// labels answer "what happened to that release" without opening a database.
// The job is lib/press-intake.js, since 21 Sep 2026; it also adds Scheduled
// (an embargoed piece waiting in WordPress) and Skipped (sorted out as noise).
//
// SEND-AS press@. The desk thanks each sender from the address they wrote to,
// which Gmail only allows once press@ is a send-as identity on the mailbox.
// Same organisation, so it is accepted at once with no confirmation email.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const APPLY = process.argv.includes("--apply");
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// One list, kept in lib/inbox-labels.js, so a new title is added in one place.
import { TITLE_LABEL } from "../lib/inbox-labels.js";
const PRESS_LABELS = [
  "Topics/Press",
  "Press/Published",
  "Press/Scheduled",
  "Press/Needs review",
  "Press/Skipped",
  "Press/Replied",
];

// "Gym Business News News Desk" reads as a typo.
const deskName = (name) => (/\bnews$/i.test(name) ? `${name} Desk` : `${name} News Desk`);

const say = (s) => console.log(`${APPLY ? "" : "[dry run] "}${s}`);

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

async function ensureLabels(token, names, who) {
  const live = (await api(token, "/labels")).labels || [];
  const byName = new Map(live.map((l) => [l.name, l]));
  for (const name of names) {
    if (byName.has(name)) continue;
    say(`${who}: create label ${name}`);
    if (APPLY) {
      const made = await api(token, "/labels", {
        method: "POST",
        body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
      });
      byName.set(name, made);
    } else byName.set(name, { id: `PENDING:${name}` });
  }
  return byName;
}

// Gmail cannot edit a filter, so a changed action means delete and recreate.
const norm = (a = {}) =>
  JSON.stringify({ add: [...(a.addLabelIds || [])].sort(), remove: [...(a.removeLabelIds || [])].sort() });

// -from:me because Gmail filters also run on mail a mailbox SENDS, and a
// never-spam action on an outgoing message drops it into the inbox (the 11 Sep
// outbox leak). Without it a reply to a PR agency lands in the hub as Press.
const pressQuery = (press) => `(to:${press} OR deliveredto:${press} OR cc:${press}) -from:me`;
const legacyQuery = (press) => `to:${press} OR deliveredto:${press} OR cc:${press}`;

async function ensureFilter(token, who, { query, legacy, action, what }) {
  let live = (await api(token, "/settings/filters")).filter || [];
  // A changed query leaves the old rule running unless something removes it.
  for (const old of live.filter((l) => legacy && l.criteria?.query === legacy)) {
    say(`${who}: remove superseded filter: ${legacy}`);
    if (APPLY) await api(token, `/settings/filters/${old.id}`, { method: "DELETE" });
  }
  const match = live.find((l) => l.criteria?.query === query);
  if (match && norm(match.action) === norm(action)) {
    say(`${who}: filter unchanged: ${what}`);
    return;
  }
  if (match) {
    say(`${who}: rebuild filter: ${what}`);
    if (APPLY) await api(token, `/settings/filters/${match.id}`, { method: "DELETE" });
  } else say(`${who}: create filter: ${what}`);
  if (APPLY) await api(token, "/settings/filters", { method: "POST", body: { criteria: { query }, action } });
}

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();
const titles = creds
  .map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) }))
  .filter((t) => t.fromEmail && TITLE_LABEL[t.slug]);

// ---- each title's own mailbox -----------------------------------------------
for (const t of titles) {
  const press = `press@${t.fromEmail.split("@")[1]}`;
  const token = await getGoogleAccessToken(SCOPES, t.fromEmail);
  const labels = await ensureLabels(token, PRESS_LABELS, t.name);
  await ensureFilter(token, t.name, {
    query: pressQuery(press),
    legacy: legacyQuery(press),
    action: { addLabelIds: [labels.get("Topics/Press").id], removeLabelIds: ["SPAM"] },
    what: `${press} -> Topics/Press, never spam`,
  });
  const sendAs = (await api(token, "/settings/sendAs")).sendAs || [];
  const mine = sendAs.find((x) => x.sendAsEmail.toLowerCase() === press);
  if (mine) say(`${t.name}: send-as ${press} already there (${mine.verificationStatus || "primary"})`);
  else {
    say(`${t.name}: add send-as ${press} as "${deskName(t.name)}"`);
    if (APPLY) {
      const made = await api(token, "/settings/sendAs", {
        method: "POST",
        body: { sendAsEmail: press, displayName: `${deskName(t.name)}`, treatAsAlias: true },
      });
      say(`${t.name}:   -> ${made.verificationStatus}`);
    }
  }
}

// ---- the hub ----------------------------------------------------------------
// Gmail allows exactly ONE user label per filter, so the hub filter carries
// Topics/Press and never-spam only. The title axis stays with the per-title
// filters in gmail-hub-setup.mjs, whose queries now include each press address:
// one script owns the Titles/* rules and this one cannot fight it.
const hubToken = await getGoogleAccessToken(SCOPES, HUB);
const hubLabels = await ensureLabels(hubToken, PRESS_LABELS, "hub");
const hubDomain = HUB.split("@")[1];
for (const t of titles) {
  const domain = t.fromEmail.split("@")[1];
  // The hub is Smart SME own mailbox, so its press filter was written by the
  // loop above. Rebuilding it here would delete and recreate the same rule.
  if (domain === hubDomain) continue;
  const press = `press@${domain}`;
  await ensureFilter(hubToken, "hub", {
    query: pressQuery(press),
    legacy: legacyQuery(press),
    action: { addLabelIds: [hubLabels.get("Topics/Press").id], removeLabelIds: ["SPAM"] },
    what: `${press} (forwarded copy) -> Topics/Press, never spam`,
  });
}
console.log(`
${APPLY ? "Applied" : "Dry run"}: ${titles.length} title mailboxes plus the hub.`);
