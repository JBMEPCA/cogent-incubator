import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { uploadMedia, updatePost } from "../lib/wordpress.js";

const prisma = new PrismaClient();
const [slug, wpId, url, alt, filename] = process.argv.slice(2);
const site = await prisma.site.findUnique({ where: { slug } });
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const creds = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)]));
const media = await uploadMedia(creds.wordpress, { imageUrl: url, alt, filename });
console.log("uploaded media", media.id, media.source_url);
const res = await updatePost(creds.wordpress, Number(wpId), { featured_media: media.id });
console.log("post updated:", res?.id, "featured:", res?.featured_media);
await prisma.$disconnect();
