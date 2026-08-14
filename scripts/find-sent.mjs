// Where did the outreach actually go? Reads the Gmail mailbox the engine sends
// from, using the same service account and domain-wide delegation it uses to
// send. Read-only.

import fs from "node:fs";
import crypto from "node:crypto";

const SA_PATH = (fs.readFileSync(".env", "utf8").match(/^GOOGLE_SERVICE_ACCOUNT_JSON_PATH=(.+)$/m) || [])[1]
  ?.trim().replace(/^["']|["']$/g, "");
if (!SA_PATH) { console.log("GOOGLE_SERVICE_ACCOUNT_JSON_PATH not in .env"); process.exit(1); }

const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf8"));
const SUBJECT = process.argv[2] || "jb@smartsme.co.uk";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

async function token(scope, subject) {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: sa.client_email, sub: subject, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(`${res.status} ${JSON.stringify(d)}`);
  return d.access_token;
}

console.log(`service account : ${sa.client_email}`);
console.log(`impersonating   : ${SUBJECT}\n`);

let t;
try {
  t = await token("https://www.googleapis.com/auth/gmail.readonly", SUBJECT);
} catch (e) {
  console.log(`Could not get a token: ${e.message}\n`);
  console.log("That usually means domain-wide delegation is not granted for the");
  console.log("gmail.readonly scope, or there is no Google account for this address.");
  process.exit(1);
}

const g = async (p) => (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${p}`, { headers: { Authorization: `Bearer ${t}` } })).json();

const list = await g("/messages?q=in:sent&maxResults=10");
console.log(`messages in Sent: ${list.resultSizeEstimate ?? 0}`);
if (list.error) { console.log(JSON.stringify(list.error).slice(0, 300)); process.exit(1); }

for (const m of list.messages ?? []) {
  const full = await g(`/messages/${m.id}?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
  const h = Object.fromEntries((full.payload?.headers ?? []).map((x) => [x.name, x.value]));
  console.log(`\n  ${h.Date}`);
  console.log(`  From: ${h.From}`);
  console.log(`  To:   ${h.To}`);
  console.log(`  Subj: ${h.Subject}`);
}
