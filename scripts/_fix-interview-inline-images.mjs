/**
 * Fix inline interview photos that render at full size and break the column.
 *
 * JB's screenshot of Smart SME draft 1295 (16 Sep 2026): Penny Joyner-Platt's
 * portrait ran at its native 1024px, wider than the text column and taller than
 * the screen. The figure was written as bare HTML. Core only enqueues the image
 * block's stylesheet, the one that sets img max-width:100% and height:auto, when
 * the post contains an actual wp:image block, and this block theme has no global
 * img rule of its own, so a bare <figure class="wp-block-image"> gets no sizing
 * at all. The same markup is on Rob Wood's live piece, Barbering post 662.
 *
 * Each bare figure becomes a real image block, in the markup the block editor
 * itself produces so the post still opens cleanly in the editor. Portraits are
 * held to 480px wide; landscapes keep the column width.
 *
 * Run: node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/_fix-interview-inline-images.mjs
 */
import os from "node:os";
import { execFileSync } from "node:child_process";

const TARGETS = [
  { slug: "smart-sme", postId: 1295 },
  { slug: "barbering-business", postId: 662 },
];
const PORTRAIT_WIDTH = 480;

const { prisma } = await import("../lib/prisma.js");
const { siteCredentials } = await import("../lib/site.js");

for (const { slug, postId } of TARGETS) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const keyPath = s.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const ssh = (cmd, input) =>
    execFileSync("ssh", ["-i", keyPath, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
      { encoding: "utf8", timeout: 180000, input, maxBuffer: 32 * 1024 * 1024 }).trim();
  const wp = (a) => ssh(`cd '${docroot}' && wp ${a}`);

  const status = wp(`post get ${postId} --field=post_status`);
  const content = wp(`post get ${postId} --field=post_content`);

  let fixed = 0;
  const bare = /(?<!<!-- wp:image[^>]*-->\s*)<figure class="wp-block-image size-(?:full|large)"><img src="([^"]+)" alt="([^"]*)"[^>]*><\/figure>/g;
  const updated = await (async () => {
    let out = content;
    for (const m of [...content.matchAll(bare)]) {
      const [whole, src, alt] = m;
      // Read the attachment's real dimensions rather than guessing from the file.
      const file = src.replace(/^https?:\/\/[^/]+/, "");
      const dims = ssh(`identify -format '%w %h' '${docroot}${file}' 2>/dev/null || php -r 'echo implode(" ", array_slice(getimagesize("${docroot}${file}"),0,2));'`);
      const [w, h] = dims.split(/\s+/).map(Number);
      const portrait = h > w;
      const block = portrait
        ? `<!-- wp:image {"width":"${PORTRAIT_WIDTH}px","sizeSlug":"full","linkDestination":"none","align":"center"} -->\n<figure class="wp-block-image aligncenter size-full is-resized"><img src="${src}" alt="${alt}" style="width:${PORTRAIT_WIDTH}px"/></figure>\n<!-- /wp:image -->`
        : `<!-- wp:image {"sizeSlug":"full","linkDestination":"none"} -->\n<figure class="wp-block-image size-full"><img src="${src}" alt="${alt}"/></figure>\n<!-- /wp:image -->`;
      out = out.replace(whole, block);
      fixed++;
      console.log(`${slug} ${postId}: ${portrait ? "portrait" : "landscape"} ${w}x${h} -> image block${portrait ? `, ${PORTRAIT_WIDTH}px` : ""}`);
    }
    return out;
  })();

  if (!fixed) {
    console.log(`${slug} ${postId}: no bare figures found, nothing to change`);
    continue;
  }

  const stamp = Date.now();
  ssh(`base64 -d > /tmp/fix-images-${postId}-${stamp}.html`, Buffer.from(updated, "utf8").toString("base64"));
  wp(`post update ${postId} /tmp/fix-images-${postId}-${stamp}.html`);
  ssh(`rm -f /tmp/fix-images-${postId}-${stamp}.html`);

  // A live post needs its caches cleared or readers keep the broken layout.
  if (status === "publish") {
    ssh(`cd '${docroot}' && wp cache flush && (wp sg purge || true)`);
    const url = wp(`post url ${postId}`);
    const html = ssh(`curl -s -A 'Mozilla/5.0 (CogentCheck)' '${url}'`);
    console.log(`  live check: image block css ${/wp-block-image|block-library/.test(html) ? "present" : "MISSING"}, is-resized ${html.includes("is-resized") ? "present" : "absent"}`);
  }

  const after = wp(`post get ${postId} --field=post_content`);
  const quotesIntact = (content.match(/interview-quote/g) || []).length === (after.match(/interview-quote/g) || []).length;
  console.log(`  ${status}: ${fixed} figure(s) converted, quotes intact ${quotesIntact}, bare figures left ${(after.match(bare) || []).length}`);
}
await prisma.$disconnect();
