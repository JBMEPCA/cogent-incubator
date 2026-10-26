// Put the real Carrington photo on post 396 and clear the Yoast row, because
// a swapped featured image leaves wp_yoast_indexable holding the OLD og:image
// and every share keeps showing the stock building.
import fs from "node:fs";
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { uploadMedia, updatePost } from "../lib/wordpress.js";

const POST = 396;
const IMG = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/carrington/carrington-lincolnwood.jpg";

const site = await prisma.site.findUnique({ where: { slug: "senior-lifestyle-business" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;

const media = await uploadMedia(wp, {
  data: fs.readFileSync(IMG),
  contentType: "image/jpeg",
  filename: "the-carrington-at-lincolnwood",
  alt: "The Carrington at Lincolnwood at dusk, with the Chicago skyline behind the community",
  caption: "The Carrington at Lincolnwood. Photograph supplied by Senior Resource Group.",
});
console.log(`new media  ${media.id}`);

await updatePost(wp, POST, { featured_media: media.id });
console.log(`post ${POST} featured_media -> ${media.id}`);

const a = await db.article.findFirst({ where: { wpPostId: POST } });
if (a) {
  await db.article.update({
    where: { id: a.id },
    data: {
      imageSource: "supplied:Senior Resource Group",
      imageCredit: "Senior Resource Group",
      imageUrl: null,
      imageAlt: "The Carrington at Lincolnwood at dusk, with the Chicago skyline behind the community",
    },
  });
  console.log(`article ${a.id} imageSource -> supplied:Senior Resource Group (was pexels:72150865)`);
}
await prisma.$disconnect();
