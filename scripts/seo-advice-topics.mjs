// Turn the SEO Analyst's standing cluster-page advice into commissions, and
// close the rest of the advice queue with a reason.
//
//   node --import ./scripts/_register.mjs scripts/seo-advice-topics.mjs --dry
//   node --import ./scripts/_register.mjs scripts/seo-advice-topics.mjs
//
// On 29 September the four newest titles each carried "build long-tail cluster
// pages around X" advice, re-filed every sweep, that nothing could act on: the
// keyword registry only remembers terms, and the Researcher does not commission
// from it. A source "jb" ResearchTopic is what the Director commissions ahead
// of everything else, so each piece of advice becomes one or two specific,
// sourceable spokes off a hub the title already has. Each term is claimed in
// the registry after the same cross-title collision check apply-alignment uses.
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry");
const STAMP = "SEO Analyst advice, commissioned 29 Sep 2026";

// [title, section, brief, search term]
const TOPICS = {
  "nursery-daily": [
    [
      "London Early Years Funding Rates 2026-27: What Each Borough Pays",
      "Funding & Fees",
      "A borough-by-borough table of the 2026-27 hourly rates London councils pass to providers for the 3-4 year old, 2 year old and under-2 entitlements, from the DfE early years funding tables and each council's published rates. Say where the spread is widest and what it means for a multi-site group. Link to the national guide Early Years Funding Rates 2026-27: What Every Council Pays.",
      "london early years funding rates 2026-27",
    ],
    [
      "SEN Inclusion Fund for Nurseries: What Councils Pay and How to Claim",
      "Funding & Fees",
      "How the SEN Inclusion Fund (SENIF) and Disability Access Fund work for private and voluntary nurseries in 2026-27: who qualifies, typical rates councils publish, how claims are made and how long they take. Sourced from DfE guidance and named councils' published SENIF rates. Gives the site's inclusion and SEND practice coverage a funding page to link to.",
      "sen inclusion fund nursery",
    ],
  ],
  "dental-business-news": [
    [
      "UDA Value 2026: What NHS England Practices Are Paid Per Unit",
      "NHS Contract",
      "The 2026-27 unit of dental activity (UDA) value in England: the national minimum, the range between ICBs, and what a typical contract's UDA rate means for practice income and valuation. Sourced from NHS England and ICB publications and the BDA. Link to How Much Is an NHS Dental Contract Actually Worth.",
      "uda value 2026",
    ],
    [
      "Scotland NHS Dental Fees 2026: What the SDR Pays a Practice",
      "NHS Contract",
      "How NHS dental payment works in Scotland under the Statement of Dental Remuneration after the 2023 reform: item of service fees for the common treatments, capitation and continuing care payments, and allowances, with the current figures from the published SDR. What it means for a practice owner's income.",
      "scotland nhs dental fees",
    ],
    [
      "Wales NHS Dental Contract Value 2026-27: How Practices Are Paid",
      "NHS Contract",
      "How the Welsh General Dental Services contract pays practices in 2026-27, the move away from UDAs, the metrics that decide payment, and the published contract values, sourced from Welsh Government and health board documents. What it means for owners and buyers of Welsh practices.",
      "wales nhs dental contract value",
    ],
  ],
  "smart-farming-news": [
    [
      "Battery Storage Lease Rent Per Acre: UK Rates Landowners Are Offered",
      "Energy & Land Use",
      "What battery energy storage developers offer UK landowners in annual rent per acre or per MW, typical lease length, option fees and the terms that matter, sourced from land agents' published guidance and named deals. Same number-led format as Solar Farm Lease Rent Per Acre, and link to it.",
      "battery storage lease rent per acre",
    ],
    [
      "Capital Grants 2026: The Payment Rates Farmers Can Claim",
      "Finance & Grants",
      "The 2026 Capital Grants offer in England: the item payment rates for the most used items (hedgerows, water, slurry, trees), the per-business cap, the application window and how quickly funding went last time. Sourced from RPA and gov.uk. Link to the SFI 2026 Window 2 story.",
      "capital grants 2026 payment rates",
    ],
  ],
  "senior-lifestyle-business": [
    [
      "DST, LIHTC and ALP: The US Senior Housing Deal Terms Explained",
      "Capital & Investment",
      "A short explainer of the US deal structures that recur in the site's senior housing coverage: Delaware Statutory Trusts, Low-Income Housing Tax Credits, New York's Assisted Living Program, and REIT RIDEA structures. What each is, why investors use it, and one named example of each from recent deals. Every US deal story can link here instead of re-explaining.",
      "senior housing dst explained",
    ],
  ],
};

// Pending advice closed by this pass, matched on title.
const CLOSE = [
  [/rangeford/i, "not commissioned: a cluster built around one operator's villages reads as that operator's marketing, and three posts is too thin; linking the existing posts to each other is the sweep's own job"],
  [/cluster|glossary hub|money keyword pages/i, "commissioned: turned into specific long-tail topics by scripts/seo-advice-topics.mjs (29 Sep 2026)"],
  [/prioriti[sz]e long-tail/i, "standing strategy, already how the Researcher works: its near-miss lane targets terms the title already ranks 8 to 30 for"],
  [/no honest internal-link match/i, "acknowledged; the SEN Inclusion Fund topic commissioned 29 Sep 2026 gives this post a natural link target"],
  [/meta descriptions/i, "checked 29 Sep 2026: 150 of 150 recent Smart SME posts carry a Yoast description, 2 run over 160 characters. The larger problem was the SEO title, now set on every post"],
  [/anchor text variety/i, "folded into the audit prompt: vary anchor text and spread links across more destinations"],
];

// Deliberately the raw client, as in apply-alignment.mjs: the collision check
// reads across every title, which the scoped client in lib/prisma.js refuses.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function normaliseTerm(t) {
  return String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
}

for (const [slug, topics] of Object.entries(TOPICS)) {
  const site = await prisma.site.findUnique({ where: { slug }, select: { id: true, name: true, markets: true, sections: true } });
  const market = site.markets?.[0] || "GB";
  const sections = new Set((site.sections || []).map((s) => s.name));
  console.log(`\n== ${site.name}`);
  for (const [title, category, brief, rawTerm] of topics) {
    if (!sections.has(category)) { console.log(`  SKIP (no section ${category}): ${title}`); continue; }
    const term = normaliseTerm(rawTerm);
    const held = await prisma.keywordTarget.findMany({
      where: { term, market, siteId: { not: site.id } },
      select: { site: { select: { name: true } } },
    });
    if (held.length) { console.log(`  SKIP, term held by ${held.map((h) => h.site.name).join(", ")}: ${title}`); continue; }
    const existing = await prisma.researchTopic.findFirst({ where: { siteId: site.id, title } });
    if (existing) { console.log(`  kept: ${title}`); continue; }
    if (!DRY) {
      await prisma.researchTopic.create({
        data: { siteId: site.id, title, category, source: "jb", query: brief, rationale: `${STAMP}. Search term: ${term}`, score: 100, status: "proposed" },
      });
      await prisma.keywordTarget.upsert({
        where: { siteId_term: { siteId: site.id, term } },
        create: { siteId: site.id, term, market, source: "gap", status: "claimed", claimedAt: new Date() },
        update: {},
      });
    }
    console.log(`  ${DRY ? "would commission" : "commissioned"}: ${title}  [${term}]`);
  }
}

console.log("\n== closing advice");
const advice = await prisma.seoSuggestion.findMany({
  where: { status: "pending", kind: "advice" },
  include: { site: { select: { slug: true } } },
});
for (const a of advice) {
  const rule = CLOSE.find(([re]) => re.test(a.title));
  if (!rule) { console.log(`  left: [${a.site.slug}] ${a.title}`); continue; }
  if (!DRY) await prisma.seoSuggestion.update({ where: { id: a.id }, data: { status: "applied", appliedAt: new Date(), error: rule[1] } });
  console.log(`  closed: [${a.site.slug}] ${a.title}`);
}
await prisma.$disconnect();
