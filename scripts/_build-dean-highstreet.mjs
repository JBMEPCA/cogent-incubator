/**
 * Dean Butt, Apple & Bears: "Does the UK high street need saving?" Guest
 * article sent 27 Sep 2026 (thread 1a0e39e3dda3a774). DRAFT over SSH.
 *
 * Text is his from the .docx, sub-edited to house style: sentence-case
 * subheads, em dashes out, links kept with ?utm_source=chatgpt.com stripped.
 * Hero is the title card he sent (PNG, ~2:1, converted to JPEG and padded to
 * 16:9). Headshot is attachment 1022.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_build-dean-highstreet.mjs [--dry]
 */
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { outreachSender } from "../lib/gmail.js";
import { getGoogleAccessToken } from "../lib/google.js";

const DRY = process.argv.includes("--dry");
const MSG_ID = "1a0e39e3dda3a774";
const HERO_FILE = "Does The UK high Street Need Saving.png";
const HEADSHOT_ID = 1022;
const CATEGORY_ID = 6; // Operations
const TAG = "guest-perspective";
const L = {
  ab: "https://appleandbears.com/",
  ons: "https://www.ons.gov.uk/businessindustryandtrade/retailindustry/timeseries/j4mc",
  gov: "https://www.gov.uk/guidance/ensuring-the-vitality-of-town-centres",
};

const TITLE = "Does the UK high street need saving?";
const META = "After 50 years watching British retail change, Dean Butt argues the town centre needs saving, not the high street. Footfall must now create the retail.";
const EXCERPT = META;
const KEYPHRASE = "does the high street need saving";
if (/[—–]/.test(TITLE + META)) throw new Error("em or en dash in title/meta");
if (META.length > 155) throw new Error(`meta is ${META.length} chars`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;
const A = (href, text) => `<a href="${href}">${text}</a>`;
function buildBody({ headshotUrl }) {
  return [
    `<p class="standfirst"><em>After 50 years of watching British retail change, perhaps we are trying to save the wrong thing. The co-founder of Apple &amp; Bears on why the answer to empty shops is not more shops.</em></p>`,
    P(`<strong>By Dean Butt, Co-founder, Apple &amp; Bears</strong>`),
    P(`I started work when I was 16. I am 66 now, which means I have spent half a century watching the British high street transform.`),
    P(`The high street I remember as a young man operated to a rhythm that would seem unimaginable today. Shops closed for half a day during the week, Saturdays could be shorter, and Sundays were quiet. The high street wasn't available whenever we wanted it. We fitted our lives around it.`),
    P(`Then Britain accelerated.`),
    P(`Through the 1980s and 1990s, opening hours expanded, Sunday trading rules were liberalised, consumerism grew, and town centres became bustling retail destinations. Anchors like Woolworths, Debenhams, WHSmith and Boots brought crowds into town. Once people arrived to shop, they bought a coffee, visited the bank, had lunch or simply browsed.`),
    P(`Retail created the footfall, and every surrounding business benefited.`),
    P(`Walk along those same streets today and the landscape is fundamentally different. Interspersed between vacant units are cafés, takeaways, barbers, vape shops, betting shops and other services.`),
    P(`While this is widely lamented as the decline of the high street, 50 years of observation makes me ask a different question:`),
    P(`Does the traditional retail high street actually need saving?`),
    H(`Put yourself in the shopkeeper's shoes`),
    P(`We constantly hear calls for more independent boutiques, artisan bakeries and local fashion stores.`),
    P(`I would love to see them too.`),
    P(`But put yourself in the shoes of an entrepreneur being asked to open one.`),
    P(`Why would you take that risk?`),
    P(`Before making a single sale, you may have to take on a lease, fit out the store, hire staff, buy inventory, pay utility bills, insure the business and potentially face business rates.`),
    P(`Then you have to hope enough people pass your window to make the numbers work.`),
    P(`Online, that same business can potentially reach a national audience without depending upon one physical location.`),
    P(`The consumer experience has evolved just as dramatically.`),
    P(`Take fashion. The physical changing room used to be one of the store's great advantages. Today, a customer can order several sizes online, try them on at home with their own wardrobe, shoes and mirror, and return what doesn't fit.`),
    P(`The high street isn't just competing with other stores anymore.`),
    P(`It is competing with convenience.`),
    H(`The brand owner's paradox`),
    P(`There is an uncomfortable truth here that I recognise in my own work.`),
    P(`I run ${A(L.ab, "Apple &amp; Bears")}, a British luxury body-care brand whose products are made in England.`),
    P(`In a previous era, scaling a consumer brand might eventually have meant opening a network of physical shops.`),
    P(`Today, technology allows us to build direct relationships with customers without needing an Apple &amp; Bears store in every town.`),
    P(`This isn't an attack on physical retail. It is simply the commercial reality of modern commerce.`),
    P(`If someone asked me tomorrow whether I would invest in a physical Apple &amp; Bears store, my answer wouldn't depend on nostalgia.`),
    P(`It would depend on the environment.`),
    P(`I would need footfall, easy visitor access and a vibrant surrounding mix of businesses that made the location a genuine destination.`),
    P(`Without those conditions, opening a store isn't a strategy. It's an act of faith.`),
    P(`And the digital transition is still developing. As virtual stores and immersive digital experiences become more sophisticated, brands will increasingly be able to give customers ways of exploring products without establishing physical stores in every location.`),
    P(`For most of my working life, the challenge was getting the customer into the shop.`),
    P(`Soon the question may be why the shop needs to exist at all.`),
    P(`That doesn't mean physical retail disappears.`),
    P(`It means its purpose changes.`),
    H(`The high street was a distribution system`),
    P(`The shift is clearly visible in the data.`),
    P(`${A(L.ons, "Office for National Statistics retail data")} show that online sales accounted for just 3.4% of total UK retail sales in 2007.`),
    P(`By 2019, that figure had reached 19.2%. In 2025 it was 27.5%, and by the second quarter of 2026 it stood at 28.0%.`),
    P(`Online retail is no longer an alternative shopping method sitting at the edge of British commerce.`),
    P(`It is part of the infrastructure of modern retail.`),
    P(`For generations, the high street performed a vital economic task: it was a physical distribution system.`),
    P(`If you wanted clothes, books, records, toiletries or homeware, you travelled to where those products were physically concentrated.`),
    P(`E-commerce removed much of that geographical constraint.`),
    P(`Recognising this changes the question.`),
    P(`We don't necessarily need to replace every closed store with another store because Britain may simply not require the volume of physical retail space it once did.`),
    P(`The town centre isn't redundant.`),
    P(`But its historical purpose is being fundamentally reshaped.`),
    H(`Reversing the model: footfall first`),
    P(`For decades, the town-centre formula was relatively simple:`),
    P(`<strong>Retail anchors</strong> generated footfall, which supported cafés and services.`),
    P(`Perhaps the next 50 years need to work in reverse:`),
    P(`<strong>Urban residents</strong> create daily demand, which sustains selected retail.`),
    P(`Instead of trying to lure enough retailers back to fill every empty unit, we should look at putting people back into town centres.`),
    P(`Genuinely redundant commercial buildings could, where appropriate, become good-quality town-centre homes.`),
    P(`A permanent resident population naturally creates demand for everyday needs that cannot simply be delivered in a cardboard box: bakeries, restaurants, pharmacies, dentists, healthcare, gyms, childcare, hairdressers and social spaces.`),
    P(`When people live, work and socialise in town centres, footfall becomes part of everyday life.`),
    P(`And once that footfall exists, a smaller, more distinctive tier of independent retail, specialist food, boutique fashion, local crafts, beauty and homeware, has a stronger commercial reason to be there.`),
    P(`This approach is not completely removed from current planning thinking. ${A(L.gov, "Government planning guidance on town centres")} already recognises the contribution that residential, employment, commercial, leisure, healthcare and educational uses can make to town-centre vitality. It specifically notes that residential development can play an important role.`),
    P(`Perhaps we don't need 100 shops simply because there used to be 100 shops.`),
    P(`Perhaps we need fewer shops, but better ones.`),
    H(`Four steps to a functioning town centre`),
    P(`If we want entrepreneurs to take physical retail seriously again, the economics and environment have to make sense.`),
    P(`<strong>First, create a five-year business-rates runway.</strong> Genuinely new independent businesses taking long-term vacant premises in designated regeneration areas could receive 100% business-rates relief for their first two years, tapering over years three to five, with safeguards to prevent abuse.`),
    P(`<strong>Second, reduce visitor friction.</strong> Where practical, offer two hours of free parking in council-controlled town-centre spaces. And make parking straightforward rather than requiring another app simply to leave a car for an hour.`),
    P(`<strong>Third, invest in the public realm.</strong> Clean streets, good lighting, greenery, seating, safety, markets and outdoor dining aren't cosmetic extras. They influence whether somebody spends ten minutes in town or an entire afternoon.`),
    P(`<strong>Finally, abandon the assumption that every empty shop must remain a shop.</strong> Where sustainable retail demand no longer exists, allow buildings to evolve towards housing, healthcare, hospitality, leisure, workplaces and other uses that bring people back.`),
    P(`The objective should not be maximum retail occupancy.`),
    P(`It should be a functioning town centre.`),
    H(`What the internet cannot deliver`),
    P(`This is where I believe physical retail still has an enormous opportunity.`),
    P(`The internet can sell you a shirt.`),
    P(`It can deliver toiletries.`),
    P(`A virtual store may increasingly allow you to explore brands without leaving home.`),
    P(`But none of those things can give you an afternoon in a real place.`),
    P(`Imagine a town centre with interesting independent shops, a good bakery, specialist food, cafés, restaurants, markets and attractive public spaces.`),
    P(`You meet somebody for lunch. You discover a shop you didn't know existed. You sit outside with a coffee. You browse a market. You buy something you weren't planning to buy.`),
    P(`You didn't travel there simply because you needed a shirt.`),
    P(`You went because you wanted to be there.`),
    P(`That is something the internet cannot put in a cardboard box.`),
    P(`Perhaps that is the future competitive advantage of the physical high street:`),
    P(`Experience, not distribution.`),
    H(`So, does the UK high street need saving?`),
    P(`After 50 years of watching it change, I think perhaps we are trying to save the wrong thing.`),
    P(`We don't need to save every shopfront. We don't need to recreate Woolworths. We don't need every former department store to find another department store.`),
    P(`And we certainly don't need to recreate the high street I knew when I was 16.`),
    P(`What we should save is the town centre.`),
    P(`Online shopping isn't going away, nor should it.`),
    P(`We cannot embrace the convenience of buying online while simultaneously expecting the physical landscape around us to remain unchanged. Businesses like mine are part of that evolution. Consumers are too.`),
    P(`The answer isn't to fight it.`),
    P(`It is to decide what comes next.`),
    P(`For 50 years, retail created the footfall.`),
    P(`Perhaps now the footfall has to create the retail.`),
    P(`The question isn't how we persuade people to shop as they did half a century ago.`),
    P(`It is what kind of town centre makes sense for the way we live today, and the way we will live tomorrow.`),
    P(`Perhaps the traditional high street doesn't need saving.`),
    P(`Perhaps it needs a new purpose.`),
    P(`And the question for the next 50 years isn't how many shops we can bring back.`),
    P(`It is what kind of town centre we want to leave behind.`),
    H(`What this means for your business`),
    `<div class="takeaways"><p><em>Editor's notes.</em></p><ul>
      <li><strong>Check what rates relief already exists before you sign a lease.</strong> Retail, hospitality and leisure relief and small business rate relief are set nationally, and many councils run discretionary schemes for long-vacant units. Ask the council's business rates team, not the landlord.</li>
      <li><strong>Judge a location on who lives there, not who used to shop there.</strong> Dean's argument is that residents create the footfall now. A unit next to new town-centre housing is a different proposition from one next to an empty department store.</li>
      <li><strong>If the shop can't offer an experience, it's competing with your own website.</strong> A physical space has to do something the parcel can't: tasting, trying, advice, an afternoon out. Otherwise the rent is paying for distribution the internet does cheaper.</li>
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

const rt = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.readonly"], sender.email);
const H_ = { Authorization: `Bearer ${rt}` };
const msg = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}?format=full`, { headers: H_ }).then((r) => r.json());
let att; (function walk(p) { if (p.filename === HERO_FILE && p.body?.attachmentId) att = p; for (const c of p.parts || []) walk(c); })(msg.payload);
if (!att) throw new Error(`no attachment named ${HERO_FILE}`);
const raw = Buffer.from((await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${MSG_ID}/attachments/${att.body.attachmentId}`, { headers: H_ }).then((r) => r.json())).data, "base64url");
// Normalise to a flat JPEG first, then either extend a wide image to 16:9
// with a blurred copy behind it, or crop a tall one with the subject kept.
const flat = await sharp(raw).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
const m = await sharp(flat).metadata();
const th = Math.round((m.width * 9) / 16);
let hero;
if (m.height < th) {
  // Materialise the blurred base first; compositing inside the same pipeline
  // as the resize compares against the pre-resize dimensions and fails.
  const base = await sharp(flat).resize(m.width, th, { fit: "cover" }).blur(28).toBuffer();
  const bm = await sharp(base).metadata();
  console.log(`base ${bm.width}x${bm.height}, overlay ${m.width}x${m.height}`);
  // sharp validates composite inputs against the pipeline's OUTPUT size, so a
  // downscale in the same chain rejects an overlay wider than 1600. Two steps.
  const composed = await sharp(base).composite([{ input: flat, top: Math.floor((th - m.height) / 2), left: 0 }]).toBuffer();
  hero = await sharp(composed).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
} else {
  hero = await sharp(flat).resize(1600, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
}
console.log(`hero ${m.width}x${m.height} -> 16:9 jpeg (${m.height < th ? "extended" : "cropped"}), ${(hero.length / 1024).toFixed(0)} KB`);
if (DRY) { console.log(`DRY: "${TITLE}" (${TITLE.length}) meta ${META.length}`); process.exit(0); }

const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
const ssh = (cmd, input) => execFileSync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd], { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
const sq = (x) => `'${String(x).replace(/'/g, `'"'"'`)}'`;
const wp = (args, input) => ssh(`cd ${sq(docroot)} && wp ${args}`, input);

const existing = JSON.parse(wp(`post list --post_type=post --post_status=draft,pending,publish,future --posts_per_page=300 --fields=ID,post_title --format=json`)).filter((r) => /high street need saving/i.test(r.post_title));
if (existing.length) throw new Error(`already exists: ${existing.map((r) => `${r.ID} ${r.post_title}`).join(" | ")}`);
const headshotUrl = wp(`post get ${HEADSHOT_ID} --field=guid`);
if (!/dean-butt/.test(headshotUrl)) throw new Error(`attachment ${HEADSHOT_ID} is not the headshot`);

const stamp = Date.now();
const put = (name, buf) => ssh(`base64 -d > /tmp/${name}`, buf.toString("base64"));
put(`dean-highstreet-hero-${stamp}.jpg`, hero);
const heroId = wp(`media import /tmp/dean-highstreet-hero-${stamp}.jpg --title=${sq("Does the UK high street need saving?")} --alt=${sq("A run-down British high street with shuttered units, a betting shop, a charity shop and a vape shop. Image: Apple & Bears")} --porcelain`);
put(`dean-highstreet-body-${stamp}.html`, Buffer.from(buildBody({ headshotUrl }), "utf8"));
const postId = wp(`post create /tmp/dean-highstreet-body-${stamp}.html --post_type=post --post_status=draft --post_category=${CATEGORY_ID} --post_title=${sq(TITLE)} --post_excerpt=${sq(EXCERPT)} --porcelain`);
wp(`post meta update ${postId} _thumbnail_id ${heroId}`);
wp(`post meta update ${postId} _yoast_wpseo_title ${sq(TITLE)}`);
wp(`post meta update ${postId} _yoast_wpseo_metadesc ${sq(META)}`);
wp(`post meta update ${postId} _yoast_wpseo_focuskw ${sq(KEYPHRASE)}`);
wp(`post term set ${postId} post_tag ${TAG}`);
ssh(`rm -f /tmp/dean-highstreet-hero-${stamp}.jpg /tmp/dean-highstreet-body-${stamp}.html`);
console.log(`DRAFT ${postId}: "${TITLE}"  hero ${heroId}  tags: ${wp(`post term list ${postId} post_tag --field=slug`)}  cat: ${wp(`post term list ${postId} category --field=name`)}`);
