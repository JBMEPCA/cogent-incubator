// Add a press@ alias to each title's Workspace user, so PR distribution lists
// land on an address of their own instead of in the mailbox the engines read.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_press-aliases.mjs
//   ... --apply     actually create them (default is a dry run)
//
// Aliases, not new users: the five jb@ accounts must stay separate users
// because the outreach and interview engines impersonate each one, and an alias
// costs no seat and changes no sending identity.
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { getGoogleAccessToken } from "../lib/google.js";

const APPLY = process.argv.includes("--apply");
const ADMIN = process.env.GMAIL_HUB || "jb@smartsme.co.uk";
// Directory writes need an admin subject, not just the scope.
const SCOPES = ["https://www.googleapis.com/auth/admin.directory.user.alias"];
const API = "https://admin.googleapis.com/admin/directory/v1";

import { TITLE_LABEL } from "../lib/inbox-labels.js";
const SLUGS = Object.keys(TITLE_LABEL);

const prisma = new PrismaClient();
const creds = await prisma.siteCredential.findMany({
  where: { kind: "outreach" },
  select: { payloadEnc: true, site: { select: { name: true, slug: true } } },
});
await prisma.$disconnect();

const titles = creds
  .map((c) => ({ ...c.site, ...decryptJson(c.payloadEnc) }))
  .filter((t) => t.fromEmail && SLUGS.includes(t.slug));

console.log(`${titles.length} title mailboxes: ${titles.map((t) => t.fromEmail).join(", ")}\n`);

let token;
try {
  token = await getGoogleAccessToken(SCOPES, ADMIN);
} catch (e) {
  console.error(`No token for ${SCOPES[0]} as ${ADMIN}: ${e.message}`);
  console.error("That scope has to be on the domain-wide delegation, and the subject has to be a super admin.");
  process.exit(1);
}

async function api(path, { method = "GET", body } = {}) {
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

for (const t of titles) {
  const user = t.fromEmail;
  const alias = `press@${user.split("@")[1]}`;
  let live;
  try {
    live = (await api(`/users/${encodeURIComponent(user)}/aliases`)).aliases || [];
  } catch (e) {
    console.log(`${t.name}: could not read aliases — ${e.message}`);
    continue;
  }
  const have = live.map((a) => a.alias.toLowerCase());
  if (have.includes(alias)) {
    console.log(`${t.name}: alias exists: ${alias}`);
    continue;
  }
  console.log(`${APPLY ? "" : "[dry run] "}${t.name}: create ${alias} on ${user}${have.length ? ` (existing: ${have.join(", ")})` : ""}`);
  if (APPLY) {
    try {
      await api(`/users/${encodeURIComponent(user)}/aliases`, { method: "POST", body: { alias } });
      console.log(`  created ${alias}`);
    } catch (e) {
      console.log(`  FAILED: ${e.message}`);
    }
  }
}
