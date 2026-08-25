// Give already-published articles that have no header image one.
//
//   node scripts/backfill-images.js --site=fleet-magazine
//   node scripts/backfill-images.js --site=fleet-magazine --dry-run
//   node scripts/backfill-images.js --site=smart-sme 474 438     # only these post IDs
//
// The picture desk is batch-publish.js's, imported rather than copied: same
// query writing, same Pexels-then-Openverse sourcing, same per-title shoot
// dedupe, same vision gate. A second implementation would drift from the first
// and the archive would start repeating itself across the two.
//
// Only ever touches posts whose featured_media is 0. A post that already has an
// image is never re-shot, so a re-run after a partial failure resumes cleanly
// rather than replacing work.
const {
  chooseImage, uploadMedia, log, prisma, setUA, wpBase, wpAuth,
} = require("./batch-publish.js");

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const DRY = process.argv.includes("--dry-run");
const onlyIds = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);

const headers = () => ({ authorization: `Basic ${wpAuth()}` });

async function allPublished() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${wpBase()}/posts?per_page=100&page=${page}&status=publish&orderby=date&order=desc` +
        `&_fields=id,slug,link,title,excerpt,content,featured_media,categories,date`,
      { headers: headers() }
    );
    if (res.status === 400) break; // past the last page
    if (!res.ok) throw new Error(`WP posts ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// Strip tags and entities well enough to brief the query writer. Not a parser,
// and does not need to be: it feeds a prompt, not a page.
const plain = (html) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#8220;|&#8221;/g, String.fromCharCode(34))
    .replace(/&#8217;|&#039;|&apos;/g, String.fromCharCode(39))
    .replace(/\s+/g, " ")
    .trim();

async function setFeatured(postId, mediaId, credit, existingContent, title) {
  // The title is its own current value, and it is here on purpose. A request
  // carrying only featured_media does not make Yoast rebuild that post's
  // indexable row, so the article renders its new header image while og:image
  // and twitter:image stay null and every share of it is a blank card. Sending
  // a post field alongside makes it a real save and the row is rewritten.
  const body = { featured_media: mediaId, title };
  // A credited licence has to carry its credit or the licence is not met. Only
  // Openverse CC-BY candidates set this; Pexels and CC0 return null.
  if (credit) body.content = `${existingContent}\n<p class="image-credit"><em>${credit}</em></p>`;
  const res = await fetch(`${wpBase()}/posts/${postId}`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WP post ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

(async () => {
  const slug = arg("site");
  if (!slug) {
    console.error("Refusing to run without --site=<slug>.");
    process.exit(1);
  }
  const SITE = await prisma.site.findUnique({ where: { slug } });
  if (!SITE) {
    console.error(`No title with slug "${slug}".`);
    process.exit(1);
  }
  const { siteCredentials } = await import("../lib/site.js");
  const { creds } = await siteCredentials(SITE.id);
  const wp = creds.wordpress;
  if (!wp?.url) {
    console.error(`${SITE.name} has no WordPress credential stored.`);
    process.exit(1);
  }
  process.env.WP_URL = wp.url;
  process.env.WP_USERNAME = wp.username;
  process.env.WP_APP_PASSWORD = wp.appPassword;
  setUA({
    "user-agent": `${String(SITE.name).replace(/[^A-Za-z0-9]/g, "")}Bot/1.0 (${String(wp.url).replace(/^https?:\/\//, "")} editorial)`,
  });
  // verifyImage briefs the picture editor with the title's own name. Without
  // this it judges every candidate as if it were shooting for whichever
  // publication the constant happened to name.
  global.__BATCH_SITE = SITE;

  log(`${SITE.name} — ${wp.url}`);

  const posts = (await allPublished()).filter((p) => !p.featured_media);
  const targets = onlyIds.length ? posts.filter((p) => onlyIds.includes(p.id)) : posts;

  if (onlyIds.length) {
    const missing = onlyIds.filter((id) => !targets.some((p) => p.id === id));
    if (missing.length) log(`skipping ${missing.join(", ")} — already has an image, or not a published post here`);
  }
  if (!targets.length) {
    log("Nothing to do: every published article already has a header image.");
    await prisma.$disconnect();
    return;
  }
  log(`${targets.length} article(s) without a header image`);

  // Dedupe against everything this title has already run. Scoped per title, as
  // the schema comment on imageSource explains.
  const history = await prisma.article.findMany({
    where: { siteId: SITE.id, imageUrl: { not: null } },
    select: { imageUrl: true, imageSource: true, imageAlt: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  const usedImages = new Set(history.map((a) => a.imageUrl));
  const usedShoots = new Set(history.slice(0, 40).map((a) => a.imageSource).filter(Boolean));
  const altsByCategory = history.reduce((map, a) => {
    if (!a.imageAlt) return map;
    const list = map.get(a.category) || [];
    if (list.length < 5) map.set(a.category, list.concat(a.imageAlt));
    return map;
  }, new Map());
  log(`${usedImages.size} images and ${usedShoots.size} recent shoots already used by this title`);

  const cats = new Map();
  try {
    const list = await (await fetch(`${wpBase()}/categories?per_page=100&_fields=id,name`, { headers: headers() })).json();
    // Decoded, because these are matched against Article.category. WordPress
    // returns "Costs &amp; Efficiency" where the archive stored "Costs &
    // Efficiency", and six of the nine Fleet sections have an ampersand — so an
    // undecoded key misses every one of them and the "do not repeat what this
    // section has been running" brief silently becomes empty.
    for (const c of list) cats.set(c.id, plain(c.name));
  } catch {
    /* category names are art direction, not a requirement */
  }

  const done = [];
  const failed = [];

  for (const post of targets) {
    const title = plain(post.title?.rendered);
    const category = cats.get(post.categories?.[0]) || null;
    const row = await prisma.article.findFirst({
      where: { siteId: SITE.id, wpPostId: post.id },
      select: { id: true, keyphrase: true, brief: true },
    });
    const brief = row?.brief || plain(post.excerpt?.rendered) || plain(post.content?.rendered).slice(0, 400);

    log(`\n[${post.id}] ${title}`);
    if (DRY) {
      log(`   would shoot — category ${category || "none"}, keyphrase ${row?.keyphrase || "n/a"}`);
      continue;
    }

    try {
      const image = await chooseImage({
        title,
        keyphrase: row?.keyphrase || null,
        brief,
        used: usedImages,
        usedShoots,
        nearby: altsByCategory.get(category) || [],
      });
      if (!image) {
        log("   no candidate passed the picture gate");
        failed.push({ id: post.id, title, why: "no candidate passed the gate" });
        continue;
      }

      const media = await uploadMedia({ file: image.file, alt: image.alt, filename: post.slug });
      await setFeatured(post.id, media.id, image.credit, post.content?.rendered || "", post.title?.rendered || "");

      // Feed the result back into the archive so the next article in this same
      // run does not pick the neighbouring frame of the shoot just used.
      usedImages.add(image.url);
      if (image.source) usedShoots.add(image.source);

      if (row) {
        await prisma.article.update({
          where: { id: row.id },
          data: { imageUrl: image.url, imageAlt: image.alt, imageCredit: image.credit, imageSource: image.source },
        });
      }

      log(`   set media ${media.id} (${media.width}x${media.height}, score ${image.score}) — ${image.alt}`);
      done.push({ id: post.id, title, mediaId: media.id, width: media.width, alt: image.alt, credit: image.credit, tracked: Boolean(row) });
    } catch (e) {
      log(`   FAILED: ${e.message}`);
      failed.push({ id: post.id, title, why: e.message });
    }
  }

  log(`\n${done.length} imaged, ${failed.length} failed`);
  for (const f of failed) log(`  UNRESOLVED  [${f.id}] ${f.title} — ${f.why}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
