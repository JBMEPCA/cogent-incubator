/**
 * One-off, 23 Sep 2026: split Barbering Business post 830 into one post per
 * press release, at JB's request, each carrying its own show's photography.
 *
 * SLB PR sent two separate LFW SS27 releases in one email. The engine merged
 * them into a single trend piece; JB wants them kept close to what the agency
 * sent. So 830 is repurposed as the Justin Cassin story (it already holds media
 * 831-835 and whatever equity it has) and the Lovebirds story becomes a new
 * post. Nothing links to 830, so reslugging it is safe; _wp_old_slug carries
 * the old URL.
 *
 * Quotes are verbatim from the releases. The linking prose is ours, because a
 * reprinted release does not rank and drags the domain (editorial standard),
 * and each piece closes on the owner frame so the reader is the person who owns
 * the chair rather than the person who wants the haircut.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_barber-split-lfw.mjs [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import { barberSsh, prisma, b64 } from "./_barber-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const SCRATCH = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/0a6082bf-22e8-4445-9863-6ea7aeeb9615/scratchpad/lbout";
const CASSIN_POST = 830;
const OLD_SLUG = "two-uk-barbers-lead-hair-teams-at-london-fashion-week-ss27";
const PORTRAIT_WIDTH = 480;
const AUTHOR = 5; // Tom Woollin, as 830 already is
const CATEGORY = "Trends & Services";

const { ssh, put } = await barberSsh();

const img = (url, alt, caption) =>
  `<!-- wp:image {"width":"${PORTRAIT_WIDTH}px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized"><img src="${url}" alt="${alt}" style="width:${PORTRAIT_WIDTH}px"/>` +
  `<figcaption class="wp-element-caption">${caption}</figcaption></figure>\n<!-- /wp:image -->`;

const p = (s) => `<p>${s}</p>`;

/* ---------------------------------------------------------------- post A */

// Media 832-835 went up this morning and stay where they are.
const cm = Object.fromEntries([832, 833, 834, 835].map((id) => [id, ssh(`wp post get ${id} --field=guid`)]));
console.log("existing Justin Cassin media:", Object.entries(cm).map(([k, v]) => `${k}=${v.split("/").pop()}`).join(" "));

const CASSIN = {
  postId: CASSIN_POST,
  title: "Sid Da Barber Leads Hair for Justin Cassin at LFW SS27",
  slug: "sid-da-barber-leads-hair-justin-cassin-lfw-ss27",
  keyphrase: "Sid Da Barber Justin Cassin",
  metaDesc:
    "Lewis Gumbrell, aka Sid Da Barber, led the hair team for Justin Cassin's SS27 show at London Fashion Week, moving between high shine and natural texture.",
  body: [
    p("Lewis Gumbrell, working under his Sid Da Barber name, headed up the hair team for Justin Cassin's Spring/Summer 2027 show at London Fashion Week, building a run of polished but individual looks around modern masculinity and natural texture."),
    p("The show took place at Studio Spaces in London, where the Australian menswear designer presented his SS27 collection. The hair direction was designed to complement the clothes through contrasting interpretations of contemporary male grooming."),
    p("Gumbrell led a team including JJ Savani and Gecko Trim, working between sleek, high-shine finishes and enhanced natural curls, coils and Afro textures."),
    img(cm[832], "Model with enhanced Afro texture and a sharp defined hairline at the Justin Cassin SS27 show", "Shorter and Afro-textured hair was worked with individually rather than cut to one uniform look."),
    img(cm[833], "Model with long hair swept back from the face into a glossy high-shine finish at the Justin Cassin SS27 show", "Longer hair was swept away from the face for a glossy, controlled finish that kept some movement."),
    p("For models with longer hair, the team swept the hair away from the face, creating a glossy, controlled finish while retaining subtle movement. Rather than making every model conform to a single uniform look, shorter and Afro-textured hair was worked with individually, enhancing its natural shape, texture and character."),
    p("The result was clean, confident and editorial, with the hair supporting the collection without overpowering it."),
    p("Gumbrell said: \"Justin's collection gave us the opportunity to explore different expressions of modern masculinity through the hair. We wanted some of the looks to feel very sleek, polished and controlled, while with others it was about celebrating the model's own curls, coils and natural texture.\""),
    img(cm[834], "Model with a blonde natural-texture cut worn loose at the Justin Cassin SS27 show", "Natural texture enhanced rather than reshaped."),
    p("\"For me, great men's hair isn't about forcing everyone into the same look. It's understanding the individual, their hair and their identity, and then elevating what's naturally there. Backstage at Fashion Week gives us the freedom to push that idea creatively while still producing hair that feels relevant and wearable.\""),
    p("The show was produced and directed by Alice Holland, with styling and backstage management by Melania Peluso."),
    img(cm[835], "Two models backstage at Justin Cassin SS27, one with slicked dark hair and one with natural white-blonde curls", "Two readings of the same brief: a flat, slicked finish alongside untouched natural curl."),
    p("For the shop rather than the runway, the useful part is the method. Working from the texture a client already has, instead of cutting every head towards one template, is a service worth naming and pricing on the menu rather than absorbing into a standard cut. It is the same ground covered in our piece on <a href=\"https://barberingbusiness.com/rush-international-shows-three-looks-at-loreal-elevate-what-the-trend-line-up-means-for-your-menu/\">Rush International's looks at L'Oreal Elevate</a>."),
    "<!-- wp:heading {\"level\":2} -->\n<h2 class=\"wp-block-heading\">Show credits</h2>\n<!-- /wp:heading -->",
    "<!-- wp:list -->\n<ul class=\"wp-block-list\">" +
      "<li>Designer: Justin Cassin</li>" +
      "<li>Collection: Spring/Summer 2027</li>" +
      "<li>Venue: Studio Spaces, London</li>" +
      "<li>Producer and show director: Alice Holland</li>" +
      "<li>Stylist and backstage manager: Melania Peluso</li>" +
      "<li>Head of hair: Lewis Gumbrell, Sid Da Barber</li>" +
      "<li>Hair assistants: JJ Savani and Gecko Trim</li>" +
      "</ul>\n<!-- /wp:list -->",
    "<p><em style=\"font-size:0.85em\">Images: SLB PR</em></p>",
  ].join("\n\n"),
};

/* ---------------------------------------------------------------- post B */

const LOVEBIRDS = {
  title: "Danilo Giangreco Creates Soft Glamour for Lovebirds LFW Debut",
  slug: "danilo-giangreco-soft-glamour-lovebirds-lfw-debut",
  keyphrase: "Danilo Giangreco Lovebirds",
  metaDesc:
    "Revlon Professional's Danilo Giangreco built a structured beehive and loose glamorous waves for Lovebirds' London Fashion Week debut, India: IYKYK.",
  featured: {
    file: "danilo-giangreco-lovebirds-lfw-ss27-backstage.jpg",
    title: "Danilo Giangreco backstage at Lovebirds SS27",
    alt: "Danilo Giangreco spraying a model's hair backstage at the Lovebirds Spring/Summer 2027 show at London Fashion Week",
  },
  inline: [
    { key: "beehive", file: "lovebirds-ss27-structured-beehive-opening-look.jpg", title: "Structured beehive opening look at Lovebirds SS27", alt: "Model wearing a polished structured beehive with twisted detail at the sideburn, Lovebirds SS27", caption: "The opening look: a composed beehive with small twisted details worked in around the sideburns." },
    { key: "waves", file: "lovebirds-ss27-glamorous-waves-main-look.jpg", title: "Glamorous waves at Lovebirds SS27", alt: "Back view of long dark hair set into loose glamorous waves at the Lovebirds SS27 show", caption: "The main look: a pin curl set brushed out into loose, fluid waves." },
    { key: "mens", file: "lovebirds-ss27-mens-natural-texture-american-crew.jpg", title: "Men's natural texture at Lovebirds SS27", alt: "Male model with a blonde natural-texture cut and a soft side parting at the Lovebirds SS27 show", caption: "On the male models the brief was to enhance natural texture rather than impose a uniform finish." },
    { key: "products", file: "lovebirds-ss27-revlon-american-crew-products.jpg", title: "Revlon Professional and American Crew backstage at Lovebirds SS27", alt: "Revlon Professional Style Masters and American Crew products on the backstage table at Lovebirds SS27", caption: "The backstage table: Revlon Professional Style Masters for the women's looks, American Crew for the men's." },
  ],
};

const lovebirdsBody = (m) =>
  [
    p("Danilo Giangreco, Revlon Professional's artistic director for the UK and Ireland, created the hair for Lovebirds' Spring/Summer 2027 show at London Fashion Week, a run of polished but effortless looks built to sit alongside the collection's reading of contemporary Indian identity."),
    p("Titled India: IYKYK, the collection draws on the small cultural signifiers and visual references that are immediately recognisable to anyone familiar with everyday India, reinterpreting them through a contemporary fashion lens. The show marks Lovebirds' London Fashion Week debut."),
    p("Giangreco built a structured style to open the show, followed by a key look of voluminous, loose, glamorous waves for a soft finish that stayed polished without looking overly constructed."),
    img(m.beehive.url, m.beehive.alt, m.beehive.caption),
    p("The opening look was more structured at the designer's request, drawing on a classic Indian-inspired aesthetic. The hair was shaped into a polished, composed beehive, contrasting with the softer movement of the main look. Small, twisted details around the sideburns referenced the collection's Indian heritage and added a graphic element to an otherwise highly polished silhouette."),
    p("The hair was first prepped with Revlon Professional Style Masters Modular Mousse 2, then tonged with large-barrel tongs and placed into a pin curl set. Once released, it was brushed through to soften the wave into a more fluid finish. Each model was given a deep side parting, brushed into place and pinned to establish the shape, with Style Masters Modular Hairspray 2 layered through for hold. Glamorama Shine Spray went on immediately before the show for a high-shine finish under the lights."),
    img(m.waves.url, m.waves.alt, m.waves.caption),
    p("Giangreco said: \"For the opening look, the designer wanted something that felt instantly connected to the Indian inspiration behind the collection, so we created a very polished, classic-inspired beehive. I wanted the shape to feel composed and elevated, but the small twisted details around the sideburns gave it a more distinctive reference to the collection's Indian heritage. It felt like a strong, almost sculptural way to introduce the show.\""),
    p("\"For the main look, we moved away from that structure and created something much softer and more glamorous. We wanted the hair to have volume and movement, with these really loose, luxurious waves that felt polished but not overly done. The deep side parting helped give the look that old-school glamour, while brushing out the curls kept it modern and effortless.\""),
    "<!-- wp:heading {\"level\":2} -->\n<h2 class=\"wp-block-heading\">The men's looks</h2>\n<!-- /wp:heading -->",
    p("For the male models Giangreco worked with American Crew, choosing to enhance the models' natural texture rather than impose a uniform finish. On a small number of looks the hair was given a side parting with a subtle quiff, for a more groomed result that kept each model's individuality."),
    img(m.mens.url, m.mens.alt, m.mens.caption),
    p("\"Where the boys had naturally long or curly hair, we wanted to work with what they already had,\" he said. \"It was really about enhancing the natural texture and making it feel intentional.\""),
    img(m.products.url, m.products.alt, m.products.caption),
    p("That is the line worth taking back to the chair. A side parting and a soft quiff over a client's own texture is a five-minute finish rather than a restyle, and it is the kind of thing that sells a styling product at the till instead of being given away at the end of a cut. The same instinct ran through <a href=\"https://barberingbusiness.com/" + CASSIN.slug + "/\">Sid Da Barber's work at Justin Cassin</a> in the same week."),
    "<p><em style=\"font-size:0.85em\">Images: Matteo Valle</em></p>",
  ].join("\n\n");

/* ------------------------------------------------------------------- run */

if (!APPLY) {
  console.log("\n-- dry run --");
  console.log(`A: ${CASSIN_POST} -> "${CASSIN.title}" (${CASSIN.title.length} chars) /${CASSIN.slug}`);
  console.log(`   meta ${CASSIN.metaDesc.length} chars, reuses media 832-835`);
  console.log(`B: new  -> "${LOVEBIRDS.title}" (${LOVEBIRDS.title.length} chars) /${LOVEBIRDS.slug}`);
  console.log(`   meta ${LOVEBIRDS.metaDesc.length} chars, uploads:`);
  for (const f of [LOVEBIRDS.featured, ...LOVEBIRDS.inline]) {
    console.log("    ", f.file, (fs.statSync(path.join(SCRATCH, f.file)).size / 1024).toFixed(0) + "KB");
  }
  await prisma.$disconnect();
  process.exit(0);
}

const writeBody = (postId, html, extra = "") => {
  const tmp = `/tmp/barber-${postId}-${Date.now()}.html`;
  ssh(`printf '%s' '${b64(html)}' | base64 -d > ${tmp} && wp post update ${postId} ${tmp} ${extra} && rm -f ${tmp}`);
};

const setSeo = (postId, { keyphrase, metaDesc }) => {
  ssh(`wp post meta update ${postId} _yoast_wpseo_focuskw "$(printf '%s' '${b64(keyphrase)}' | base64 -d)"`);
  ssh(`wp post meta update ${postId} _yoast_wpseo_metadesc "$(printf '%s' '${b64(metaDesc)}' | base64 -d)"`);
  // Yoast serves a cached row and would keep the old title and og:image.
  ssh(`wp db query "DELETE FROM $(wp db prefix)yoast_indexable WHERE object_type='post' AND object_id=${postId}"`);
};

// --- A
console.log("\nA: rewriting post", CASSIN_POST);
writeBody(CASSIN_POST, CASSIN.body,
  `--post_title="$(printf '%s' '${b64(CASSIN.title)}' | base64 -d)" --post_name='${CASSIN.slug}'`);
// WP records the old slug itself on rename, but be explicit so the redirect is certain.
if (!ssh(`wp post meta get ${CASSIN_POST} _wp_old_slug || true`).includes(OLD_SLUG)) {
  ssh(`wp post meta add ${CASSIN_POST} _wp_old_slug '${OLD_SLUG}'`);
}
setSeo(CASSIN_POST, CASSIN);
console.log("   slug now", ssh(`wp post get ${CASSIN_POST} --field=post_name`));
console.log("   old slug:", ssh(`wp post meta get ${CASSIN_POST} _wp_old_slug`));

// --- B
console.log("\nB: creating the Lovebirds post");
const newId = Number(ssh(
  `wp post create --post_type=post --post_status=draft --post_author=${AUTHOR} ` +
  `--post_title="$(printf '%s' '${b64(LOVEBIRDS.title)}' | base64 -d)" --post_name='${LOVEBIRDS.slug}' --porcelain`
));
console.log("   post", newId);

function importMedia({ file, title, alt, caption }, postId, extra = "") {
  const remote = `/tmp/${file}`;
  put(fs.readFileSync(path.join(SCRATCH, file)), remote);
  const id = Number(ssh(
    `wp media import '${remote}' --post_id=${postId} ` +
    `--title="$(printf '%s' '${b64(title)}' | base64 -d)" ` +
    `--alt="$(printf '%s' '${b64(alt)}' | base64 -d)" ` +
    (caption ? `--caption="$(printf '%s' '${b64(caption)}' | base64 -d)" ` : "") +
    `${extra} --porcelain && rm -f '${remote}'`
  ));
  const url = ssh(`wp post get ${id} --field=guid`);
  console.log(`   media ${id}  ${file}`);
  return { id, url, alt, caption };
}

const feat = importMedia(LOVEBIRDS.featured, newId, "--featured_image");
const m = {};
for (const spec of LOVEBIRDS.inline) m[spec.key] = importMedia(spec, newId);

writeBody(newId, lovebirdsBody(m));
ssh(`wp post term set ${newId} category "${CATEGORY}"`);
setSeo(newId, LOVEBIRDS);
ssh(`wp post update ${newId} --post_status=publish`);
console.log("   url", ssh(`wp post url ${newId}`), "| thumb", ssh(`wp post meta get ${newId} _thumbnail_id`));

ssh(`wp cache flush && (wp sg purge || true)`);

/* -------------------------------------------------------------- db rows */

const artA = await prisma.article.findFirst({ where: { wpPostId: CASSIN_POST } });
await prisma.article.update({
  where: { id: artA.id },
  data: {
    title: CASSIN.title,
    keyphrase: CASSIN.keyphrase,
    metaDesc: CASSIN.metaDesc,
    imageCredit: "Images: SLB PR",
    imageSource: "press:SLB PR",
  },
});
const artB = await prisma.article.create({
  data: {
    siteId: artA.siteId,
    title: LOVEBIRDS.title,
    type: artA.type,
    status: "published",
    sourceItemId: artA.sourceItemId,
    category: artA.category,
    wpPostId: newId,
    qaPassed: artA.qaPassed,
    keyphrase: LOVEBIRDS.keyphrase,
    metaDesc: LOVEBIRDS.metaDesc,
    imageUrl: feat.url,
    imageAlt: feat.alt,
    imageCredit: "Images: Matteo Valle",
    imageSource: "press:SLB PR",
    publishedAt: new Date(),
    // The engine's spend stays on the original row; this split was done by hand.
    costUsd: 0,
  },
});
console.log("\narticle rows:", artA.id, "updated |", artB.id, "created");
await prisma.$disconnect();
