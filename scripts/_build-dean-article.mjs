/**
 * One-off: build Dean Butt's guest piece as a DRAFT on Smart SME.
 *
 * Streams his two attachments straight from Gmail into the WP media library —
 * nothing is written to disk on the way through.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-dean-article.mjs
 */

import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";
import { uploadMedia, publishToWordPress, resolveCategory, updatePost } from "../lib/wordpress.js";
import sharp from "sharp";

// Set once the draft exists, so re-runs revise it instead of piling up drafts.
const POST_ID = Number(process.env.POST_ID || 0);

const FROM = "dean@appleandbears.com";
const READ = ["https://www.googleapis.com/auth/gmail.readonly"];
const FEATURED = "Sustainability Without Pretending to Be Perfect_ apple & bears.jpg";
const HEADSHOT = "DEAN BUTT .2.jpg";

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const wp = creds.wordpress;
const sender = outreachSender(creds.outreach);
await prisma.$disconnect();

// --- lift the two images out of his reply -----------------------------------
const token = await getGoogleAccessToken(READ, sender.email);
const list = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(`from:${FROM}`)}`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());
const msg = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=full`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());

const atts = [];
(function walk(p) {
  if (p.filename && p.body?.attachmentId)
    atts.push({ name: p.filename, type: p.mimeType, id: p.body.attachmentId });
  for (const c of p.parts || []) walk(c);
})(msg.payload);

async function grab(name) {
  const a = atts.find((x) => x.name === name);
  if (!a) throw new Error(`attachment not found: ${name}`);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${a.id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((r) => r.json());
  return { buffer: Buffer.from(res.data, "base64url"), type: a.type };
}

const featured = await grab(FEATURED);
const headshot = await grab(HEADSHOT);
console.log(`pulled ${FEATURED} (${featured.buffer.length} bytes)`);
console.log(`pulled ${HEADSHOT} (${headshot.buffer.length} bytes)`);

// His graphic is 1200x600 (2:1). The theme crops heroes to 16:9, which lopped
// the right-hand third off and cut the badges in half. Padding to 16:9 with the
// artwork's own background colour means the theme has nothing left to crop, and
// the bars are invisible because the colour is sampled from the image itself.
// A flat colour pad does not work here: the artwork carries its own border, so
// any sampled colour sits as two visible bands. Filling the extra height with a
// blurred, scaled copy of the artwork itself reads as deliberate letterboxing.
const meta = await sharp(featured.buffer).metadata();
const targetH = Math.round((meta.width * 9) / 16);
const extra = Math.max(0, targetH - meta.height);
console.log(`hero ${meta.width}x${meta.height} -> ${meta.width}x${meta.height + extra} (blurred extend)`);
const heroBuffer = extra
  ? await sharp(featured.buffer)
      .resize(meta.width, targetH, { fit: "cover" })
      .blur(28)
      .composite([{ input: featured.buffer, top: Math.floor(extra / 2), left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer()
  : featured.buffer;

const featuredMedia = await uploadMedia(wp, {
  data: heroBuffer,
  contentType: "image/jpeg",
  filename: "apple-and-bears-sustainability-hero",
  alt: "Apple & Bears body care products, manufactured and filled in England",
  caption: "Apple &amp; Bears manufactures and fills its collections in England. Image: Apple &amp; Bears",
});
const headshotMedia = await uploadMedia(wp, {
  data: headshot.buffer,
  contentType: headshot.type,
  filename: "dean-butt-apple-and-bears",
  alt: "Dean Butt, co-founder of Apple & Bears",
});
console.log(`featured media ${featuredMedia.id}  ${featuredMedia.url}`);
console.log(`headshot media ${headshotMedia.id}  ${headshotMedia.url}`);

// --- the article ------------------------------------------------------------
const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;

const body = [
  `<p class="standfirst"><em>Sustainability claims are easy to write and hard to stand behind. In this guest piece, the co-founder of an independent British manufacturer sets out the trade-offs behind the label: minimum order quantities, tied-up working capital, the components you cannot buy in Britain, and why overproducing a "sustainable" product is still waste.</em></p>`,

  P(`<strong>By Dean Butt, Co-founder, Apple &amp; Bears</strong>`),

  P(`Sustainability has become one of the most important considerations in modern business. Consumers want to make better choices, businesses want to reduce their environmental impact, and manufacturers are under increasing pressure to demonstrate that the products they make are produced responsibly.`),
  P(`But there is a danger in presenting sustainability as though a business must achieve perfection before it can claim to be acting responsibly. Real manufacturing does not work that way.`),
  P(`Every product has a supply chain: materials have to come from somewhere, components have to be manufactured, products have to be transported, packaging has to be produced and finished goods have to reach the customer. Some of those processes can be controlled directly by a business; others cannot.`),
  P(`For Apple &amp; Bears, responsible beauty is therefore not about claiming that every decision is perfect. It is about considering the choices available, understanding their consequences and trying to make the best decision we can.`),
  P(`Our approach is simple: manufacture where you are, where practical, and source globally where necessary. That does not mean manufacturing everything in Britain regardless of cost or availability. Nor does it mean assuming that overseas production is automatically the wrong choice. It means looking at the complete picture and making a considered decision.`),

  H(`Sustainability begins with practical decisions`),
  P(`Our products are bulk manufactured and filled in England. We use UK suppliers where suitable and practical, including areas of our packaging and production.`),
  P(`There are good reasons for doing this beyond simply being able to say that a product is made in Britain. Being close to manufacturing partners can provide greater visibility over production: communication can be more direct, problems can potentially be addressed more quickly, lead times can be shorter, and transport requirements can sometimes be reduced. Just as importantly, relationships can be developed with the businesses and people actually involved in making the products.`),
  P(`There is also a social dimension. Manufacturing is not simply about machinery and factories. It is about people, employment, skills and communities. Choosing to manufacture locally where practical can help support the businesses and individuals that make up a domestic manufacturing economy. For an independent company, that matters.`),

  H(`Local does not automatically mean sustainable`),
  P(`It is tempting to assume that manufacturing in Britain automatically makes a product sustainable. It does not.`),
  P(`A product manufactured in England can still contain materials produced elsewhere. Components may travel internationally before reaching a British factory, and raw materials, packaging materials and specialist parts may come from different countries. Energy consumption, production efficiency, waste and transportation all contribute to the overall environmental impact of a product.`),
  P(`Equally, an overseas manufacturer is not automatically an irresponsible manufacturer. There are highly capable international manufacturers operating with advanced technology, sophisticated production systems and strong environmental standards.`),
  P(`Geography alone does not determine sustainability. The more important question is what happens throughout the supply chain and whether a business has properly considered the consequences of its decisions.`),

  H(`What happens when a component is not available locally?`),
  P(`This is where sustainability becomes a practical business issue rather than a theoretical one. There are components and manufacturing capabilities that simply may not be available in the UK at the specification, volume or commercial terms required by an independent business.`),
  P(`For Apple &amp; Bears, our push pumps are one example. They are supplied through a UK supplier, but the pumps themselves are manufactured overseas because the specific manufacturing capability we require is not currently available domestically.`),
  P(`We could simply talk about our UK manufacturing and leave out that detail. But that would not accurately represent how modern manufacturing works. The more responsible approach is to acknowledge the reality: we manufacture where we can, we source internationally where we need to, and we consider the wider consequences of those decisions. That is what responsible manufacturing means to us.`),

  H(`Sustainability should not become a marketing shortcut`),
  P(`There is a danger that sustainability becomes reduced to a collection of attractive words: natural, green, eco, responsible, sustainable. But a word on a label does not make a supply chain sustainable, nor does changing one component while ignoring everything else.`),
  P(`For a business to act responsibly, it has to look beyond the easiest claim to communicate and consider the wider picture:`),
  `<ul>
    <li>Where are the materials coming from?</li>
    <li>Where are components manufactured, and how far do they travel?</li>
    <li>How much packaging is required, and how much waste is created?</li>
    <li>How long does the product remain in inventory, and what happens when demand is lower than expected?</li>
    <li>Can packaging be reused or recycled?</li>
    <li>Can components be sourced closer to home?</li>
    <li>Can production processes be improved?</li>
  </ul>`,
  P(`These questions may be less attractive than a sustainability slogan, but they are arguably much more important.`),

  H(`The sustainability problem of making too much`),
  P(`One area that deserves greater attention is overproduction. Manufacturing a product that nobody ultimately needs has an environmental cost, regardless of how sustainable the packaging may be.`),
  P(`Raw materials have been produced, energy has been consumed, packaging has been manufactured, and components have been transported. The finished product has occupied warehouse space and required further transportation. If demand does not materialise, the business may eventually discount the product, hold it for an extended period or, in the worst case, dispose of it.`),
  P(`This is one reason why responsible manufacturing cannot simply be about producing at the lowest possible unit cost. For an independent business, ordering 10,000 units may reduce the manufacturing price considerably. But if demand is significantly lower than expected, the apparent manufacturing efficiency creates another problem: unnecessary inventory.`),
  P(`The most responsible approach may sometimes be to manufacture in quantities that more closely reflect realistic demand, even when doing so results in a higher unit cost. Commercial efficiency and responsible manufacturing are therefore not always about producing more. Sometimes they are about producing the right amount.`),

  H(`Packaging is only part of the story`),
  P(`Packaging is another area where sustainability discussions can become overly simplistic. A recyclable bottle can be positive. Reusable packaging can be positive. Reducing unnecessary packaging can be positive. But packaging represents only one part of a product's overall environmental footprint.`),
  P(`The material itself has an origin: it has to be manufactured, transported, filled, labelled and distributed. Eventually, the consumer has to decide what happens to it after use. For this reason, sustainability cannot be reduced to a single packaging decision. It has to be considered as part of the entire product lifecycle.`),

  H(`Responsible business means accepting trade-offs`),
  P(`One of the realities of running an independent business is that resources are limited. A large multinational may have the purchasing power to commission bespoke materials, develop new manufacturing processes or invest heavily in supply-chain technology. A small independent company may not. It has to make decisions within the realities of its available capital, production volumes, supplier availability and customer demand.`),
  P(`That does not mean sustainability has to be abandoned; it means sustainability has to be practical.`),
  P(`Sometimes the more responsible option may also be the more expensive option. Sometimes a local supplier may be the better choice because it provides greater transparency or reduces supply-chain risk. Sometimes an international supplier may be the only realistic option because a particular capability does not exist domestically.`),
  P(`The important thing is to understand the trade-off rather than pretend it does not exist.`),

  H(`Transparency is part of sustainability`),
  P(`For us, transparency matters because responsible business should be able to withstand scrutiny. If we manufacture in England, we should be able to say so. If a component is manufactured overseas because the required capability is not available in Britain, we should also be able to say so.`),
  P(`There is no contradiction between those two statements; in fact, acknowledging the second makes the first more credible. Modern manufacturing is global, and even businesses committed to domestic production operate within international supply chains. Pretending otherwise does not make a company more sustainable. Being honest about the supply chain creates an opportunity to identify where improvements can actually be made.`),

  H(`The social commitment behind local manufacturing`),
  P(`Environmental sustainability is important, but responsible business also has a human dimension. Manufacturing supports employment, skills and communities.`),
  P(`When an independent business chooses a local supplier, the decision can have consequences beyond the individual purchase order: it helps sustain manufacturing capability and the people employed within it. That does not mean every purchase should automatically be made locally regardless of cost or capability. It means that local manufacturing should be considered as part of the wider decision.`),
  P(`For Apple &amp; Bears, supporting UK manufacturing where practical is therefore not simply a procurement decision. It is part of a wider social commitment to the businesses, workers and communities that make domestic manufacturing possible.`),

  H(`We do not claim to get every decision right`),
  P(`Apple &amp; Bears does not claim to get every sustainability or manufacturing decision right. What we can say is that we try to make the best decision we can, based on the information, resources, suppliers and capabilities available to us at the time.`),
  P(`That distinction is important. Responsible business is not about pretending that every decision has a perfect outcome; it is about considering the alternatives, understanding the consequences and making a considered choice rather than simply choosing the easiest or cheapest option.`),
  P(`We manufacture and fill in England where practical, use UK suppliers where suitable, and source internationally where a component or capability is not realistically available domestically. We consider production quantities, packaging, transportation, supply-chain resilience and the wider consequences of our decisions.`),
  P(`Sometimes there may be several possible choices, none of which is perfect. In those circumstances, we try to choose the option that represents the best overall balance for the business, our customers, our suppliers and the wider environment. And if a better option becomes available, we should be prepared to reconsider the decision.`),
  P(`That is perhaps the most important part of responsible business: doing your best to make the right decision, being honest about the limitations and remaining willing to improve.`),

  H(`Technology, AI and the opportunity to improve`),
  P(`Technology will also play an increasingly important role in helping businesses make better decisions. As technology develops, businesses have greater opportunities to improve forecasting, understand demand, manage inventory, monitor supply chains and identify ways to reduce unnecessary waste.`),
  P(`Artificial intelligence is becoming an important part of that development. For independent businesses in particular, AI can provide access to analysis and capabilities that were previously more difficult or expensive to achieve. It can help businesses understand information, identify patterns and support better-informed decisions.`),
  P(`However, technology is a tool, not an answer in itself. AI cannot remove the need for human judgement or replace the responsibility of a business to understand its suppliers, materials, manufacturing processes and wider impact. The quality of the decision will still depend on the information available and how that information is used.`),
  P(`As better technology develops, including with the assistance of AI, we believe there will be further opportunities for Apple &amp; Bears to improve how we operate. Better forecasting could help us manage production more effectively, better information could help us make more informed sourcing decisions, and improved technology may help us reduce waste and use resources more efficiently.`),
  P(`We do not claim to know what the best solutions will be in the future. What we can do is remain open to new technology, continue learning and be prepared to change when better options become available.`),
  P(`For us, that is another part of responsible business: we may not get every decision right today, but as technology, knowledge and capabilities improve, we should use them to try to make better decisions tomorrow.`),

  H(`Sustainability is a continuing process`),
  P(`There is perhaps too much pressure today for businesses to present sustainability as an achievement rather than a continuing process. We believe it is better understood as a journey.`),
  P(`Some decisions will be straightforward, others will involve compromises, some improvements will be significant, and others will be incremental. What matters is that the business continues to look at what it is doing and asks whether it can do better.`),
  P(`Manufacturing changes. Suppliers change. Technology changes. Customer expectations change. Better solutions become available. A decision that was sensible several years ago may not necessarily be the best decision today. Responsible businesses should therefore be prepared to revisit their assumptions.`),

  H(`Better decisions, rather than perfect claims`),
  P(`Ultimately, sustainability should not be about claiming perfection; it should be about trying to make better decisions.`),
  P(`For Apple &amp; Bears, that means manufacturing where we are, where practical, sourcing globally where necessary and continually looking at whether there are better ways of doing things. We do not claim that we get every decision right. No business does. What matters to us is that we consider the options, understand the consequences and try to make the best decision we can.`),
  P(`Sometimes that decision will involve compromise, sometimes the ideal solution simply will not be available, and sometimes a better solution may emerge in the future. Responsible beauty, in our view, is about recognising those realities rather than hiding them.`),
  P(`It is about making considered decisions, being transparent about the limitations we face and continuing to look for ways to improve. We may not get every decision right, but we will always try to make the best decision we can.`),
  P(`That, for us, is what responsible beauty means.`),

  // House style asks every piece to answer "what does this mean for a small
  // business?". Dean's piece answers it implicitly; this makes it explicit and
  // is the editor's addition, not his.
  H(`What this means for your business`),
  `<div class="takeaways"><ul>
    <li><strong>Check your minimum order quantity against real demand, not the unit price.</strong> A lower price per unit on 10,000 pieces is a false economy if you are still holding stock in eighteen months. The cash is gone and the write-off is waste.</li>
    <li><strong>Map which parts of your supply chain you actually control.</strong> You cannot improve what you have not identified, and you cannot defend a claim you have not checked.</li>
    <li><strong>Name the gaps before a customer finds them.</strong> Disclosing the component you import is what makes the rest of your sourcing story credible.</li>
    <li><strong>Treat sustainability claims as a compliance risk, not just marketing.</strong> Unsubstantiated environmental claims fall under the CMA's Green Claims Code and the Digital Markets, Competition and Consumers Act.</li>
  </ul></div>`,

  H(`About the author`),
  `<div class="author-bio">
    <img src="${headshotMedia.url}" alt="Dean Butt, co-founder of Apple &amp; Bears" width="140" />
    <p><strong>Dean Butt</strong> is co-founder of <a href="https://appleandbears.com/">Apple &amp; Bears</a>, an independent British luxury body-care brand. Apple &amp; Bears develops and manufactures its collections in England, using international sourcing where specialist capabilities are not practically available domestically.</p>
  </div>`,
].join("\n\n");

const categoryId = await resolveCategory(wp, "Operations");
const TITLE = "Sustainability without pretending to be perfect";
const META =
  "An independent manufacturer on the trade-offs behind sustainability claims: order quantities, working capital, imported components and why overproduction is still waste.";

if (POST_ID) {
  await updatePost(wp, POST_ID, {
    title: TITLE,
    content: body,
    featured_media: featuredMedia.id,
    categories: [categoryId],
    excerpt: META,
  });
  console.log(`\nDRAFT updated: id=${POST_ID}`);
} else {
  const post = await publishToWordPress(wp, {
    title: TITLE,
    body,
    status: "draft",
    featuredMediaId: featuredMedia.id,
    categoryId,
    keyphrase: "sustainable manufacturing for small businesses",
    metaDesc: META,
  });
  console.log(`\nDRAFT created: id=${post.id}`);
  console.log(`preview: ${post.link}`);
}
