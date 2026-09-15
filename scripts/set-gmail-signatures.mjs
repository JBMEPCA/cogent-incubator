// Gmail signatures carrying each title's masthead, on every send-as identity:
// the five title mailboxes, and the hub's send-as addresses for the other four.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/set-gmail-signatures.mjs          dry run
//   node --env-file=.env --import ./scripts/_register.mjs scripts/set-gmail-signatures.mjs --apply
//
// Needs gmail.settings.basic and gmail.settings.sharing on the service account's domain-wide delegation
// (granted 8 Sep 2026 for the hub inbox work).
//
// Signatures only apply to mail written in Gmail itself. The outreach and
// interview engines send through the API, which never appends one, and carry
// their own sign-off block with the same logo from lib/outreach.js.
//
// The logo is served by this app at /api/brand/logo/<slug> (the one-line mark),
// the same URL outreach emails already use, rather than from the title sites,
// whose SiteGround bot challenge can refuse automated image fetches.
import { getGoogleAccessToken } from "../lib/google.js";

const APPLY = process.argv.includes("--apply");
const LOGO_BASE = "https://cogent-incubator.vercel.app/api/brand/logo";
const NAME = "James Burke";

const TITLES = {
  "jb@smartsme.co.uk": { slug: "smart-sme", name: "Smart SME", domain: "smartsme.co.uk", accent: "#2E3EEE", logoHeight: 30 },
  "jb@thefleetmagazine.co.uk": { slug: "fleet-magazine", name: "The Fleet Magazine", domain: "thefleetmagazine.co.uk", accent: "#1D5FAA", logoHeight: 20 },
  "jb@golfresortmagazine.com": { slug: "golf-resort-magazine", name: "Golf Resort Magazine", domain: "golfresortmagazine.com", accent: "#15694A", logoHeight: 28 },
  "jb@barberingbusiness.com": { slug: "barbering-business", name: "Barbering Business", domain: "barberingbusiness.com", accent: "#6E2B2B", logoHeight: 22 },
  "jb@airportbusinessmagazine.com": { slug: "airport-business-magazine", name: "Airport Business Magazine", domain: "airportbusinessmagazine.com", accent: "#123B66", logoHeight: 26 },
};

// Heights differ because the marks differ: a long one-line mark at the height
// of a compact two-line lockup would run half the width of the email.
function signature(t) {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#1c2027">` +
    `<strong>${NAME}</strong><br>` +
    `<span style="color:#6b7280">Editor, ${t.name}</span><br>` +
    `<a href="https://${t.domain}" style="color:${t.accent};text-decoration:none">${t.domain}</a>` +
    `</div>` +
    `<div style="margin-top:10px">` +
    `<a href="https://${t.domain}"><img src="${LOGO_BASE}/${t.slug}" alt="${t.name}" height="${t.logoHeight}" style="height:${t.logoHeight}px;width:auto;border:0"></a>` +
    `</div>`
  );
}

// settings.sharing is what Gmail demands for a non-primary send-as address,
// which is how the hub sends as the other four titles.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];
let failures = 0;

for (const mailbox of Object.keys(TITLES)) {
  const token = await getGoogleAccessToken(SCOPES, mailbox);
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
    headers: { authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  for (const identity of list.sendAs || []) {
    const t = TITLES[identity.sendAsEmail];
    if (!t) {
      console.log(`${mailbox} :: ${identity.sendAsEmail}  skipped, not a title address`);
      continue;
    }
    const html = signature(t);
    if (!APPLY) {
      console.log(`${mailbox} :: ${identity.sendAsEmail}  would set ${t.name} signature (${html.length} chars)`);
      continue;
    }
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(identity.sendAsEmail)}`,
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ signature: html }),
      }
    );
    const body = await res.json();
    const ok = res.ok && body.signature && body.signature.includes(`/api/brand/logo/${t.slug}`);
    if (!ok) failures++;
    console.log(`${mailbox} :: ${identity.sendAsEmail}  ${ok ? "set" : `FAILED ${res.status} ${JSON.stringify(body).slice(0, 160)}`}`);
  }
}

if (!APPLY) console.log(`\nDry run. Sample:\n${signature(TITLES["jb@barberingbusiness.com"])}\n\nRerun with --apply to set them.`);
process.exit(failures ? 1 : 0);
