/**
 * The next LinkedIn post for each title, ready to publish by hand.
 *
 * A stopgap for the window between the queue working and Community Management
 * API approval arriving: the drafts exist and expire after DRAFT_EXPIRY_DAYS,
 * so without this they are written and thrown away. Posting them by hand also
 * gets tagging, which the API path cannot do until the token exists, because
 * LinkedIn's own composer has @company typeahead.
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *     scripts/manual-post-pack.mjs --out=<dir>
 *
 *   node --import ./scripts/node-resolve-hook.mjs --env-file=.env \
 *     scripts/manual-post-pack.mjs --posted=<id>,<id>
 *
 * Marking them posted is not optional. dueFilter() skips only what has
 * postedAt set, so an unmarked post published by hand gets published a second
 * time by the cron the day the API goes live.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { composeLinkedInImage } from "../lib/linkedin-image.js";

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=");

// Titles with a LinkedIn company page. Airport is absent on purpose: its page
// could not be created until the 7-day page limit lifted, so there is nowhere
// to post it. Add it here once the page exists.
const SLUGS = ["smart-sme", "fleet-magazine", "golf-resort-magazine", "barbering-business"];

const prisma = new PrismaClient();

const uk = (d) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

const posted = arg("posted");
if (posted) {
  for (const id of posted.split(",").map((s) => s.trim()).filter(Boolean)) {
    const post = await prisma.linkedInPost.findUnique({
      where: { id },
      include: { site: { select: { name: true } } },
    });
    if (!post) {
      console.log(`${id}  NOT FOUND`);
      continue;
    }
    if (post.postedAt) {
      console.log(`${post.site.name}: already posted, left alone`);
      continue;
    }
    await prisma.linkedInPost.update({
      where: { id },
      // The slot is released with it, or nextPostingSlot still counts that time
      // as booked and the next draft skips it.
      data: { status: "posted", postedAt: new Date(), scheduledFor: null, publishError: null },
    });
    console.log(`${post.site.name}: marked posted`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

const out = arg("out");
if (!out) {
  console.error("Usage: manual-post-pack.mjs --out=<dir> | --posted=<id>,<id>");
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const ids = [];
for (const slug of SLUGS) {
  const site = await prisma.site.findUnique({ where: { slug } });
  // Oldest first: it is the one closest to expiring, and the queue should go
  // out in the order it was written.
  const post = await prisma.linkedInPost.findFirst({
    where: { siteId: site.id, status: "draft", postedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!post) {
    console.log(`\n### ${site.name}: no drafts waiting\n`);
    continue;
  }

  const { buffer, usedFallback } = await composeLinkedInImage(post.imageUrl);
  fs.writeFileSync(`${out}/post-${slug}.jpg`, buffer);
  ids.push(post.id);

  console.log(`\n${"=".repeat(74)}`);
  console.log(`### ${site.name}  (drafted ${uk(post.createdAt)})`);
  console.log(`### image: post-${slug}.jpg${usedFallback ? "   [FALLBACK: source image unreachable]" : ""}`);
  console.log(`### id: ${post.id}`);
  console.log("=".repeat(74));
  console.log(post.text);
}

console.log(`\n\nOnce they are up:\n  node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/manual-post-pack.mjs --posted=${ids.join(",")}`);
await prisma.$disconnect();
