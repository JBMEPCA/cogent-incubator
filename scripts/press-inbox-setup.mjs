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
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const APPLY = process.argv.includes("--apply");
const HUB = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// One list, kept in lib/inbox-labels.js, so a new title is added in one place.
import { TITLE_LABEL } from "../lib/inbox-labels.js";
const PRESS_LABELS = ["Topics/Press", "Press/Published", "Press/Needs review", "Press/Replied"];

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

async function ensureFilter(token, who, { query, action, what }) {
  const live = (await api(token, "/settings/filters")).filter || [];
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
    query: `to:${press} OR deliveredto:${press} OR cc:${press}`,
    action: { addLabelIds: [labels.get("Topics/Press").id], removeLabelIds: ["SPAM"] },
    what: `${press} -> Topics/Press, never spam`,
  });
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
    query: `to:${press} OR deliveredto:${press} OR cc:${press}`,
    action: { addLabelIds: [hubLabels.get("Topics/Press").id], removeLabelIds: ["SPAM"] },
    what: `${press} (forwarded copy) -> Topics/Press, never spam`,
  });
}
console.log(`
${APPLY ? "Applied" : "Dry run"}: ${titles.length} title mailboxes plus the hub.`);
