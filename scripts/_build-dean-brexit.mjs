/**
 * Dean Butt, Apple & Bears: "Brexit: the cost to us". Built as a DRAFT on
 * Smart SME over SSH + wp-cli, because the REST API is walled off by
 * SiteGround's WAF since 7 Sep (see memory: siteground-waf-blocks-rest-writes).
 *
 * Source: his email of 15 Sep 2026 14:11 UTC and the piece on his own blog,
 * https://appleandbears.com/blogs/news/brexit-the-cost-to-us. Text is his,
 * lightly sub-edited to house style: sentence-case subheads, em dashes out,
 * UK spelling as he already had it. Two additions are the editor's and marked
 * as such: the standfirst and the "What this means for your business" box.
 * His disclosure paragraph is kept in full, it is part of the piece.
 *
 * Hero is the og:image from his page, padded to 16:9 with a blurred extension
 * so the theme has nothing to crop. Headshot is the one already in the media
 * library from 3 Sep (attachment 1022), not re-uploaded.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-dean-brexit.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const SOURCE = "https://appleandbears.com/blogs/news/brexit-the-cost-to-us";
const HEADSHOT_ID = 1022;
const CATEGORY_ID = 6; // Operations
const TAG = "guest-perspective";

const TITLE = "Brexit: what it cost one small British manufacturer";
const SEO_TITLE = TITLE;
const META =
  "A British body-care brand on what Brexit actually cost it: lost German stockists, a Spanish customer facing a 70 euro duty bill, held pallets and returns.";
const EXCERPT = META;
const KEYPHRASE = "brexit cost small business";

if (/[—–]/.test(TITLE + EXCERPT + META)) throw new Error("em or en dash in title/excerpt/meta");
if (META.length > 155) throw new Error(`meta is ${META.length} chars, cap is 155`);

// ---------- body ----------------------------------------------------------------
const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;

function buildBody({ headshotUrl }) {
  return [
    `<p class="standfirst"><em>Most writing about Brexit and small business is a forecast. This is a ledger. The co-founder of an independent British body-care brand sets out what actually happened to his company: the German stockists that stopped ordering, the customer in Spain who sent four bottles back rather than pay 70 euros at the door, the pallets held for a fortnight over a paperwork mismatch, and the warehouses that filled up with returns.</em></p>`,

    P(`<strong>By Dean Butt, Co-founder, Apple &amp; Bears</strong>`),

    P(`Brexit changed the way we did business.`),
    P(`For Apple &amp; Bears, that change was experienced not through political debate or economic forecasts, but through customers, stockists, shipments, customs, delays and lost opportunities.`),
    P(`We were a British company that had spent years building relationships across Europe. Before Brexit, Europe had never felt like a distant export market. It felt like an extension of our marketplace.`),
    P(`We were still a young, independent British brand, finding our feet, but the opportunity in front of us was enormous. We could look across the Channel and see millions of potential customers and businesses we could reach without the level of friction normally associated with international trade.`),
    P(`Germany was particularly important to us. Our philosophy resonated there, and we were making progress with online stores, luxury retailers and established businesses. We were even making inroads with Watson, one of Germany's major pharmaceutical and cosmetics retail chains.`),
    P(`For a British company like ours, that was exciting. We felt we were building something. Our British identity felt like an advantage rather than a barrier, and we had developed a product range and philosophy that people in another European country understood and appreciated.`),
    P(`Then Britain voted to leave the European Union.`),
    P(`The decision was made, and we accepted it. What matters to me here is not revisiting that decision, but explaining what followed for our business.`),

    H(`When trading became more complicated`),
    P(`For us, one of the biggest changes was losing the simplicity of trading with our European neighbours.`),
    P(`Before Brexit, we could send a pallet into Europe and expect it to arrive in roughly two days. Afterwards, customs paperwork, duties, taxes and delays became part of the daily equation. We experienced situations where a shipment could be held for around two weeks because something on the paperwork did not match what customs expected.`),
    P(`For a British company trying to build an international market, that could change the economics very quickly.`),
    P(`Our European customers and stockists were suddenly faced with a practical question: why continue buying from Britain when products could potentially be sourced from within the European Union without the additional complications associated with importing from a British company?`),
    P(`We began losing stockists in Germany. The reason was not that they had stopped liking our products or believing in our brand. The trading environment had changed.`),
    P(`That distinction matters.`),
    P(`We hadn't suddenly become a different company. Our products hadn't changed. Our philosophy hadn't changed. But the ease with which customers and businesses could buy from us had changed, and for a company trying to establish a market, that difference can be enormous.`),

    H(`The customer who brought it home`),
    P(`Sometimes the practical consequences of a change in trade arrangements are easier to understand through one person's experience than through a page of statistics.`),
    P(`I remember a customer in Spain particularly well. His name was Mario.`),
    P(`While living in Britain, Mario had bought Apple &amp; Bears body wash and liked it enough that, after returning to Spain, he still wanted to buy our products. He ordered four bottles directly from us, and we shipped them.`),
    P(`About ten days later, I noticed another order for four of the same products coming through from a local Spanish stockist. About a week after our original shipment, our parcel was returned.`),
    P(`Mario explained that he could not afford the 70 euro duty that had been demanded on delivery. He had no choice but to return the order, yet he still wanted the product. He therefore found another way to buy it through a supplier within the European market.`),
    P(`As a business owner, I was disappointed to lose the direct sale, but I was also glad that Mario found a way to continue buying Apple &amp; Bears.`),
    P(`The experience stayed with me because it demonstrated something fundamental about commerce: when buying from one supplier becomes significantly more complicated than buying from another, customers will naturally look for the easier route.`),
    P(`It was about practicality.`),

    H(`When returns became the story`),
    P(`It wasn't only individual customers.`),
    P(`At one point, I visited one of our shipping partners. When I had first known the company, it operated from a relatively modest warehouse. By then, it had expanded into two additional buildings alongside the original, and I assumed business must have been going very well.`),
    P(`The reality was very different.`),
    P(`The additional warehouses were being used to store returns coming back from Europe. Customers were receiving goods and, when faced with the additional costs associated with receiving them, some were deciding they could not accept the shipments. The logistics company was dealing with so many returns that additional storage had become necessary.`),
    P(`I remember wondering: if this was happening around a British company like us, what was happening to companies shipping thousands of orders?`),
    P(`I didn't have the answer, but I understood that what looked like a change in trading arrangements could create consequences much further down the chain. A customer sees a charge, rejects a parcel, a business receives a return, a warehouse needs additional space and a logistics company has to deal with the extra handling.`),
    P(`Somewhere in that chain, the original sale becomes harder to sustain.`),

    H(`Seeing the problem from another direction`),
    P(`We also saw the disruption from another angle.`),
    P(`A British company we knew had established a warehouse operation in Belgium before Brexit, intending to serve both European and UK customers more effectively. The commercial logic was straightforward: put stock closer to customers, reduce delivery problems and make the European market easier to serve.`),
    P(`Yet even with stock positioned within Europe, the new cross-border arrangements created difficulties. Shipments were delayed, customer complaints increased and the company experienced redundancies during that period. At the time, we were hearing of pallets being held at customs for extended periods, while UK customers waited for products and negative reviews increased.`),
    P(`I cannot claim that every company experienced exactly the same thing. Businesses, markets and circumstances differ. But these were things we saw and experienced around us while trying to run our own business, and they changed the way we viewed international trade.`),

    H(`What it cost Apple &amp; Bears`),
    P(`For Apple &amp; Bears, the consequences were real.`),
    P(`We lost European stockists. We lost direct customers who still wanted our products but found buying from Britain more complicated or expensive. We lost momentum in a market where we had been building relationships, and we lost opportunities that had taken years to develop.`),
    P(`That is perhaps the part that is hardest to measure.`),
    P(`A lost order can be recorded. A lost stockist can be recorded. A delayed shipment can be recorded. But what about the relationship that might have developed over the next five or ten years? What about the retailer that might have opened another location? What about the customer who might have introduced someone else to the brand?`),
    P(`What about the market that a British company might have continued developing if the trading environment had remained as accessible as it once was?`),
    P(`Those things don't appear neatly on a balance sheet.`),
    P(`But they are still costs.`),

    H(`Surviving doesn't mean we weren't damaged`),
    P(`We were fortunate in one respect. We had always tried to run Apple &amp; Bears with financial discipline and had not overstretched the company.`),
    P(`During COVID-19, we chose not to take furlough or government bailout support. We believed in weathering the storm ourselves and taking responsibility for the business we had built. That resilience helped us through difficult years.`),
    P(`But surviving something does not mean it didn't hurt.`),
    P(`We are still here. We are still manufacturing in the UK. We are still developing Apple &amp; Bears and building the business.`),
    P(`Being here today should not be confused with saying that everything that happened along the way had no consequences.`),
    P(`It did.`),
    P(`We experienced those consequences ourselves.`),

    H(`Europe is still there`),
    P(`Today, there is growing discussion about closer relationships between Britain and Europe and about making trade easier.`),
    P(`I welcome that.`),
    P(`I simply want a fair opportunity to trade with our European neighbours again.`),
    P(`Germany is still there. Europe is still there. The relationships we built were real, the customers were real, the businesses were real and the opportunity was real.`),
    P(`Some of the companies we worked with are no longer operating. Some relationships did not survive the disruption. Some opportunities were lost and will never return.`),
    P(`That is the part that saddens me most, because behind export figures and trade statistics are real people, real businesses, real jobs and years of hard work.`),
    P(`For Apple &amp; Bears, Europe was never simply a column on a spreadsheet.`),
    P(`It was part of our story.`),
    P(`We are proud to be a British company. We are proud of what we have built here. But we also want the opportunity to build relationships with our European neighbours again, commercially, practically and positively.`),
    P(`I don't know what the future trading relationship between Britain and Europe will look like. But I remain hopeful.`),
    P(`Because we are still here. Europe is still there. Germany is still there.`),
    P(`And perhaps, one day, trading between us will become a little easier again.`),
    P(`The lesson I take from our experience is simple: trade is never just about rules, paperwork or statistics. It is about whether a customer can buy, whether a business can compete, whether a shipment arrives, and whether a relationship has the chance to grow.`),
    P(`When those things become harder, the cost is not always visible immediately. Sometimes it is a lost order. Sometimes it is a lost stockist. Sometimes it is a business decision to stop investing in a market.`),
    P(`And sometimes it is an opportunity that simply never gets the chance to exist.`),
    P(`For a British company like Apple &amp; Bears, that is what Brexit cost us.`),
    P(`We don't know exactly what the future holds. But we remain here, we remain British, and we remain open to Europe.`),
    P(`I want a fair opportunity to trade with our European neighbours again.`),
    P(`That is not about looking backwards.`),
    P(`It is about making sure that the opportunities ahead are not unnecessarily harder to reach.`),

    H(`Disclosure`),
    P(`<em>Throughout this article, company names and specific partner details have been deliberately omitted out of respect for the privacy and commercial sensitivity of the businesses involved. Similarly, "Mario" is referred to by his first name only to protect his privacy and personal circumstances. These accounts are drawn directly from my experience of running Apple &amp; Bears and are included to illustrate what we experienced as a British company, not to criticise, embarrass or attribute blame to any individual or business.</em>`),

    // House style: every piece answers "what does this mean for a small
    // business?". Editor's addition, marked as such.
    H(`What this means for your business`),
    `<div class="takeaways"><p><em>Editor's notes on the practical side of Dean's account.</em></p><ul>
      <li><strong>Sell to EU consumers delivered duty paid.</strong> The 70 euro bill at Mario's door is what happens when a parcel goes out with charges to be collected on delivery. Register for the EU's Import One-Stop Shop so VAT on orders up to 150 euros is charged at your checkout, and use your carrier's DDP service above that so the customer sees the whole price before they buy.</li>
      <li><strong>The fortnight at customs is almost always a mismatch.</strong> Commodity code, declared value or an origin statement that does not agree with the invoice. Get an EORI number, check whether your goods actually qualify as UK origin under the trade agreement (they may not if key components are imported), and make the commercial invoice match the declaration line for line.</li>
      <li><strong>Price the returns chain before you take the order.</strong> A rejected parcel costs outbound carriage, return carriage, handling and sometimes the duty anyway. On a thin margin, small EU consumer orders may not be worth taking at all unless they go out duty paid.</li>
      <li><strong>If Europe is a real market, hold stock inside it.</strong> A fulfilment partner in the Netherlands or Germany turns dozens of consumer imports into one bulk shipment, and EU customers buy from an EU address. The Belgian warehouse in this piece shows it is not a cure on its own: it moves the friction away from the customer, it does not remove the border.</li>
    </ul></div>`,

    P(`<em>A version of this article first appeared on the <a href="${SOURCE}">Apple &amp; Bears blog</a>.</em>`),

    H(`About the author`),
    `<div class="author-bio">
      <img src="${headshotUrl}" alt="Dean Butt, co-founder of Apple &amp; Bears" width="140" />
      <p><strong>Dean Butt</strong> is co-founder of <a href="https://appleandbears.com/">Apple &amp; Bears</a>, an independent British luxury body-care brand. Apple &amp; Bears develops and manufactures its collections in England, using international sourcing where specialist capabilities are not practically available domestically.</p>
    </div>`,
  ].join("\n\n");
}

// ---------- hero ------------------------------------------------------------------
const pageHtml = await fetch(SOURCE, { headers: { "user-agent": "Mozilla/5.0 (CogentBot)" } }).then((r) => r.text());
const og = (pageHtml.match(/property="og:image"\s+content="([^"]+)"/) || [])[1];
if (!og) throw new Error("no og:image on his page");
const heroSrc = og.replace(/^http:/, "https:").replace(/&amp;/g, "&");
const heroRaw = Buffer.from(await fetch(heroSrc, { headers: { "user-agent": "Mozilla/5.0 (CogentBot)" } }).then((r) => r.arrayBuffer()));
const meta = await sharp(heroRaw).metadata();
const targetH = Math.round((meta.width * 9) / 16);
const extra = Math.max(0, targetH - meta.height);
const hero = await sharp(heroRaw)
  .resize(meta.width, Math.max(meta.height, targetH), { fit: "cover" })
  .blur(28)
  .composite([{ input: heroRaw, top: Math.floor(extra / 2), left: 0 }])
  .jpeg({ quality: 88 })
  .toBuffer();
console.log(`hero ${meta.width}x${meta.height} -> ${meta.width}x${meta.height + extra}, ${(hero.length / 1024).toFixed(0)} KB, from ${heroSrc.split("?")[0]}`);

if (DRY) {
  console.log(`\nDRY: title "${TITLE}" (${TITLE.length}), meta ${META.length} chars. Nothing written.`);
  process.exit(0);
}

// ---------- write it, over SSH -------------------------------------------------
const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const { creds } = await siteCredentials(site.id);
const s = creds.sftp;
const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) =>
  execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
    { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

// Refuse a second copy.
const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`))
  .filter((r) => /brexit/i.test(r.post_title));
if (existing.length) throw new Error(`a Brexit post already exists: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);

const headshotUrl = wp(`post get ${HEADSHOT_ID} --field=guid`);
if (!/dean-butt/.test(headshotUrl)) throw new Error(`attachment ${HEADSHOT_ID} is not the headshot: ${headshotUrl}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`dean-brexit-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/dean-brexit-hero-${stamp}.jpg --title=${sq("Apple & Bears, Brexit: the cost to us")} --alt=${sq("Apple & Bears pallets in a warehouse beside a Union flag and an EU flag. Image: Apple & Bears")} --porcelain`);

const body = buildBody({ headshotUrl });
put(`dean-brexit-body-${stamp}.html`, Buffer.from(body, "utf8"));

const postId = wp(
  `post create /tmp/dean-brexit-body-${stamp}.html --post_type=post --post_status=draft --post_category=${CATEGORY_ID} ` +
    `--post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`
);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(SEO_TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/dean-brexit-hero-${stamp}.jpg /tmp/dean-brexit-body-${stamp}.html`);

const check = JSON.parse(wp(`post get ${postId} --fields=ID,post_status,post_title,post_name --format=json`));
const tags = wp(`post term list ${postId} post_tag --field=slug`);
const cats = wp(`post term list ${postId} category --field=name`);
console.log(`\nDRAFT ${check.ID}: "${check.post_title}"  status=${check.post_status}\n  hero attachment ${heroId}  ${wp(`post get ${heroId} --field=guid`)}\n  category: ${cats}   tags: ${tags}`);
await prisma.$disconnect();
