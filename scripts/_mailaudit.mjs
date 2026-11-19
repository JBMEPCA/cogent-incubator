// Read-only: what forwarding and send-as every title mailbox actually has.
// Uses the same delegation as set-gmail-signatures.mjs.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_mailaudit.mjs
import { getGoogleAccessToken } from "../lib/google.js";

const HUB = "jb@smartsme.co.uk";
const OLD = [
  "jb@thefleetmagazine.co.uk", "jb@golfresortmagazine.com", "jb@barberingbusiness.com",
  "jb@airportbusinessmagazine.com", "jb@gymbusinessnews.com", "jb@nurserydaily.com",
  "jb@seniorlifestylebusiness.com", "jb@dentalbusinessnews.com", "jb@smartfarmingnews.com",
];
const NEW = [
  "jb@fmweekly.com", "jb@datacentretoday.com", "jb@stadiumarenabusiness.com",
  "jb@retailbusinessmagazine.com", "jb@travelbusinessnews.com",
];
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];

async function get(token, path) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/settings/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { ok: r.ok, status: r.status, body: await r.json() };
}

async function audit(mailbox) {
  let token;
  try {
    token = await getGoogleAccessToken(SCOPES, mailbox);
  } catch (e) {
    return `${mailbox.padEnd(34)} TOKEN FAILED ${String(e.message).slice(0, 60)}`;
  }
  const fwd = await get(token, "autoForwarding");
  const addrs = await get(token, "forwardingAddresses");
  const sendAs = await get(token, "sendAs");

  if (!fwd.ok) return `${mailbox.padEnd(34)} ERROR ${fwd.status} ${JSON.stringify(fwd.body).slice(0, 90)}`;

  const f = fwd.body;
  const fwdTxt = f.enabled
    ? `FORWARDS -> ${f.emailAddress} (${f.disposition})`
    : "NO FORWARDING";
  const pending = (addrs.body.forwardingAddresses || [])
    .map((a) => `${a.forwardingEmail}:${a.verificationStatus}`)
    .join(", ") || "none registered";
  const others = (sendAs.body.sendAs || []).filter((s) => !s.isPrimary).map((s) => s.sendAsEmail);

  return [
    mailbox.padEnd(34),
    fwdTxt.padEnd(46),
    "| fwdAddrs: " + pending.padEnd(44),
    "| extra sendAs: " + (others.join(", ") || "none"),
  ].join("");
}

console.log("=== HUB ===");
const hubToken = await getGoogleAccessToken(SCOPES, HUB);
const hubSendAs = await get(hubToken, "sendAs");
for (const s of (hubSendAs.body.sendAs || []).sort((a, b) => a.sendAsEmail.localeCompare(b.sendAsEmail))) {
  console.log(
    "  " + s.sendAsEmail.padEnd(34),
    s.isPrimary ? "primary " : "        ",
    "verified=" + String(s.verificationStatus || "-").padEnd(10),
    "treatAsAlias=" + String(!!s.treatAsAlias).padEnd(6),
    "replyTo=" + (s.replyToAddress || "-")
  );
}

console.log("\n=== THE NINE OLDER TITLE MAILBOXES ===");
for (const m of OLD) console.log(await audit(m));

console.log("\n=== THE FIVE NEW ONES ===");
for (const m of NEW) console.log(await audit(m));
