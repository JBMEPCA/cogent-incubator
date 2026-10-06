/**
 * One-off: build the Hugs & Co. / Bon Orbit news piece as a DRAFT on Smart SME.
 *
 * Photos came as Google Drive links in Benjie's reply, pulled to the scratchpad
 * at 11 to 13 MB each, so they are resized here before upload.
 *
 * Run: PHOTO_DIR=<dir> node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_build-hugs-article.mjs
 * Set POST_ID once the draft exists so re-runs revise it instead of piling up.
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { decryptJson } from "../lib/crypto.js";
import { uploadMedia, publishToWordPress, resolveCategory, updatePost } from "../lib/wordpress.js";
import sharp from "sharp";

const POST_ID = Number(process.env.POST_ID || 0);
const DIR = process.env.PHOTO_DIR;

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true, name: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const wp = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).wordpress;
await prisma.$disconnect();

async function prep(name) {
  const buf = await readFile(`${DIR}/${name}`);
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const m = await sharp(out).metadata();
  console.log(`${name}: ${buf.length} -> ${out.length} bytes, ${m.width}x${m.height}`);
  return out;
}

const hero = POST_ID ? { id: 1024, url: "https://smartsme.co.uk/wp-content/uploads/2026/09/hugs-and-co-bon-orbit-tyre-sole-shoes.jpg" } : await uploadMedia(wp, {
  data: await prep("DSCF1381.JPG"),
  contentType: "image/jpeg",
  filename: "hugs-and-co-bon-orbit-tyre-sole-shoes",
  alt: "Hugs & Co. loafers and espadrilles with upcycled tyre-tread soles on display at Bon Orbit in Sweden",
  caption:
    "Hugs &amp; Co. loafers and espadrilles on display at Bon Orbit, soles up to show the tyre tread. Image: Hugs &amp; Co.",
});
const inline = await uploadMedia(wp, {
  data: await prep("DSCF1379.JPG"),
  contentType: "image/jpeg",
  filename: "hugs-and-co-bon-orbit-sole-print",
  alt: "A large print of a Hugs & Co. tyre-tread sole above the brand's shoes at the Bon Orbit exhibition",
  caption:
    "The Bon Orbit display: a tyre-tread sole print above the pink suede espadrille and gold penny loafer. Image: Hugs &amp; Co.",
});
console.log(`hero media ${hero.id}  ${hero.url}`);
console.log(`inline media ${inline.id}  ${inline.url}`);

const P = (s) => `<p>${s}</p>`;
const H = (s) => `<h2>${s}</h2>`;

const body = [
  `<p class="standfirst"><em>A London footwear brand that stamps its soles out of scrap road tyres has been picked for a Scandinavian gallery devoted to exactly that material. It is a useful case for any small manufacturer trying to make a sustainability claim that stands up.</em></p>`,

  P(
    `Hugs &amp; Co., the luxury footwear brand founded in Richmond, London 14 years ago, has been selected to exhibit its upcycled tyre-sole collection at Bon Orbit, an exhibition and material science space in Sweden dedicated to products made from end-of-life road tyres.`
  ),
  P(
    `Bon Orbit is a joint project between Swedish Tyre Recycling and Norwegian Tyre Recycling. It curates products across architecture, interior design and fashion that put scrap tyre rubber to work, and Hugs &amp; Co. joins a small group of international brands on display. The collection is on show now.`
  ),

  H(`Soles stamped, not melted`),
  P(
    `More than a billion tyres reach the end of their working life every year worldwide, according to the company. They are engineered for durability and heat resistance, which is precisely what makes them hard to dispose of. Stockpiling and high-heat chemical recycling both carry heavy environmental costs.`
  ),
  P(
    `Hugs &amp; Co.'s answer is mechanical rather than chemical. Tread plates are stripped from the tyre and stamped into sole units using traditional shoemaking dies. Nothing is melted. The company estimates the process produces around a tenth of the CO2 of a conventional synthetic sole, and the finished sole keeps the grip, flexibility and wear resistance the rubber was designed for in the first place.`
  ),
  P(
    `"To have our upcycled footwear recognised by an institution at the forefront of circular material science like Bon Orbit is a monumental milestone for Hugs &amp; Co.," said Benjie Davis, co-founder. "It reinforces our core belief that luxury British style, functional performance and genuine environmental responsibility can walk hand in hand."`
  ),

  `<!-- wp:image {"id":${inline.id},"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="${inline.url}" alt="A large print of a Hugs &amp; Co. tyre-tread sole above the brand's shoes at the Bon Orbit exhibition" class="wp-image-${inline.id}" style="max-width:100%;height:auto" /><figcaption class="wp-element-caption">The Bon Orbit display: a tyre-tread sole print above the pink suede espadrille and gold penny loafer. Image: Hugs &amp; Co.</figcaption></figure>
<!-- /wp:image -->`,

  H(`What is on display`),
  P(`Three models from the range have been chosen for the gallery:`),
  `<ul>
    <li><strong>Women's penny loafer in gold leather.</strong> A metallic leather upper from a Leather Working Group gold-rated tannery on a heavy-duty upcycled tread.</li>
    <li><strong>Women's continental espadrille in pink suede.</strong> Italian soft suede with the traditional jute base swapped for a waterproof tyre-tread sole, so it lasts beyond one summer.</li>
    <li><strong>Men's continental espadrille in navy suede.</strong> European suede on the same industrial rubber sole, built for everyday wear rather than the beach.</li>
  </ul>`,
  P(
    `Every leather and suede in the collection comes from audited European tanneries certified by the Leather Working Group, so the sustainability story covers the whole shoe rather than just the part that touches the road.`
  ),

  H(`What this means for your business`),
  `<div class="takeaways"><ul>
    <li><strong>Third-party recognition beats your own claim.</strong> A specialist institution choosing to display your product is validation a press release cannot buy. If there is a body, gallery, award or trade scheme in your sector that vets what it shows, applying is worth the afternoon.</li>
    <li><strong>Lead with the process, not the adjective.</strong> "Mechanical low-energy upcycling, around a tenth of the CO2 of a synthetic sole" is a claim a journalist, a buyer or the CMA can check. "Eco-friendly" is not, and under the Green Claims Code it is the vague version that gets you into trouble.</li>
    <li><strong>Certify the parts nobody asks about.</strong> The tyre sole is the headline, but the LWG tanneries are what stop the story falling over when someone asks about the uppers.</li>
    <li><strong>Look for a waste stream.</strong> Scrap tyres are a disposal problem for someone else, which is what makes them an abundant input for a footwear brand. Most industries have an equivalent sitting in a skip nearby.</li>
  </ul></div>`,

  P(
    `The Hugs &amp; Co. collection is on display now at Bon Orbit in Sweden. More on the brand at <a href="https://www.hugsandco.com/">hugsandco.com</a>, and on the exhibition at <a href="https://www.bonorbit.se/">bonorbit.se</a>.`
  ),
].join("\n\n");

const categoryId = await resolveCategory(wp, "News");
const TITLE = "London footwear brand Hugs & Co. selected for Sweden's tyre-upcycling gallery Bon Orbit";
const META =
  "Hugs & Co., the London footwear brand with soles stamped from scrap tyres, is exhibiting at Sweden's Bon Orbit gallery. What small firms can take from it.";
console.log(`meta length: ${META.length}`);

if (POST_ID) {
  await updatePost(wp, POST_ID, {
    title: TITLE,
    content: body,
    featured_media: hero.id,
    categories: [categoryId],
    excerpt: META,
  });
  console.log(`\nDRAFT updated: id=${POST_ID}`);
} else {
  const post = await publishToWordPress(wp, {
    title: TITLE,
    body,
    status: "draft",
    featuredMediaId: hero.id,
    categoryId,
    keyphrase: "upcycled tyre footwear",
    metaDesc: META,
  });
  console.log(`\nDRAFT created: id=${post.id}`);
  console.log(`preview: ${post.link}`);
}
