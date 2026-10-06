/**
 * Replace the header image on Dental Business News post 52 (ADG warns against
 * NHS contract rewrite).
 *
 * The published image was a photograph of ADG conference lanyards carrying
 * FMC's logo, and FMC publishes Dentistry.co.uk, the incumbent this title
 * competes with. A rival publisher's mark on our own article advertises them
 * and reads as though we lifted their picture, so it had to come off the same
 * day it was found.
 *
 * The picture desk could not replace it. Two runs of backfill-images --replace
 * rejected every candidate: nothing in stock illustrates "NHS contract policy",
 * and this title's dedupe set already holds all eight of its practice
 * interiors, so the shots that would have worked were excluded as used. The
 * frame below was chosen by hand from the same Pexels source the desk uses and
 * checked against the house style: a real practice front office, no patient,
 * no faces as the subject, no branding.
 *
 * Run: node --env-file=.env scripts/_dental-52-reshoot.mjs
 */
const { uploadMedia, log, prisma, setUA, wpBase, wpAuth } = await import("./batch-publish.js").then((m) => m.default || m);

const POST_ID = 52;
const PEXELS_ID = 38055772;
const URL = "https://images.pexels.com/photos/38055772/pexels-photo-38055772.jpeg?auto=compress&cs=tinysrgb&w=2400";
const ALT = "Staff at the reception desk of a modern dental practice front office";

const site = await prisma.site.findUnique({ where: { slug: "dental-business-news" } });
const { siteCredentials } = await import("../lib/site.js");
const { creds } = await siteCredentials(site.id);
const wp = creds.wordpress;
process.env.WP_URL = wp.url;
process.env.WP_USERNAME = wp.username;
process.env.WP_APP_PASSWORD = wp.appPassword;
setUA({ "user-agent": "DentalBusinessNewsBot/1.0 (dentalbusinessnews.com editorial)" });

const res = await fetch(URL);
if (!res.ok) throw new Error(`pexels ${res.status}`);
const bytes = Buffer.from(await res.arrayBuffer());
log(`downloaded ${bytes.length} bytes`);

const media = await uploadMedia({ file: { bytes }, alt: ALT, filename: "adg-nhs-contract-dental-practice-reception" });
log(`uploaded media ${media.id} (${media.width}x${media.height})`);

// The title goes with it on purpose: a request carrying only featured_media
// does not make Yoast rebuild the indexable row, and the share cards stay on
// the old image. Same reason as setFeatured in backfill-images.js.
const post = await (await fetch(`${wpBase()}/posts/${POST_ID}?_fields=title`, { headers: { authorization: `Basic ${wpAuth()}` } })).json();
const upd = await fetch(`${wpBase()}/posts/${POST_ID}`, {
  method: "POST",
  headers: { authorization: `Basic ${wpAuth()}`, "content-type": "application/json" },
  body: JSON.stringify({ featured_media: media.id, title: post.title.rendered }),
});
if (!upd.ok) throw new Error(`WP post ${upd.status}: ${(await upd.text()).slice(0, 200)}`);
log(`post ${POST_ID} now uses media ${media.id}`);

const row = await prisma.article.findFirst({ where: { siteId: site.id, wpPostId: POST_ID }, select: { id: true } });
if (row) {
  await prisma.article.update({
    where: { id: row.id },
    data: { imageUrl: URL, imageAlt: ALT, imageCredit: null, imageSource: `pexels:${PEXELS_ID}` },
  });
  log("archive row updated, so the desk will not pick this frame again");
}
await prisma.$disconnect();
