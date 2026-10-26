/**
 * A curated press-list for one title: named organisations whose releases that
 * title would actually run, with their real domain verified before it ships.
 *
 * The PrBrand table was not good enough for this. Most of it is brands picked
 * up because an article mentioned them once, plus rival magazines and our own
 * saved wire searches, so Golf's list arrived carrying British Airways,
 * Booking.com, Adobe and two hotel titles. JB, 9 October: every row has to be
 * worth a signup, because a weak one clogs press@ for ever.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_curate.mjs <slug> [...]
 */
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const prisma = new PrismaClient();
const client = new Anthropic();

const BUCKETS = [
  ["Lenders, banks and finance providers", "who lends to, banks and funds small firms"],
  ["Software and tools small firms run on", "accounting, payroll, payments, CRM, ecommerce, AI assistants"],
  ["Insurers, energy and utilities for business", "the fixed costs every small firm buys"],
  ["Trade bodies, regulators and government", "who sets the rules and publishes the data SMEs act on"],
  ["Advisers, accountants and legal", "the firms SMEs pay for advice, and who publish research"],
  ["Employment, skills and HR", "hiring, training, apprenticeships and workplace rules"],
];

async function curate(site, bucket, note, already) {
  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: `You build press-list targets for a trade publication. You know the sector's real companies by name.

THE PUBLICATION
${site.name}. Readers: ${site.audience || "trade buyers"}.

${(site.editorialStandardMd || "").slice(0, 2500)}

THE JOB
Name organisations in this bucket: ${bucket} (${note}).

Every one must pass all of these:
- It is a real, named organisation operating today, not a guess or a placeholder.
- Its press releases would be run by THIS publication, for THIS reader. A story about it belongs in the sections this title publishes.
- It issues news: launches, openings, appointments, results, contracts, deals, data.
- It is NOT a magazine, newspaper, journal, newsletter or any other publisher. Never list media.
- It is NOT a general consumer or business brand that happens to touch the sector.

Give the organisation's own root domain, lower case, no protocol, no path, no www. If you are not confident of the exact domain, leave it out rather than guess.

Reply with ONLY a JSON array, no code fence:
[{"name":"...","domain":"example.com","why":"six words on why this title wants them"}]`,
    messages: [
      {
        role: "user",
        content: `List up to 30 for ${site.name}.${already.length ? `\n\nAlready on the list, do not repeat: ${already.slice(0, 220).join(", ")}` : ""}`,
      },
    ],
  });
  let text = "";
  for (const b of res.content) if (b.type === "text") text += b.text;
  try {
    return JSON.parse(text.replace(/^```(?:json)?|```$/gm, "").trim());
  } catch {
    return [];
  }
}

for (const slug of process.argv.slice(2)) {
  const site = await prisma.site.findUnique({
    where: { slug },
    select: { name: true, audience: true, editorialStandardMd: true },
  });
  if (!site) { console.log(`${slug}: no such title`); continue; }

  // A second pass tops a thin title up instead of starting again, so the names
  // the first pass found are handed over as "do not repeat".
  const existing = fs.existsSync(`${SP}/curated-${slug}.json`)
    ? JSON.parse(fs.readFileSync(`${SP}/curated-${slug}.json`, "utf8"))
    : [];
  const rows = [...existing];
  const names = existing.map((r) => r.name);
  for (const [bucket, note] of BUCKETS) {
    const got = await curate(site, bucket, note, names);
    for (const r of got) {
      if (!r?.name || !r?.domain) continue;
      const domain = String(r.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) continue;
      if (names.some((n) => n.toLowerCase() === String(r.name).toLowerCase())) continue;
      if (rows.some((x) => x.domain === domain)) continue;
      names.push(r.name);
      rows.push({ name: String(r.name).slice(0, 80), domain, why: String(r.why || "").slice(0, 60), bucket });
    }
    console.log(`${slug} ${bucket.padEnd(36)} ${got.length} proposed, ${rows.length} kept so far`);
  }
  fs.writeFileSync(`${SP}/curated-${slug}.json`, JSON.stringify(rows, null, 1));
  console.log(`${slug}: ${rows.length} candidates written`);
}
await prisma.$disconnect();
