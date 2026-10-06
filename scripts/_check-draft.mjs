/** One-off: confirm what the draft actually holds. */
import { PrismaClient } from "@prisma/client";
import { decryptJson } from "../lib/crypto.js";
import { fetchPost } from "../lib/wordpress.js";

const prisma = new PrismaClient();
const sites = await prisma.site.findMany({ select: { id: true, slug: true } });
const site = sites.find((s) => /smart/i.test(s.slug));
const rows = await prisma.siteCredential.findMany({ where: { siteId: site.id } });
const wp = Object.fromEntries(rows.map((r) => [r.kind, decryptJson(r.payloadEnc)])).wordpress;
await prisma.$disconnect();

const post = await fetchPost(wp, 1017);
const html = post.content?.rendered ?? post.content?.raw ?? String(post.content || "");
console.log(`title:    ${post.title?.rendered ?? post.title}`);
console.log(`status:   ${post.status}`);
console.log(`featured: ${post.featured_media}`);
console.log(`words:    ~${html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length}`);
console.log(`editors-note present: ${/editors-note|Editor's note/i.test(html)}`);
console.log(`headshot in body:     ${(html.match(/dean-butt[^"]*/) || ["none"])[0]}`);
console.log(`\nfirst 600 chars:\n${html.slice(0, 600)}`);
