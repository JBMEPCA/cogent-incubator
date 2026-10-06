/**
 * Dean Butt, Apple & Bears: "When AI changes everything, who will still be
 * standing?" First look offered to Smart SME (his email of 19 Sep 2026,
 * thread 1a0b9503078b35ec); he adds it to his Press Room afterwards with a
 * link. DRAFT over SSH.
 *
 * Text is his from the .docx, sub-edited to house style: sentence-case
 * subheads, em dashes out, the four external links kept with their
 * ?utm_source=chatgpt.com stripped. Hero is his concept-store render
 * (1200x600, padded to 16:9). The 2024 INTELIA mock-up goes inline as a real
 * wp:image block at the point his text refers to it. Headshot is 1022.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-dean-ai.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const DRY = process.argv.includes("--dry");
const MSG_ID = "1a0b9503078b35ec";
const HERO_FILE = "APPLE & BEARS Virtual store.jpg";
const INLINE_FILE = "INTELIA Virtual Store Development Concept – 2024 — Image by APPLE & BEARS.jpg";
const HEADSHOT_ID = 1022;
const CATEGORY_NAME = "AI & Automation";
const TAG = "guest-perspective";

const L = {
  gmb: "https://www.itv.com/watch/good-morning-britain/2a3211/2a3211a4427",
  hosp: "https://hospitalitymarketplace.co.za/2025/11/11/how-ai-is-reshaping-service-strategy-and-systems-hospitality-rewired/",
  ab2024: "https://appleandbears.com/blogs/news/revolutionizing-retail",
  nvidia: "https://developer.nvidia.com/industries/retail-consumer-packaged-goods-cpg",
};

const TITLE = "When AI changes everything, who will still be standing?";
const META = "Dean Butt on the virtual store he shelved in 2024, why AI now makes it buildable, and what stays yours when every business can have the same technology.";
const EXCERPT = META;
const KEYPHRASE = "AI and the future of brands";
if (/[—–]/.test(TITLE + META)) throw new Error("em or en dash in title/meta");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
const A = (href, text) => `<a href="${href}">${text}</a>`;
function buildBody({ headshotUrl, inlineId, inlineUrl }) {
  const inline = `<!-- wp:image {"id":${inlineId},"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="${inlineUrl}" alt="INTELIA virtual store development concept from 2024, showing where a human avatar would stand inside the store interface" class="wp-image-${inlineId}"/><figcaption class="wp-element-caption">INTELIA virtual store development concept, 2024. Image: Apple &amp; Bears</figcaption></figure>
<!-- /wp:image -->`;
  return [
    `<p class="standfirst"><em>From disappearing shopfronts to virtual stores, AI actors and robotic hospitality: what happens to the brand when technology changes almost everything around it? In this piece, written for Smart SME, the co-founder of Apple &amp; Bears describes the virtual store he started building in 2024 and shelved, and why the question it raised matters more now that the technology has caught up.</em></p>`,
    P(`<strong>By Dean Butt, Co-founder, Apple &amp; Bears</strong>`),
    P(`Thirty years ago, the natural progression of a growing consumer brand seemed relatively easy to understand.`),
    P(`You developed a product. You built a customer base. You expanded your distribution. And somewhere in that journey sat the ambition of opening your own shop.`),
    P(`When we founded Apple &amp; Bears, I shared that ambition. I could imagine a physical store with our name above the door: somewhere customers could walk in, experience the products and fragrances, speak to somebody who understood the brand and leave carrying an Apple &amp; Bears bag.`),
    P(`I still like that image.`),
    P(`But I am no longer convinced that a physical shop is necessarily the ultimate expression of growth.`),
    H(`The high street I remember`),
    P(`The British high street has changed enormously during my lifetime.`),
    P(`I remember streets with a greater variety of independent shops, specialist retailers and businesses that gave different towns their individual character.`),
    P(`Today, many businesses considering physical retail face a difficult question: does the investment required to establish and operate a store still make sense when the way people discover and buy products is changing so quickly?`),
    P(`For Apple &amp; Bears, that question has become increasingly relevant.`),
    P(`Our online presence can reach somebody without us needing a shop on their high street. Search engines can introduce them to an article we have written. Social platforms can introduce the brand visually. AI systems are increasingly becoming another route through which somebody can discover a company or product.`),
    P(`The shopfront hasn't disappeared.`),
    P(`It is changing form.`),
    H(`Something happened on television`),
    P(`On 14 September 2026, something happened on British breakfast television that caught my attention.`),
    P(`On ITV's Good Morning Britain, Susanna Reid and Ed Balls met Tilly Norwood, an AI-generated actress, and her creator Eline Van der Velden. ITV's programme listing describes the segment in those terms. ${A(L.gmb, "The episode is on ITVX")}.`),
    P(`Think about that for a moment.`),
    P(`An AI-generated actress had become sufficiently culturally relevant to sit within the format of a mainstream British breakfast television interview.`),
    P(`Not in 2046.`),
    P(`In 2026.`),
    P(`That matters to me not because I believe an AI actress tells us exactly what the future will look like, but because it demonstrates how quickly something that sounds futuristic can move into an ordinary part of public life.`),
    P(`Hospitality is providing another glimpse.`),
    P(`South African trade publication Hospitality Marketplace has ${A(L.hosp, "documented AI applications")} across booking, operational and food-service systems. It also reported that Johannesburg's Tang Palace had introduced robot waiters named Ginger, Pepper and Rocky to assist with orders and service. The same feature examines emerging kitchen robotics while noting that such technology is not yet mainstream.`),
    P(`These aren't scenes from a film.`),
    P(`They are early examples of a transition already under way.`),
    H(`What happens when AI leaves the screen?`),
    P(`I believe the next stage will be much bigger.`),
    P(`AI will not remain something we access through a box on a computer screen.`),
    P(`As artificial intelligence improves and increasingly capable robotics develops alongside it, I believe machines will become part of everyday activity across hospitality, manufacturing, retail, logistics, cleaning and many other industries.`),
    P(`I can envisage hotels where AI handles much of the reservation process and elements of reception and customer service, while increasingly capable machines assist with physical tasks elsewhere in the operation.`),
    P(`I can envisage manufacturing environments requiring fewer people to supervise increasingly autonomous processes.`),
    P(`And I can envisage a very different type of retail experience.`),
    P(`I may be wrong about the speed.`),
    P(`I don't believe I am wrong about the direction.`),
    H(`We didn't just write about it`),
    P(`This wasn't simply an idea we wrote about.`),
    P(`In February 2024, Apple &amp; Bears published an article under my co-founder Kay Butt's name titled ${A(L.ab2024, "<em>Revolutionizing Retail: APPLE &amp; BEARS Introduce Human Avatars for a Sustainable Shopping Experience</em>")}.`),
    P(`At that stage, the idea was deliberately human. The concept envisaged real people working remotely through avatars inside a virtual Apple &amp; Bears store, bringing human interaction into a three-dimensional digital environment.`),
    P(`But behind that article lay a much more ambitious project.`),
    P(`In 2024, alongside Apple &amp; Bears, I began developing a concept called INTELIA.`),
    P(`The ambition was to create immersive three-dimensional environments in which businesses could operate virtual stores and customers could interact with representatives through avatars.`),
    P(`We began mapping what would actually be required to build it.`),
    P(`We explored the underlying e-commerce platforms, user interface, real-time communication, artificial intelligence and the use of NVIDIA technologies, including Omniverse, for the three-dimensional environment.`),
    P(`We looked at how commerce could sit behind the experience. We considered how the customer would communicate with the representative. We explored the technology needed to connect the different elements.`),
    P(`We even reached the stage of visualising where a human avatar might stand inside the virtual-store interface.`),
    inline,
    P(`Then we stopped.`),
    P(`Not because I stopped believing in the idea.`),
    P(`The economics stopped us.`),
    P(`Building what we envisaged properly required significant development resources and capital. We were confronting the reality that the underlying technologies we needed were themselves substantial engineering projects.`),
    P(`For us, the resources required to pursue INTELIA at the level I wanted simply became too great.`),
    P(`So we shelved it.`),
    P(`Looking back from 2026, however, I find that decision fascinating.`),
    P(`The idea didn't disappear.`),
    P(`The technology caught up with it.`),
    P(`What required us to contemplate building or connecting substantial parts of the infrastructure ourselves is increasingly becoming available as technology upon which businesses can build.`),
    P(`NVIDIA today provides ${A(L.nvidia, "technologies for digital humans and AI-powered retail experiences")}. Its current retail developer resources include NVIDIA ACE for digital humans and a Retail Shopping Assistant Blueprint using retrieval-augmented generation to connect conversational AI with company data. NVIDIA's earlier Tokkio work also demonstrated autonomous customer-service avatars.`),
    P(`In 2024, we were trying to work out how to put a person behind an avatar.`),
    P(`Today, I find myself asking whether the person necessarily has to be there at all.`),
    H(`Can the virtual store become better than the physical store?`),
    P(`When we were designing the architecture for INTELIA, we weren't simply trying to reproduce a website in three dimensions.`),
    P(`We were asking a bigger question.`),
    P(`Could a virtual store eventually offer an experience as good as, or even better than, walking into a physical shop?`),
    P(`I increasingly believe the answer is yes.`),
    P(`Consider something as simple as attention.`),
    P(`Walk into a busy physical store and even the best salesperson has limitations.`),
    P(`If several customers require assistance simultaneously, that person's attention has to be divided. Somebody waits. Somebody gets less time. Somebody may feel rushed because another customer is waiting.`),
    P(`An intelligent virtual store could operate very differently.`),
    P(`Imagine entering Apple &amp; Bears and Lucy greets you.`),
    P(`For that visit, Lucy is yours.`),
    P(`She isn't watching another customer walk through the door. She isn't trying to serve three people at once. She doesn't need to tell you that she will be back in a moment.`),
    P(`You can spend two minutes with her or twenty.`),
    P(`You can ask one question or twenty.`),
    P(`You can browse quietly and call her back when you need her.`),
    P(`There is no reason for you to feel rushed.`),
    P(`Meanwhile, there could potentially be 300 other customers inside the Apple &amp; Bears virtual environment, each having an individual interaction with their own instance of Lucy.`),
    P(`That begins to change the economics, and potentially the experience, of customer service.`),
    P(`A physical store might have five members of staff available to look after customers. A virtual environment could potentially allow far more customers to receive individual assistance simultaneously.`),
    P(`The arrival of the next customer doesn't necessarily mean you have to surrender the salesperson's attention.`),
    P(`And perhaps you don't want Lucy.`),
    P(`Perhaps you prefer Tom: knowledgeable, handsome, charming and equally familiar with Apple &amp; Bears.`),
    P(`You choose.`),
    P(`Perhaps another customer wants somebody who simply answers questions and then leaves them to browse.`),
    P(`Another may want to understand ingredients.`),
    P(`Someone else might want to hear the story behind a fragrance, learn about the history of Apple &amp; Bears or compare several products before making a decision.`),
    P(`The representative could adapt to the customer rather than requiring every customer to adapt to the salesperson.`),
    P(`That is where I think virtual retail becomes particularly interesting.`),
    P(`It has the potential to make personal service scalable.`),
    P(`The environment itself could potentially adapt too.`),
    P(`Products relevant to the customer could be brought forward. Questions could be answered immediately. The history behind a fragrance or formulation could become part of the environment rather than a paragraph printed beside a bottle.`),
    P(`And the customer could explore at their own pace, with as much, or as little, assistance as they wanted.`),
    P(`There are things a physical Apple &amp; Bears shop would still do beautifully.`),
    P(`You can pick up a bottle.`),
    P(`You can feel it in your hand.`),
    P(`You can experience a fragrance directly.`),
    P(`You can have an unexpected conversation with another human being.`),
    P(`Physical presence has qualities technology cannot currently reproduce, and there would be little value in pretending otherwise.`),
    P(`But virtual retail has qualities the physical world cannot easily reproduce either.`),
    P(`It doesn't have to choose between being in London, New York, Johannesburg or Tokyo.`),
    P(`The customer doesn't necessarily have to arrive during conventional opening hours.`),
    P(`And the amount of attention one customer receives doesn't necessarily have to diminish because another customer has arrived.`),
    P(`The doorway can potentially be everywhere.`),
    H(`When everybody has a Lucy`),
    P(`But there is a problem.`),
    P(`If Apple &amp; Bears can have Lucy, or Tom, eventually everybody can have them.`),
    P(`If we can access increasingly sophisticated AI marketing, so can our competitors.`),
    P(`If we can automate elements of manufacturing, logistics, customer service and administration, others will have access to similar capabilities.`),
    P(`The extraordinary eventually becomes ordinary.`),
    P(`And that leads me to what I think is one of the most important business questions of the AI era:`),
    P(`When everybody has access to extraordinary technology, what remains uniquely yours?`),
    P(`My answer is the brand.`),
    H(`Technology is not the brand`),
    P(`A shop isn't the brand.`),
    P(`A website isn't the brand.`),
    P(`Instagram isn't the brand.`),
    P(`An AI assistant isn't the brand.`),
    P(`They are channels through which somebody encounters it.`),
    P(`A brand exists somewhere deeper.`),
    P(`It is intellectual property.`),
    P(`It is identity.`),
    P(`It is reputation.`),
    P(`It is product philosophy, accumulated experience, history, relationships and thousands of decisions that determine what a business stands for.`),
    P(`A competitor may eventually have access to the same class of AI that Apple &amp; Bears uses. It may have comparable automation, virtual environments and robotic systems.`),
    P(`But it cannot download our history.`),
    P(`It cannot retrospectively create the decisions that built Apple &amp; Bears.`),
    P(`It cannot simply acquire our relationships, experiences or the intellectual property attached to our name.`),
    P(`Technology can reproduce capability. It cannot automatically reproduce provenance.`),
    P(`And I think that distinction will become increasingly important.`),
    H(`What happens to the human?`),
    P(`None of this means I believe human beings cease to matter.`),
    P(`I believe the opposite may prove true.`),
    P(`If machines increasingly perform repeatable tasks surrounding a business, human judgement becomes even more important in deciding what those machines are being asked to represent.`),
    P(`Somebody must decide what the company stands for.`),
    P(`Somebody must establish the boundaries.`),
    P(`Somebody must decide what should be made, how customers should be treated and what happens when commercial opportunity conflicts with the principles of the business.`),
    P(`For now, that responsibility ultimately rests with people.`),
    P(`Thirty or fifty years from now?`),
    P(`Who knows.`),
    P(`Could an AI one day become the chief executive of a company?`),
    P(`I no longer think that is a ridiculous question.`),
    H(`Who owns the idea?`),
    P(`That takes us somewhere even more interesting.`),
    P(`If one day an AI can manage operations, analyse markets, communicate with customers, supervise automated manufacturing and make increasingly sophisticated commercial decisions, who controls the company?`),
    P(`Who owns its intellectual property?`),
    P(`Who determines its purpose?`),
    P(`Who carries responsibility?`),
    P(`I don't pretend to know what corporate ownership will look like several decades from now.`),
    P(`But I do know what matters to me today.`),
    P(`Apple &amp; Bears is an idea that we own and continue to shape.`),
    P(`Technology can help us express it.`),
    P(`It can help people discover it.`),
    P(`It may eventually represent it to customers in ways that would have seemed impossible when we started.`),
    P(`But the technology is not Apple &amp; Bears.`),
    H(`The store I never built`),
    P(`Perhaps one day we will still open that Apple &amp; Bears shop I once imagined.`),
    P(`I wouldn't rule it out.`),
    P(`But I no longer regard bricks and mortar as the destination that proves a brand has arrived.`),
    P(`The Apple &amp; Bears store of the future could be something I could never have pictured when we started the company.`),
    P(`Perhaps you will walk into it without leaving your house.`),
    P(`Perhaps Lucy, or Tom, will welcome you.`),
    P(`Perhaps one day a physical robotic representative will do the same thing.`),
    P(`What matters is that whichever technology sits between Apple &amp; Bears and the person experiencing it, the identity on the other side remains recognisably ours.`),
    P(`AI may change how businesses manufacture, sell, communicate and serve.`),
    P(`It may eventually change who, or what, performs many of the functions we currently associate with running a company.`),
    P(`But when extraordinary technology becomes available to everybody, simply possessing that technology will no longer be extraordinary.`),
    P(`What remains will be the idea behind it.`),
    P(`The history.`),
    P(`The reputation.`),
    P(`The intellectual property.`),
    P(`The decisions.`),
    P(`The relationships.`),
    P(`The reason the business exists in the first place.`),
    P(`Technology will continue to change.`),
    P(`The question is what survives when it does.`),
    P(`And that brings me back to the question I think businesses should already be asking themselves:`),
    P(`When AI changes everything, who will still be standing?`),
    H(`What this means for your business`),
    `<div class="takeaways"><p><em>Editor's notes.</em></p><ul>
      <li><strong>Assume your competitors get the same tools.</strong> Any AI capability you can buy this year, they can buy next year. Budget for it, but don't build the business case on it being a differentiator for long.</li>
      <li><strong>Write down what can't be copied.</strong> Trade marks, formulations, supplier relationships, the story of how the business started. If it isn't documented and protected, it isn't an asset.</li>
      <li><strong>Cost the shop honestly against the alternatives.</strong> Rent, rates, fit-out and staff for one location against reaching every location from a screen. The shop may still win, but it should have to.</li>
    </ul></div>`,
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

// Both images straight from his email, never touching disk.
const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const H_ = { Authorization: `Bearer ${rt}` };
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}?format=full`, { headers: H_ }).then((r) => r.json());
const atts = {}; (function walk(p) { if (p.filename && p.body?.attachmentId) atts[p.filename] = p.body.attachmentId; for (const c of p.parts || []) walk(c); })(msg.payload);
const grab = async (name) => { const id = atts[name]; if (!id) throw new Error(`no attachment named ${name}; have: ${Object.keys(atts).join(" | ")}`); return Buffer.from((await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}/attachments/${id}`, { headers: H_ }).then((r) => r.json())).data, "base64url"); };
const heroRaw = await grab(HERO_FILE);
const inlineRaw = await grab(INLINE_FILE);
const hm = await sharp(heroRaw).metadata();
const th = Math.round((hm.width * 9) / 16);
const extra = Math.max(0, th - hm.height);
const hero = await sharp(heroRaw).resize(hm.width, Math.max(hm.height, th), { fit: "cover" }).blur(28).composite([{ input: heroRaw, top: Math.floor(extra / 2), left: 0 }]).jpeg({ quality: 88 }).toBuffer();
const im = await sharp(inlineRaw).metadata();
const inline = await sharp(inlineRaw).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
console.log(`hero ${hm.width}x${hm.height} -> ${hm.width}x${hm.height + extra}, ${(hero.length / 1024).toFixed(0)} KB; inline ${im.width}x${im.height} -> ${(inline.length / 1024).toFixed(0)} KB`);
if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`)).filter((r) => /who will still be standing/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const headshotUrl = wp(`post get ${HEADSHOT_ID} --field=guid`);
if (!/dean-butt/.test(headshotUrl)) throw new Error(`attachment ${HEADSHOT_ID} is not the headshot`);
const categoryId = wp(`term list category --name=${sq(CATEGORY_NAME)} --field=term_id`).split(/\s+/)[0];
if (!/^\d+$/.test(categoryId)) throw new Error(`category "${CATEGORY_NAME}" not found: ${categoryId}`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`dean-ai-hero-${stamp}.jpg`, hero);
put(`dean-ai-intelia-${stamp}.jpg`, inline);
const heroId = wp(`media import /tmp/dean-ai-hero-${stamp}.jpg --title=${sq("Apple & Bears concept store")} --alt=${sq("Apple & Bears concept store: how the brand could translate into a future physical retail space. Image: Apple & Bears")} --porcelain`);
const inlineId = wp(`media import /tmp/dean-ai-intelia-${stamp}.jpg --title=${sq("INTELIA virtual store development concept, 2024")} --alt=${sq("INTELIA virtual store development concept from 2024. Image: Apple & Bears")} --porcelain`);
const inlineUrl = wp(`post get ${inlineId} --field=guid`);
put(`dean-ai-body-${stamp}.html`, Buffer.from(buildBody({ headshotUrl, inlineId, inlineUrl }), "utf8"));
const postId = wp(`post create /tmp/dean-ai-body-${stamp}.html --post_type=post --post_status=draft --post_category=${categoryId} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/dean-ai-hero-${stamp}.jpg /tmp/dean-ai-intelia-${stamp}.jpg /tmp/dean-ai-body-${stamp}.html`);
console.log(`DRAFT ${postId}: "${TITLE}"  hero ${heroId}  inline ${inlineId}  tags: ${wp(`post term list ${postId} post_tag --field=slug`)}  cat: ${wp(`post term list ${postId} category --field=name`)}`);
