// Read-only check of the press desk's pitch lane against real mail.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_pitch-lane-check.mjs
//
// Sorts the pitches JB forwarded on 27 Oct 2026 plus a handful of recent
// published and skipped press@ mail, prints what the lane would do with each,
// and prints the "please send it" email it would write. Labels nothing, sends
// nothing, writes no rows. Costs a few pence of Haiku.
import Anthropic from "@anthropic-ai/sdk";
import { getGoogleAccessToken } from "../lib/google.js";
import { getSiteContext } from "../lib/site.js";
import { sortRelease, readMessage, readContribution, withoutQuotedReply, askLines } from "../lib/press-intake.js";
import { parseAddress } from "../lib/mail-triage.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const client = new Anthropic();

async function find(mailbox, q, max = 1) {
  const token = await getGoogleAccessToken(SCOPES, mailbox);
  const get = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me${p}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
  const list = await get(`/messages?q=${encodeURIComponent(q)}&maxResults=${max}`);
  return Promise.all((list.messages || []).map(async (m) => readMessage(await get(`/messages/${m.id}?format=full`))));
}

const SAMPLES = [
  { slug: "airport-business-magazine", q: "from:grace@fightorflight.com", label: "Grace, IBS Software (press@ Airport)" },
  { slug: "fleet-magazine", q: 'from:alex@caprafinance.co.uk subject:"Data idea" -subject:re', label: "Alex, Capra Finance (press@ Fleet)" },
  { slug: "smart-sme", q: 'from:dan@ostina.ai -subject:re', label: "Dan, Ostina (jb@ SME)" },
  { slug: "fleet-magazine", q: "label:press-published newer_than:10d", max: 2, label: "published release (Fleet)" },
  { slug: "smart-sme", q: "label:press-published newer_than:10d -deliveredto:press@thefleetmagazine.co.uk", max: 2, label: "published release (SME)" },
  { slug: "smart-sme", q: "label:press-skipped newer_than:5d", max: 4, label: "skipped (SME hub)" },
];

for (const s of SAMPLES) {
  const { site, creds } = await getSiteContext(s.slug);
  const mailbox = creds.outreach.fromEmail.toLowerCase();
  const press = `press@${mailbox.split("@")[1]}`;
  for (const msg of await find(mailbox, s.q, s.max || 1)) {
    const sorted = await sortRelease(client, site, msg);
    const toPress = [msg.to, msg.cc, ...msg.deliveredTo].join(" ").toLowerCase().includes(press);
    const lane = sorted.pitch && !sorted.isPressRelease && toPress
      ? sorted.advertising || (sorted.relevance || 0) < 6 ? "PITCH, DECLINED" : "PITCH, ASK FOR IT"
      : sorted.pitch ? "pitch but not press@, so release lanes" : sorted.isPressRelease ? "release" : sorted.guide ? "guide" : "skip";
    console.log(`\n=== ${s.label}: ${msg.subject.slice(0, 80)}`);
    console.log(`    to press@: ${toPress}  pitch: ${sorted.pitch}  ad: ${sorted.advertising}  release: ${sorted.isPressRelease}  rel: ${sorted.relevance}  => ${lane}`);
    console.log(`    topic: ${sorted.pitchTopic}  reason: ${sorted.reason}`);
    if (lane === "PITCH, ASK FOR IT") {
      const to = parseAddress(msg.from);
      console.log(askLines({ site, to, sorted }).map((l) => `      | ${l}`).join("\n"));
    }
  }
}

// What came back in Alex's thread, as the content lane would read it.
const fleet = await getSiteContext("fleet-magazine");
const [back] = await find(fleet.creds.outreach.fromEmail, 'from:alex@caprafinance.co.uk subject:"Data idea" subject:re');
if (back) {
  const text = withoutQuotedReply(back.text);
  const read = await readContribution(client, fleet.site, { ...back, text });
  console.log(`\n=== Alex's latest reply (${back.date.toISOString()}): ${text.split(/\s+/).length} words after the quote is cut`);
  console.log(`    kind: ${read.kind}  ad: ${read.advertising}  author: ${read.author}, ${read.authorRole}, ${read.company}  reason: ${read.reason}`);
  console.log(text.slice(0, 500).split("\n").map((l) => `      | ${l}`).join("\n"));
}
