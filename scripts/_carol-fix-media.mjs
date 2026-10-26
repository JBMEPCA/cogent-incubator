// uploadMedia() appends the extension itself, so passing "name.jpg" produced
// carol-hatcher-the-shires.jpg.jpg. Re-upload under the right name, repoint
// the draft, bin the duplicate, and record the headshot on the interview row
// (which the first run stored as undefined).
import fs from "node:fs";
import { prisma, forSite } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";
import { uploadMedia, updatePost } from "../lib/wordpress.js";

const POST = 423;
const OLD_MEDIA = 422;
const IMG = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad/shires-media/carol-hatcher-featured.jpg";

const site = await prisma.site.findUnique({ where: { slug: "senior-lifestyle-business" } });
const db = forSite(site.id);
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;

const media = await uploadMedia(wp, {
  data: fs.readFileSync(IMG),
  contentType: "image/jpeg",
  filename: "carol-hatcher-the-shires",
  alt: "Carol Hatcher, general manager of The Shires retirement village in Moseley",
  caption: "Carol Hatcher, general manager at The Shires. Photograph supplied by The Shires.",
});
console.log(`new media  ${media.id}  ${media.source_url || media.guid?.rendered || "(url not returned)"}`);

await updatePost(wp, POST, { featured_media: media.id });
console.log(`post ${POST} featured_media -> ${media.id}`);

const base = `${wp.url.replace(/\/$/, "")}/wp-json/wp/v2`;
const auth = Buffer.from(`${wp.username}:${wp.appPassword || wp.password}`).toString("base64");
const del = await fetch(`${base}/media/${OLD_MEDIA}?force=true`, {
  method: "DELETE",
  headers: { authorization: `Basic ${auth}`, "user-agent": "CogentBot/1.0" },
});
console.log(`old media ${OLD_MEDIA} deleted: ${del.ok}`);

const url = media.source_url || media.guid?.rendered || null;
const t = await db.interviewTarget.findFirst({ where: { personName: "Carol Hatcher" } });
if (t && url) {
  await db.interviewTarget.update({ where: { id: t.id }, data: { headshotUrl: url, articleId: t.articleId } });
  console.log(`headshotUrl recorded: ${url}`);
}
await prisma.$disconnect();
