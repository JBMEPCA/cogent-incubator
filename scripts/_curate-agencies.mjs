/**
 * The agencies tab: PR firms and media platforms that could feed ALL ten titles.
 *
 * Deliberately not the 64 firms already emailing our press@ addresses. The
 * value here is the ones we are missing, and above all the media request
 * platforms, where one registration puts every title in front of every PR firm
 * using that platform rather than one firm at a time.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_curate-agencies.mjs
 */
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const client = new Anthropic();

const SECTORS = `Our ten UK trade titles: small business, commercial fleet and logistics, golf resorts, barbering, airport business, gym and fitness, early years and nurseries, senior living, dentistry, and farming technology.`;

const ASKS = [
  [
    "Media request platforms and newsrooms for journalists",
    "Services a journalist or publication registers with to receive press releases by sector, or to answer journalist requests. UK-relevant ones first.",
    18,
  ],
  [
    "PR agencies",
    "UK PR and communications agencies with a named practice in one or more of our sectors, the kind that issue client releases to trade media. Give the agency, not its clients.",
    40,
  ],
  [
    "Wire and distribution services",
    "Press release distribution wires whose feeds a trade title can subscribe to.",
    12,
  ],
];

const rows = [];
const names = [];
for (const [bucket, note, n] of ASKS) {
  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 6000,
    system: `You build a signup list for a publisher of UK trade magazines.

${SECTORS}

THE JOB
Name organisations in this bucket: ${bucket} (${note}).

Rules:
- Real, operating organisations only. If you are not confident of the exact root domain, leave it out rather than guess.
- No magazines, newspapers or other publishers. We are the publisher.
- No individual client brands. This list is about the firms and platforms that distribute news.
- UK or UK-serving first.

Reply with ONLY a JSON array, no code fence:
[{"name":"...","domain":"example.com","why":"six words on what we would get"}]`,
    messages: [{ role: "user", content: `List up to ${n}.${names.length ? `\n\nAlready listed, do not repeat: ${names.join(", ")}` : ""}` }],
  });
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  let got = [];
  try { got = JSON.parse(text.replace(/^```(?:json)?|```$/gm, "").trim()); } catch { got = []; }
  for (const r of got) {
    if (!r?.name || !r?.domain) continue;
    const domain = String(r.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) continue;
    if (rows.some((x) => x.domain === domain)) continue;
    names.push(r.name);
    rows.push({ name: String(r.name).slice(0, 80), domain, why: String(r.why || "").slice(0, 60), bucket });
  }
  console.log(`${bucket.padEnd(44)} ${got.length} proposed, ${rows.length} kept`);
}
fs.writeFileSync(`${SP}/curated-agencies.json`, JSON.stringify(rows, null, 1));
console.log(`agencies: ${rows.length} candidates written`);
