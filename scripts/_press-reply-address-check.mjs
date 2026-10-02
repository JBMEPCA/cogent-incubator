// Who gets the "you're live" reply when a colleague forwards a release in?
//
//   node scripts/_press-reply-address-check.mjs
//
// The real functions are lifted out of the sources and run together, because
// press-intake.js pulls in the Anthropic SDK and mail-triage.js pulls in
// ./gmail, so neither imports without the full install. What is under test is
// the shipped text, not a paraphrase of it.
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const intake = read("../lib/press-intake.js");
const triage = read("../lib/mail-triage.js");

const grab = (src, re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`could not lift ${what}`);
  return m[0].replace(/^export /, "");
};

const parts = [
  grab(triage, /const MACHINE_LOCALPARTS =[\s\S]*?;/, "MACHINE_LOCALPARTS"),
  grab(triage, /const NOISE_DOMAINS = \[[\s\S]*?\n\];/, "NOISE_DOMAINS"),
  grab(triage, /(export )?function isNoiseDomain[\s\S]*?\n}/, "isNoiseDomain"),
  grab(triage, /(export )?function parseAddress[\s\S]*?\n}/, "parseAddress"),
  grab(triage, /(export )?function isMachineSender[\s\S]*?\n}/, "isMachineSender"),
  grab(intake, /const COMPANY_DOMAINS = \[[\s\S]*?\n\];/, "COMPANY_DOMAINS"),
  grab(intake, /const OUR_DOMAINS = new Set\(COMPANY_DOMAINS\);/, "OUR_DOMAINS"),
  grab(intake, /function forwardedSender[\s\S]*?\n}/, "forwardedSender"),
  grab(intake, /function replyAddress[\s\S]*?\n}/, "replyAddress"),
];

const { replyAddress, OUR_DOMAINS } = new Function(
  `${parts.join("\n\n")}\nreturn { replyAddress, OUR_DOMAINS };`,
)();

// The title mail domains runPressIntake adds at boot.
for (const d of ["smartsme.co.uk", "seniorlifestylebusiness.com", "golfresortmagazine.com"]) OUR_DOMAINS.add(d);

const GMAIL_FWD = `Morning, one for the desk.

---------- Forwarded message ---------
From: Emily Ireton-Bourke <emily@luckynorth.co.uk>
Date: Thu, 1 Oct 2026 at 08:53
Subject: Sector-first platform set to redefine independent living launches
To: <lucas@cimltd.co.uk>

Good morning, Hope you're well. Social care continues to be under pressure...`;

const OUTLOOK_FWD = `FYI

From: Sarah Jones <sarah@abccomms.co.uk>
Sent: 30 September 2026 14:02
To: Dec Smith <dec@cimltd.co.uk>
Subject: PRESS RELEASE: KUHN introduces the trailed APEX direct drill

Please find attached...`;

const NESTED = `Passing on.

From: Lucas Payne <lucas@cimltd.co.uk>
Sent: 1 October 2026 09:10
To: James Davies <jamesd@cimltd.co.uk>
Subject: FW: Release

From: Roddy Williams <roddy@theazaleagroup.com>
Sent: 1 October 2026 08:40
Subject: Release`;

const cases = [
  ["direct from the agency", { from: "Emily Ireton-Bourke <emily@luckynorth.co.uk>", replyTo: "", text: "Here is the release." }, "emily@luckynorth.co.uk"],
  ["Lucas forwards, Gmail style", { from: "Lucas Payne <lucas@cimltd.co.uk>", replyTo: "", text: GMAIL_FWD }, "emily@luckynorth.co.uk"],
  ["Dec forwards, Outlook style", { from: "Dec <dec@cimltd.co.uk>", replyTo: "", text: OUTLOOK_FWD }, "sarah@abccomms.co.uk"],
  ["forwarded twice between colleagues", { from: "James Davies <jamesd@cimltd.co.uk>", replyTo: "", text: NESTED }, "roddy@theazaleagroup.com"],
  ["Tom forwards with no original sender in the body", { from: "Tom <tom@cimltd.co.uk>", replyTo: "", text: "Worth a look, see attached." }, null],
  ["one of our own titles, never thanked", { from: "News Desk <press@smartsme.co.uk>", replyTo: "", text: "x" }, null],
  ["Care Home Magazine forwards one on", { from: "News <news@carehomemagazine.co.uk>", replyTo: "", text: GMAIL_FWD }, "emily@luckynorth.co.uk"],
  ["no-reply wire with the contact printed", { from: "no-reply@newswire.com", replyTo: "", text: "Media contact: press.office@ahdb.org.uk" }, "press.office@ahdb.org.uk"],
  ["Reply-To wins over a forwarding colleague", { from: "Lucas Payne <lucas@cimltd.co.uk>", replyTo: "beth@theazaleagroup.com", text: GMAIL_FWD }, "beth@theazaleagroup.com"],
];

let bad = 0;
for (const [label, msg, want] of cases) {
  const got = replyAddress(msg, { company: "Example Ltd" })?.email ?? null;
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label.padEnd(44)} -> ${got ?? "(nobody)"}${ok ? "" : `   expected ${want ?? "(nobody)"}`}`);
}
console.log(`\n${cases.length - bad}/${cases.length} passed`);
process.exit(bad ? 1 : 0);
