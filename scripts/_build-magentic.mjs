/**
 * Smart SME news rewrite: Magentic's $18m Series A (release from James Parsons,
 * Influence Tech PR, 17 Sep 2026, thread 1a0af494da973854). DRAFT over SSH.
 *
 * Angle for this readership: most Smart SME readers are the suppliers these
 * agents will be negotiating with, not the buyers. The "What this means for
 * your business" box carries that; the rest is a straight rewrite of the
 * release with the founder and investor quotes verbatim.
 *
 * Hero: the release carries no photo, only a 1159x200 logo strip inside the
 * .docx, and magentic.com serves logos only. The logo goes on a clean 16:9
 * card until James sends the founders photo, which the reply asks for.
 * Pass --hero=<url> to use a real image instead.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-magentic.mjs [--dry] [--hero=URL]
 */
import os from "node:os";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const DRY = process.argv.includes("--dry");
const HERO_URL = (process.argv.find((a) => a.startsWith("--hero=")) || "").split("=").slice(1).join("=");
const MSG_ID = "1a0af494da973854";
const CATEGORY_NAME = "AI & Automation";
const TAG = "guest-perspective";
const SOURCE = "https://www.magentic.com/";

const TITLE = "Magentic raises $18m for AI agents that run procurement";
const META = "London AI firm Magentic raises $18m to put AI agents to work in manufacturers' procurement. What it means for the SMEs that supply them.";
const EXCERPT = "Magentic has raised $18m to grow its AI digital workers inside the world's largest manufacturers. One customer already runs a million orders a year through them, which matters to every SME on the other side of those orders.";
const KEYPHRASE = "AI agents in procurement";
if (/[—–]/.test(TITLE + META + EXCERPT)) throw new Error("em or en dash");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);
if (TITLE.length > 60) console.warn(`title ${TITLE.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
const BODY = [
  P(`Magentic, a London and New York company that builds AI "digital workers" for procurement and supply chain teams at large manufacturers, has raised $18m in a Series A round led by Felicis, with existing investors Sequoia Capital and The Westly Group taking part. The round comes a year after the company launched.`),
  P(`The company's agents work inside a manufacturer's own systems, on Microsoft Teams and on email, and are designed to take procurement tasks end to end: deciding whether to buy or build, choosing a supplier, negotiating contracts, running orders and clearing invoices. Magentic says one customer now puts more than a million orders a year through its agents, and another has found $4m in savings. Its customers include three of the world's ten largest beverage companies.`),
  P(`&#8220;The physical world is dealing with the biggest capex cycle in history, driven by AI demand, during a time of trade disruption and geopolitical challenges,&#8221; said Robin Van Aeken, Magentic's chief executive and co-founder, a former McKinsey consultant. &#8220;The companies that build the best intelligence into every decision they make will be the ones that compound their competitive advantage.&#8221;`),
  H(`Why procurement`),
  P(`Magentic's pitch is that procurement at large manufacturers is where the money is and where the software is oldest. It describes billions of rows of data, tens of billions in spend, and decades-old systems still held together by spreadsheets and ageing ERPs. The company cites Goldman Sachs' projection of roughly $8 trillion of AI-related capital spending between 2026 and 2031, much of it on physical infrastructure that has to be sourced and built, and says procurement workloads are growing about 10% a year against budgets growing 1%.`),
  P(`Across its customer base Magentic says it typically delivers savings of 2% to 5%, a 60% improvement in data quality, and removes tens of thousands of hours of manual work. It covers both indirect spend and direct spend, including the raw materials that go into products.`),
  P(`&#8220;Supply chains are the least glamorous part of the economy, yet the most consequential, deciding what gets built and what does not. That's also what makes them so hard to automate,&#8221; said Feyza Haskaraman, partner at Felicis. &#8220;Getting an agent to understand a manufacturer's complex systems well enough to take action inside them is no small feat.&#8221;`),
  P(`The company says the money will go on extending its agents across more procurement and supply chain workflows and on longer-horizon research. &#8220;We're building AI that can diagnose problems, plan the fixes, take action, and see the work through across terabytes of multimodal data at once,&#8221; said Odhran O'Donoghue, chief technology officer and co-founder, formerly of OpenAI.`),
  H(`What this means for your business`),
  `<div class="takeaways"><p><em>Editor's notes. Magentic sells to Global 500 manufacturers, not to small firms. The reason it matters here is that its customers' suppliers are very often SMEs.</em></p><ul>
    <li><strong>You may already be negotiating with an agent.</strong> If a large customer's buying team runs on Magentic or something like it, the email asking you to requote, confirm a lead time or chase an invoice may be generated and assessed by software. Answer it as precisely as you would a person, and faster.</li>
    <li><strong>Clean data wins the order.</strong> An agent choosing between suppliers works from what is in the system: your lead times, prices, certifications, delivery record. If your details on a customer's portal are out of date, you are being compared on stale information.</li>
    <li><strong>Price and terms get compared more often.</strong> A buying team that once reviewed suppliers annually can now do it continuously. Expect more requests to requote, and be ready with a reason to be chosen other than price.</li>
    <li><strong>Invoices get cleared by rules.</strong> An invoice that matches the PO exactly is paid; one that doesn't sits in a queue. Match the customer's reference, quantity and price line for line.</li>
  </ul></div>`,
  P(`<em>Source: <a href="${SOURCE}">Magentic</a>.</em>`),
].join("\n\n");

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

// ---- hero ----
let hero, heroAlt;
if (HERO_URL) {
  const raw = Buffer.from(await fetch(HERO_URL, { headers: { "user-agent": "Mozilla/5.0 (CogentBot)" } }).then((r) => r.arrayBuffer()));
  const m = await sharp(raw).metadata();
  const th = Math.round((m.width * 9) / 16);
  const extra = Math.max(0, th - m.height);
  hero = await sharp(raw).resize(m.width, Math.max(m.height, th), { fit: "cover" }).blur(28).composite([{ input: raw, top: Math.floor(extra / 2), left: 0 }]).jpeg({ quality: 88 }).toBuffer();
  heroAlt = "Robin Van Aeken and Odhran O'Donoghue, co-founders of Magentic. Image: Magentic";
  console.log(`hero from url ${m.width}x${m.height} -> ${m.width}x${m.height + extra}`);
} else {
  const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
  const H_ = { Authorization: `Bearer ${rt}` };
  const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}?format=full`, { headers: H_ }).then((r) => r.json());
  let att; (function walk(p) { if (/\.docx$/i.test(p.filename || "") && p.body?.attachmentId) att = p; for (const c of p.parts || []) walk(c); })(msg.payload);
  const b = Buffer.from((await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}/attachments/${att.body.attachmentId}`, { headers: H_ }).then((r) => r.json())).data, "base64url");
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); const cd = b.readUInt32LE(eocd + 16), n = b.readUInt16LE(eocd + 10);
  let p = cd, logo;
  for (let i = 0; i < n; i++) { const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), name = b.toString("utf8", p + 46, p + 46 + nl), m = b.readUInt16LE(p + 10), cs = b.readUInt32LE(p + 20), lh = b.readUInt32LE(p + 42); if (name === "word/media/image1.png") { const lnl = b.readUInt16LE(lh + 26), lel = b.readUInt16LE(lh + 28), st = lh + 30 + lnl + lel; const dat = b.subarray(st, st + cs); logo = m === 8 ? zlib.inflateRawSync(dat) : Buffer.from(dat); } p += 46 + nl + el + cl; }
  if (!logo) throw new Error("logo not found in docx");
  const lm = await sharp(logo).metadata();
  const W = 1200, Hh = 675, lw = 720, lhh = Math.round((lm.height * lw) / lm.width);
  const logoResized = await sharp(logo).resize(lw, lhh).png().toBuffer();
  hero = await sharp({ create: { width: W, height: Hh, channels: 3, background: "#ffffff" } }).composite([{ input: logoResized, top: Math.round((Hh - lhh) / 2), left: Math.round((W - lw) / 2) }]).jpeg({ quality: 90 }).toBuffer();
  heroAlt = "Magentic logo";
  console.log(`hero from docx logo ${lm.width}x${lm.height} -> ${W}x${Hh} card`);
}
if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`)).filter((r) => /magentic/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const categoryId = wp(`term list category --name=${sq(CATEGORY_NAME)} --field=term_id`).split(/\s+/)[0];
if (!/^\d+$/.test(categoryId)) throw new Error(`category "${CATEGORY_NAME}" not found: ${categoryId}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`magentic-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/magentic-hero-${stamp}.jpg --title=${sq("Magentic")} --alt=${sq(heroAlt)} --porcelain`);
put(`magentic-body-${stamp}.html`, Buffer.from(BODY, "utf8"));
const postId = wp(`post create /tmp/magentic-body-${stamp}.html --post_type=post --post_status=draft --post_category=${categoryId} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/magentic-hero-${stamp}.jpg /tmp/magentic-body-${stamp}.html`);
console.log(`DRAFT ${postId}: "${TITLE}"  hero ${heroId}  tags: ${wp(`post term list ${postId} post_tag --field=slug`)}  cat: ${wp(`post term list ${postId} category --field=name`)}`);
