import { replyLines } from "../lib/press-intake.js";
// Real senders from the press inboxes. Website blank on purpose: that is the
// case the fallback exists for.
const cases = [
  ["Enki Towels",      "michaella@ajc93.com",              true,  "agency, the live failure"],
  ["Rockliffe Hall",   "roddy@theazaleagroup.com",         true,  "agency"],
  ["Kinloch Manor",    "molly.miles@theazaleagroup.com",   true,  "agency"],
  ["Justin Cassin",    "eva@slbpr.co.uk",                  true,  "agency"],
  ["Brake",            "press@brake.org.uk",               false, "brand, exact"],
  ["Bright Horizons",  "pr@brighthorizons.com",            false, "brand, two words joined"],
  ["Trafford Leisure", "info@traffordleisure.co.uk",       false, "brand, two words joined"],
  ["Stellantis",       "media@stellantis.com",             false, "brand"],
  ["Motor Fuel Group", "media@motorfuelgroup.com",         false, "brand"],
  ["Edinburgh Airport","communications@edinburghairport.com", false, "brand"],
  ["Pod Point",        "press@pod-point.com",              false, "brand, hyphenated domain"],
  ["Gatwick Airport",  "press@gatwickairport.com",         false, "brand"],
];
let bad = 0;
for (const [company, email, wantAgency, note] of cases) {
  const lines = replyLines({ site: { name: "Test Title" }, to: { name: "", email }, url: "https://x/y/", sorted: { company } });
  const got = lines.some((l) => l.startsWith(`If ${company} keep`));
  const ok = got === wantAgency;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${company.padEnd(18)} ${email.padEnd(36)} agency=${String(got).padEnd(5)} (${note})`);
}
console.log(bad ? `\n${bad} FAILED` : "\nall correct");
