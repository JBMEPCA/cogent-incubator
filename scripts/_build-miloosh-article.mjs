/**
 * One-off: build the Miloosh SaaS pricing data piece as a DRAFT on Smart SME.
 *
 * Source: Eyal's email of 7 Sep 2026 and the dataset page it links,
 * https://miloosh.com/research/saas-pricing-pressure-index-2026 (188 products,
 * pricing verified against vendor pages as of 7 Sep 2026). No image was
 * supplied, so the hero is a bar chart of the category medians, drawn here.
 *
 * Written over SSH + wp-cli, not REST: SiteGround's WAF 403s any wp-json call
 * carrying an Authorization header (see create-utility-pages.mjs). Binary and
 * HTML travel base64 over ssh stdin, so nothing has to survive shell quoting
 * and nothing hits the Windows 32K command-line limit.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-miloosh-article.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const OUT = process.env.OUT_DIR || ".";

// ---------- the chart hero ----------------------------------------------------
// Median starting monthly price by category, USD, from the Miloosh table.
// Only categories with 3+ verified data points, which is Miloosh's own rule.
const MEDIANS = [
  ["IT operations", 104, 5], ["Sales", 49, 7], ["Legal", 49, 3], ["Property management", 33, 4],
  ["Analytics", 30, 9], ["Customer support", 25, 9], ["AI", 23, 5], ["Field service", 21, 3],
  ["Developer tools", 20, 5], ["Automation", 19.99, 4], ["HR and payroll", 19.5, 6], ["Accounting", 19, 5],
  ["Communication", 17.5, 6], ["Marketing", 15.79, 16], ["Finance and ERP", 15, 8], ["CRM", 14, 5],
  ["Productivity", 9, 10], ["Project management", 8.75, 6], ["Security", 5.5, 6],
];
const W = 1600, H = 900, PAD_L = 330, PAD_R = 120, TOP = 150, BOTTOM = 80;
const rowH = (H - TOP - BOTTOM) / MEDIANS.length;
const maxV = 110;
const scale = (v) => ((W - PAD_L - PAD_R) * v) / maxV;
const font = `font-family="Space Grotesk, Arial, Helvetica, sans-serif"`;
const bars = MEDIANS.map(([name, v, n], i) => {
  const y = TOP + i * rowH;
  const w = scale(v);
  const label = `$${v.toFixed(2).replace(/\.00$/, "")}`;
  return `
  <text x="${PAD_L - 18}" y="${y + rowH / 2 + 7}" text-anchor="end" ${font} font-size="22" fill="#0A0C16">${name}</text>
  <rect x="${PAD_L}" y="${y + 6}" width="${w}" height="${rowH - 12}" rx="4" fill="${i === 0 ? "#0A0C16" : "#2E3EEE"}"/>
  <text x="${PAD_L + w + 12}" y="${y + rowH / 2 + 7}" ${font} font-size="21" fill="#5A5E75">${label}<tspan fill="#A9AECB"> /mo · n=${n}</tspan></text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F4F5FA"/>
  <text x="60" y="66" ${font} font-size="40" font-weight="700" fill="#0A0C16">What business software costs to start: median entry price by category</text>
  <text x="60" y="106" ${font} font-size="24" fill="#5A5E75">Cheapest paid tier, USD per month. 188 products, pricing verified on vendor sites as of 7 September 2026. Source: Miloosh</text>
  ${bars}
  <text x="60" y="${H - 28}" ${font} font-size="18" fill="#A9AECB">n = products in the category. Categories with fewer than three verified prices are excluded. Chart: Smart SME</text>
</svg>`;
const hero = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
console.log(`hero chart: ${hero.length} bytes`);
if (DRY) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(`${OUT}/miloosh-hero.png`, hero);
}

// ---------- the article --------------------------------------------------------
const P = (s) => `<p>${s}</p>`;
const H2 = (s) => `<h2>${s}</h2>`;
const MILOOSH = "https://miloosh.com/research/saas-pricing-pressure-index-2026";
const GUIDE = "https://smartsme.co.uk/uk-small-business-software-the-tools-every-owner-should-consider-in-2026/";
const CRM = "https://smartsme.co.uk/best-crm-for-small-business-uk-2026-compared-costed-and-ranked/";
const ITMGMT = "https://smartsme.co.uk/6-best-all-in-one-it-management-platforms-for-remote-teams/";

const body = [
  `<p class="standfirst"><em>A new dataset checks the published price of 188 business software products against the vendors' own pages. The headline numbers are cheaper than most owners expect. The catches are in how the price is structured, and they hit small teams hardest.</em></p>`,

  P(`When we published our <a href="${GUIDE}">guide to the software stack a UK small business should consider in 2026</a>, the hardest section to write was the one on cost. Vendor pricing pages change without notice, most quote in dollars, and the number on the page is rarely the number on the invoice.`),
  P(`Miloosh, an independent software research site, has now put some structure on that. Its <a href="${MILOOSH}">SaaS Pricing Pressure Index 2026</a> records the entry price of 188 business software products, each checked directly against the vendor's own pricing page and dated. The current figures are as of 7 September 2026. Products whose pricing could not be verified are left out entirely rather than estimated, which is the right call and rarer than it should be.`),

  H2(`The headline numbers`),
  `<ul>
    <li><strong>The median starting price is about $19.50 a month.</strong> That is the cheapest paid tier across the priced sample, so roughly £15 at current rates before VAT.</li>
    <li><strong>37.8% have a free tier</strong> (71 of 188), and 52.1% offer a free trial.</li>
    <li><strong>78.2% make you contact sales for enterprise pricing</strong> (147 of 188). The top tier is unpriced on four products in five.</li>
    <li><strong>28.7% price explicitly per seat</strong> (54 of 188). Among those, the median modelled cost for a ten-person team is $190 a month.</li>
  </ul>`,
  P(`The spread by category is wide. Security tools have the lowest median entry price at $5.50 a month, then project management at $8.75 and productivity at $9. CRM sits at $14, accounting at $19, HR and payroll at $19.50, customer support at $25 and analytics at $30. Sales tools and legal software both start at a median of $49. IT operations is the outlier at $104, driven by products such as ManageEngine Endpoint Central and TeamViewer.`),
  P(`At the individual product level the figures line up with what UK owners will recognise. Xero starts at $25, QuickBooks Online at $38, FreshBooks at $19 and Zoho Books at $12.50. Pipedrive and Zoho CRM both open at $14 and Salesforce at $25, which matches the running order in <a href="${CRM}">our own CRM comparison</a>. Notion is $8, ClickUp $7 and Monday.com $9. Shopify is $29 and Semrush $117.33.`),

  H2(`Where the entry price stops being the real price`),
  P(`Three things in the dataset matter more than the median.`),
  P(`<strong>Per-seat pricing scales with headcount, not usage.</strong> Only 29% of products price per seat explicitly, but they include most of the tools every employee touches: CRM, helpdesk, HR, communication. Miloosh's own worked example is Atera, the IT management platform, at $149 per seat: a 50-seat team pays $7,450 a month. Nobody with five staff is buying that, but the mechanism is the same at $14 a seat. Five tools at $15 a head for a team of twelve is £700 a month before anyone has bought the tier they actually need.`),
  P(`<strong>"Contact sales" is a negotiation, not a price.</strong> With 78% of vendors hiding enterprise pricing, the published tiers are the ceiling of what a vendor will admit to in public and the floor of what its sales team can flex. Enterprise tiers exist to capture large accounts, but the discounting habits that go with them (annual prepay, seat bands, bundled products) are available to a 20-person firm that asks.`),
  P(`<strong>The starting tier is often not the usable tier.</strong> Miloosh records the cheapest paid plan. In practice the feature that made you choose the product (automation, reporting, integrations, more than one pipeline) is frequently one tier up, at two to three times the entry price. That is not a criticism of the dataset, which is explicit about measuring entry price. It is the reason to read the tier table before the headline figure.`),

  H2(`What the data does not cover`),
  P(`Prices are in US dollars and are list prices. UK buyers pay VAT on top, carry exchange-rate risk on anything billed in dollars, and will find some vendors quote a rounded sterling price that is not the dollar figure converted. Annual and monthly billing are not separated, and vendors' habit of showing the annual rate "per month" makes the monthly rate look cheaper than it is. The sample is 188 of the 354 products in Miloosh's catalogue, so it is weighted towards the products it has been able to verify, not a random sample of the market.`),
  P(`None of that undermines the value of a dated, source-linked price list. It just means the number to budget is the published one plus 20% VAT plus a margin for the tier you will actually use.`),

  H2(`What this means for your business`),
  `<div class="takeaways"><ul>
    <li><strong>Budget per head, not per tool.</strong> Before comparing two products, multiply each by the number of people who will need a login. A $14 tool and a $25 tool are £130 apart per month on a team of ten, not $11.</li>
    <li><strong>Treat the free tier as the trial.</strong> Nearly four in ten products have one. Run the real workflow on it for a month before paying for anything, and be honest about which paid feature you actually hit the wall on.</li>
    <li><strong>Ask for the enterprise discount without being enterprise.</strong> If 78% of vendors negotiate at the top, the annual prepay and seat-band discounts are on the table lower down. The worst answer is no.</li>
    <li><strong>Security is the cheapest category. There is no budget excuse.</strong> A median of $5.50 a month puts a password manager or endpoint tool within reach of a sole trader. If your <a href="${ITMGMT}">IT management</a> conversation stalls on cost, this is the line item that should not.</li>
    <li><strong>Diarise the price.</strong> The dataset is dated for a reason. Note the price and tier you signed up on, and check it against the vendor's page at renewal. Increases arrive by email you did not read.</li>
  </ul></div>`,

  P(`The full dataset, with each product linked to the vendor pricing page it was checked against, is on <a href="${MILOOSH}">Miloosh's research page</a>. We will fold the figures into the next update of our software stack guide.`),
].join("\n\n");

const TITLE = "What business software really costs in 2026: 188 vendor price lists checked";
const KEYPHRASE = "business software costs 2026";
const META =
  "A dated, source-checked dataset of 188 business software prices: the median entry price, the per-seat trap and what UK small firms should budget for.";
const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
console.log(`title: ${TITLE}\nmeta: ${META.length} chars\nwords: ~${words}\nem dashes: ${/[—–]/.test(body)}`);
if (META.length > 155) throw new Error("meta too long");
if (DRY) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(`${OUT}/miloosh-body.html`, body);
  console.log("DRY RUN: wrote miloosh-hero.png and miloosh-body.html");
  process.exit(0);
}

// ---------- write it, over SSH -------------------------------------------------
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = (await prisma.site.findMany()).find((s) => /smart/i.test(s.slug));
const { creds } = await siteCredentials(site.id);
await prisma.$disconnect();
const sftp = creds.sftp;
const keyPath = sftp.privateKeyPath.replace(/^~/, os.homedir());
const docroot = sftp.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync(
    "ssh",
    ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(sftp.port || 18765), `${sftp.username}@${sftp.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 16 * 1024 * 1024 }
  ).trim();
const sq = (s) => `'${String(s).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const stamp = Date.now();
// Binary and HTML go over stdin as base64: no quoting, no arg-length limit.
ssh(`base64 -d > /tmp/miloosh-hero-${stamp}.png`, hero.toString("base64"));

// HERO_ONLY=<post id>: re-render the chart, attach it, drop the old attachment.
if (process.env.HERO_ONLY) {
  const pid = process.env.HERO_ONLY;
  const old = wp(`post meta get ${pid} _thumbnail_id`);
  const fresh = wp(
    `media import /tmp/miloosh-hero-${stamp}.png --title=${sq("Median starting price of business software by category, 2026")} ` +
      `--alt=${sq("Bar chart of median monthly starting price for business software by category, from 188 products checked by Miloosh in September 2026")} ` +
      `--caption=${sq("Median entry price by category across 188 products. Source: Miloosh SaaS Pricing Pressure Index 2026. Chart: Smart SME")} --porcelain`
  );
  wp(`post meta update ${pid} _thumbnail_id ${fresh}`);
  if (/^\d+$/.test(old)) wp(`post delete ${old} --force`);
  ssh(`rm -f /tmp/miloosh-hero-${stamp}.png`);
  console.log(`post ${pid}: hero ${old} -> ${fresh}`);
  process.exit(0);
}
ssh(`base64 -d > /tmp/miloosh-body-${stamp}.html`, Buffer.from(body, "utf8").toString("base64"));

const mediaId = wp(
  `media import /tmp/miloosh-hero-${stamp}.png --title=${sq("Median starting price of business software by category, 2026")} ` +
    `--alt=${sq("Bar chart of median monthly starting price for business software by category, from 188 products checked by Miloosh in September 2026")} ` +
    `--caption=${sq("Median entry price by category across 188 products. Source: Miloosh SaaS Pricing Pressure Index 2026. Chart: Smart SME")} --porcelain`
);
console.log(`hero media id ${mediaId}`);

const postId = wp(
  `post create /tmp/miloosh-body-${stamp}.html --post_type=post --post_status=draft --post_category=6 ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(META)} --porcelain`
);
console.log(`draft post id ${postId}`);
wp(`post meta update ${postId} _thumbnail_id ${mediaId}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
ssh(`rm -f /tmp/miloosh-hero-${stamp}.png /tmp/miloosh-body-${stamp}.html`);

console.log(wp(`post get ${postId} --fields=ID,post_status,post_name,post_title --format=json`));
console.log(`edit: https://smartsme.co.uk/wp-admin/post.php?post=${postId}&action=edit`);
