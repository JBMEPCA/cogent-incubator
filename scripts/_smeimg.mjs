import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { chooseSmartImage } from "../lib/images.js";
import { uploadMedia, updatePost, fetchPost } from "../lib/wordpress.js";

const prisma = new PrismaClient();
const site = await prisma.site.findUnique({ where: { slug: "smart-sme" } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const WP_ID = 1498;
const TITLE = "Bank Rate held at 3.75%: what it means for small businesses";

const post = await fetchPost(creds.wordpress, WP_ID);
console.log("post:", post.id, "featured_media:", post.featured_media);

const attempt = Number(process.argv[2] || 0);
const r = await chooseSmartImage(site, { title: TITLE, category: "Finance", attempt });
console.log("reason:", r.reason || "picked");
for (const t of r.tried || []) console.log("  tried:", JSON.stringify(t).slice(0, 200));
if (!r.image) { await prisma.$disconnect(); process.exit(2); }
console.log("PICKED:", JSON.stringify(r.image).slice(0, 600));

if (process.argv.includes("--apply")) {
  const media = await uploadMedia(creds.wordpress, {
    imageUrl: r.image.url,
    alt: r.image.alt,
    filename: "bank-rate-held-at-3-75-percent",
  });
  await updatePost(creds.wordpress, WP_ID, { featured_media: media.id });
  console.log("APPLIED featured_media:", media.id);
}
await prisma.$disconnect();
