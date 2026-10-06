/**
 * One-off, 23 Sep 2026: put the real Justin Cassin SS27 backstage photography on
 * Barbering Business post 830.
 *
 * SLB PR emailed the press desk both LFW releases at 11:24 UK with two Drive
 * folder links. The engine published 830 seven minutes later but cannot open a
 * Drive folder, so it fell back to a Pexels stock shot of a razor fade that has
 * nothing to do with either show. JB forwarded the same folder by hand.
 *
 * Featured image is cropped 4:3 on purpose: the theme covers it into 16/9 for
 * cards and 5/4 for the homepage hero, and a 16/9 upload loses its sides in the
 * 5/4 box, which would cut the barber out of the frame entirely.
 *
 * Every inline shot is portrait, so each one is a real wp:image block held to
 * 480px. Bare figures get no sizing at all in this theme (see
 * _fix-interview-inline-images.mjs) and run wider than the column.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *        scripts/_barber-830-photos.mjs [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import { barberSsh, prisma, b64 } from "./_barber-ssh.mjs";

const APPLY = process.argv.includes("--apply");
const POST_ID = 830;
const SRC = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/0a6082bf-22e8-4445-9863-6ea7aeeb9615/scratchpad/out";
const CREDIT = "Images: SLB PR";
const PORTRAIT_WIDTH = 480;

// The man working in the backstage shots is not identified in the release, which
// names a team of three, so nothing here claims which of them it is.
const FEATURED = {
  file: "sid-da-barber-team-justin-cassin-ss27.jpg",
  title: "Sid Da Barber's team backstage at Justin Cassin SS27",
  alt: "A barber shaping a model's Afro-textured hair backstage at the Justin Cassin Spring/Summer 2027 show in London",
};

// Anchored on the tail of the paragraph each picture illustrates.
const INLINE = [
  {
    after: `elevating what's naturally there," Gumbrell said.</p>`,
    images: [
      {
        file: "justin-cassin-ss27-afro-texture-look.jpg",
        title: "Afro-textured look at Justin Cassin SS27",
        alt: "Model with enhanced Afro texture and a sharp defined hairline at the Justin Cassin SS27 show",
        caption: "Shorter and Afro-textured hair was worked with individually rather than cut to one uniform look. Justin Cassin SS27.",
      },
      {
        file: "justin-cassin-ss27-sleek-high-shine-look.jpg",
        title: "Sleek high-shine look at Justin Cassin SS27",
        alt: "Model with long hair swept back from the face into a glossy high-shine finish at the Justin Cassin SS27 show",
        caption: "Longer hair was swept away from the face for a glossy, controlled finish that kept some movement. Justin Cassin SS27.",
      },
    ],
  },
  {
    after: "treating as a default.</p>",
    images: [
      {
        file: "justin-cassin-ss27-natural-texture-look.jpg",
        title: "Natural texture at Justin Cassin SS27",
        alt: "Model with a blonde natural-texture cut worn loose at the Justin Cassin SS27 show",
        caption: "Natural texture enhanced rather than reshaped. Justin Cassin SS27.",
      },
    ],
  },
  {
    after: "scrambling to catch up.</p>",
    images: [
      {
        file: "justin-cassin-ss27-collection-looks.jpg",
        title: "Contrasting looks at Justin Cassin SS27",
        alt: "Two models backstage at Justin Cassin SS27, one with slicked dark hair and one with natural white-blonde curls",
        caption: "Two readings of the same brief: a flat, slicked finish alongside untouched natural curl. Justin Cassin SS27.",
      },
    ],
  },
];

const imageBlock = (url, alt, caption) =>
  `<!-- wp:image {"width":"${PORTRAIT_WIDTH}px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n` +
  `<figure class="wp-block-image aligncenter size-full is-resized">` +
  `<img src="${url}" alt="${alt}" style="width:${PORTRAIT_WIDTH}px"/>` +
  `<figcaption class="wp-element-caption">${caption}</figcaption></figure>\n` +
  `<!-- /wp:image -->`;

const { ssh, put } = await barberSsh();

const before = ssh(`wp post get ${POST_ID} --fields=post_title,post_status --format=csv`);
console.log(before);
const body = ssh(`wp post get ${POST_ID} --field=post_content`);

// Fail loudly rather than silently dropping a picture if the engine's prose
// ever changes under us.
for (const slot of INLINE) {
  if (!body.includes(slot.after)) throw new Error(`anchor not found in post body: ${JSON.stringify(slot.after)}`);
}
console.log(`all ${INLINE.length} anchors matched`);

if (!APPLY) {
  console.log("\ndry run. files that would upload:");
  for (const f of [FEATURED, ...INLINE.flatMap((s) => s.images)]) {
    console.log("  ", f.file, (fs.statSync(path.join(SRC, f.file)).size / 1024).toFixed(0) + "KB");
  }
  await prisma.$disconnect();
  process.exit(0);
}

/** Upload one local file and import it into the media library. */
function importMedia({ file, title, alt, caption }, extra = "") {
  const remote = `/tmp/${file}`;
  put(fs.readFileSync(path.join(SRC, file)), remote);
  const args =
    `wp media import '${remote}' --post_id=${POST_ID} ` +
    `--title="$(printf '%s' '${b64(title)}' | base64 -d)" ` +
    `--alt="$(printf '%s' '${b64(alt)}' | base64 -d)" ` +
    (caption ? `--caption="$(printf '%s' '${b64(caption)}' | base64 -d)" ` : "") +
    `${extra} --porcelain`;
  const id = Number(ssh(`${args} && rm -f '${remote}'`));
  const url = ssh(`wp post get ${id} --field=guid`);
  console.log(`  media ${id}  ${file}`);
  return { id, url };
}

console.log("\nfeatured image:");
const featured = importMedia(FEATURED, "--featured_image");

console.log("inline images:");
let out = body;
for (const slot of INLINE) {
  const blocks = slot.images.map((img) => {
    const { url } = importMedia(img);
    return imageBlock(url, img.alt, img.caption);
  });
  out = out.replace(slot.after, `${slot.after}\n\n${blocks.join("\n\n")}`);
}

const creditLine = `<p><em style="font-size:0.85em">${CREDIT}</em></p>`;
if (!out.includes(creditLine)) out = `${out.trimEnd()}\n\n${creditLine}`;

const tmp = `/tmp/barber-830-${Date.now()}.html`;
ssh(`printf '%s' '${b64(out)}' | base64 -d > ${tmp} && wp post update ${POST_ID} ${tmp} && rm -f ${tmp}`);

console.log("\nthumbnail now", ssh(`wp post meta get ${POST_ID} _thumbnail_id`), `(was 829)`);
console.log("url", ssh(`wp post url ${POST_ID}`));

const art = await prisma.article.findFirst({ where: { wpPostId: POST_ID } });
await prisma.article.update({
  where: { id: art.id },
  data: { imageAlt: FEATURED.alt, imageCredit: CREDIT, imageSource: "press:SLB PR" },
});
console.log("article row updated", art.id);
await prisma.$disconnect();
