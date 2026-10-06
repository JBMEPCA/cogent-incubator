/**
 * Dean Butt, Apple & Bears: "What would I do differently selling into Europe
 * today? Not much." Exclusive follow-up he wrote for Smart SME (his email of
 * 17 Sep 2026 13:12 UTC, thread 1a0af80af12928fd). Built as a DRAFT over SSH.
 *
 * Text is his, from the .docx, sub-edited to house style only (sentence-case
 * subheads). No editor's box this time: the piece answers "what does this mean
 * for a small business" itself, that was the brief. Hero is the image he sent
 * (1200x600, padded to 16:9); headshot is attachment 1022 from 3 Sep.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-dean-europe.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const DRY = process.argv.includes("--dry");
const MSG_ID = "1a0af80af12928fd";
const HERO_FILE = "What Would I Do Differently Selling into Europe Today.jpg";
const HEADSHOT_ID = 1022;
const CATEGORY_ID = 6; // Operations
const TAG = "guest-perspective";
const BREXIT_URL = "https://smartsme.co.uk/brexit-what-it-cost-one-small-british-manufacturer/";

const TITLE = "What I would do differently selling into Europe: not much";
const META =
  "Apple & Bears had a German distributor, EU stock and retailers before Brexit. Dean Butt on what he would change today, and why the answer is not much.";
const EXCERPT = META;
const KEYPHRASE = "selling into Europe after Brexit";
if (/[—–]/.test(TITLE + META)) throw new Error("em or en dash in title/meta");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
function buildBody({ headshotUrl }) {
  return [
    `<p class="standfirst"><em>Before Brexit, Apple &amp; Bears had done everything the export advice says to do: a German distributor, stock inside the EU, listings with Douglas and Ludwig Beck. In this exclusive follow-up to <a href="${BREXIT_URL}">his account of what Brexit cost the business</a>, Dean Butt works through what he would change if he were starting again today, and why most of it would look the same.</em></p>`,
    P(`<strong>By Dean Butt, Co-founder, Apple &amp; Bears</strong>`),
    P(`When businesses talk about expanding into Europe, the advice often sounds straightforward: find local expertise, understand the market, put stock close to your customers and build relationships with retailers.`),
    P(`Before Brexit, that was essentially what we had done at Apple &amp; Bears.`),
    P(`Germany was our clearest example. We appointed a sole German distributor who spoke the language fluently, understood the local market and could communicate with customers and retailers in a way that would always be more difficult to do from Britain.`),
    P(`We held stock in Europe so that products could be supplied efficiently. We had also established relationships with recognised German retailers, including Douglas, a major beauty retailer, and Ludwig Beck in Munich.`),
    P(`We also developed distribution relationships elsewhere, including France.`),
    P(`This was not a case of occasionally sending a parcel from Britain and hoping somebody bought it. We had spent years building a genuine route to market.`),
    P(`Then Brexit changed the commercial calculation.`),
    H(`When the economics change underneath you`),
    P(`As the stock we already had in Europe began to sell through, we faced a decision: did we replenish it from Britain?`),
    P(`Our products were still made in England but moving those products into the European Union now involved a different customs and administrative environment. Origin requirements, VAT, documentation, carriers and the possibility of delays all became part of a calculation that had previously been considerably simpler.`),
    P(`There was another problem that was harder to quantify: confidence.`),
    P(`Some European stockists became increasingly reluctant to buy from Britain because they did not want the additional paperwork, costs or uncertainty. From their perspective, suppliers operating inside the European Union did not necessarily present the same complications.`),
    P(`Eventually, we decided not to replenish our European inventory.`),
    P(`What disappeared was not simply stock sitting on a warehouse shelf. We lost momentum, relationships, local knowledge and a market presence that had taken years to establish.`),
    P(`So, when I am asked what I would do differently today, the answer is difficult.`),
    P(`The truth is: perhaps not very much.`),
    P(`We had local distribution. We had European stock. We had retailers. We had customers. We had spent years developing those foundations.`),
    P(`The problem was not that Apple &amp; Bears had failed to prepare for international trade. The trading environment around the business had changed.`),
    H(`A warehouse doesn't make the border disappear`),
    P(`I have also seen the problem from another direction through a British company whose circumstances I know closely.`),
    P(`Long before Brexit, that company made what was then a logical decision to base its principal European warehousing operation in Belgium. Britain was part of the EU single market, so the location allowed it to serve European and British customers from the same operation.`),
    P(`Brexit changed that model.`),
    P(`Goods travelling from Belgium to British customers were now crossing a customs border. Some customers faced additional charges and refused deliveries. Returns increased, and the company faced the practical problem of what to do with goods that could become uneconomic to transport backwards and forwards.`),
    P(`Over time, systems improved. Different arrangements were developed for returns, and the company considered the economics of maintaining warehousing on both sides of the Channel.`),
    P(`But that creates another cost.`),
    P(`Two warehouses mean more infrastructure, more inventory decisions, more administration and potentially more capital tied up in stock.`),
    P(`Even now, I have seen shipments where several pallets move successfully while another is delayed because something in the documentation or carrier process does not match.`),
    P(`For a large multinational, an exception can sometimes be absorbed. For an independent business, exceptions can change the economics of an order.`),
    H(`So what would I actually do differently?`),
    P(`If Apple &amp; Bears were approaching Europe from the beginning today, I would spend considerably more time modelling the complete journey of the product before committing significant inventory.`),
    P(`Where will the stock sit? Who will import it? How will VAT be dealt with? What evidence of origin will be required? What will the customer see at checkout? What happens when a delivery is refused? Where does a returned product go, and who pays for getting it there?`),
    P(`For direct-to-consumer sales, I would also examine mechanisms such as the Import One Stop Shop, where applicable, alongside delivery arrangements that allow relevant taxes, duties and charges to be dealt with as clearly as possible before the parcel reaches the customer.`),
    P(`But the principle matters to me more than the acronym: a customer should understand what a purchase is going to cost before it arrives at their door.`),
    P(`I would also place greater emphasis on the freight partner and on getting the documentation right.`),
    P(`The UK does have a trade agreement with the EU. Goods that satisfy the applicable rules of origin can qualify for preferential tariff treatment, but businesses must understand the product-specific requirements and hold appropriate evidence when claiming that preference.`),
    P(`Being made in Britain does not, by itself, remove the administrative process involved in crossing the border.`),
    P(`That distinction matters.`),
    H(`Sometimes there isn't a clever answer`),
    P(`We considered establishing a greater physical presence inside the EU, including holding stock in Germany or the Netherlands.`),
    P(`But Apple &amp; Bears products are made in England. Putting the warehouse in Europe would not change the fact that the products first have to move from Britain into the EU.`),
    P(`Moving manufacturing into Europe would create a different model altogether. But it would also mean reconsidering something fundamental to Apple &amp; Bears: our commitment to manufacturing our products in England.`),
    P(`So I would be cautious about telling another British SME that there is one simple post-Brexit solution.`),
    P(`There isn't.`),
    P(`An independent manufacturer can change its warehouse, carrier, distributor, checkout and documentation processes. It can become better at anticipating problems and calculating the true landed cost of a product.`),
    P(`What it cannot change by itself is the trading framework within which all those decisions have to operate.`),
    P(`If I were rebuilding our European business today, I would approach the mechanics with greater caution. I would test every assumption before committing capital.`),
    P(`But I would still want to sell into Europe.`),
    P(`Because perhaps the biggest lesson from our experience is this:`),
    P(`The hardest thing to replace was never the stock. It was the momentum.`),
    P(`<em>Read the first part: <a href="${BREXIT_URL}">Brexit: what it cost one small British manufacturer</a>.</em>`),
    H(`About the author`),
    `<div class="author-bio">
      <img src="${headshotUrl}" alt="Dean Butt, co-founder of Apple &amp; Bears" width="140" />
      <p><strong>Dean Butt</strong> is co-founder of <a href="https://appleandbears.com/">Apple &amp; Bears</a>, an independent British luxury body-care brand. Apple &amp; Bears develops and manufactures its collections in England, using international sourcing where specialist capabilities are not practically available domestically.</p>
    </div>`,
  ].join("\n\n");
}

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

// Hero straight from his email, never touching disk.
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const H_ = { Authorization: `Bearer ${rt}` };
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}?format=full`, { headers: H_ }).then((r) => r.json());
let att; (function walk(p) { if (p.filename === HERO_FILE && p.body?.attachmentId) att = p; for (const c of p.parts || []) walk(c); })(msg.payload);
if (!att) throw new Error(`no attachment named ${HERO_FILE}`);
const raw = Buffer.from((await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}/attachments/${att.body.attachmentId}`, { headers: H_ }).then((r) => r.json())).data, "base64url");
const meta = await sharp(raw).metadata();
const targetH = Math.round((meta.width * 9) / 16);
const extra = Math.max(0, targetH - meta.height);
const hero = await sharp(raw).resize(meta.width, Math.max(meta.height, targetH), { fit: "cover" }).blur(28).composite([{ input: raw, top: Math.floor(extra / 2), left: 0 }]).jpeg({ quality: 88 }).toBuffer();
console.log(`hero ${meta.width}x${meta.height} -> ${meta.width}x${meta.height + extra}, ${(hero.length / 1024).toFixed(0)} KB`);
if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`)).filter((r) => /differently selling into europe/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const headshotUrl = wp(`post get ${HEADSHOT_ID} --field=guid`);
if (!/dean-butt/.test(headshotUrl)) throw new Error(`attachment ${HEADSHOT_ID} is not the headshot`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`dean-europe-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/dean-europe-hero-${stamp}.jpg --title=${sq("Apple & Bears: selling into Europe today")} --alt=${sq("An Apple & Bears lorry at Dover heading for EU departures and customs control. Image: Apple & Bears")} --porcelain`);
put(`dean-europe-body-${stamp}.html`, Buffer.from(buildBody({ headshotUrl }), "utf8"));
const postId = wp(`post create /tmp/dean-europe-body-${stamp}.html --post_type=post --post_status=draft --post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/dean-europe-hero-${stamp}.jpg /tmp/dean-europe-body-${stamp}.html`);
console.log(`DRAFT ${postId}: "${TITLE}"  hero ${heroId}  tags: ${wp(`post term list ${postId} post_tag --field=slug`)}  cat: ${wp(`post term list ${postId} category --field=name`)}`);
