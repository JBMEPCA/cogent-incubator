// One-off: stage the Uppercut Deluxe tag on the 13:00 Barbering post so we can
// see whether Make's LinkedIn module renders little-text mentions. Delete after.
import { PrismaClient } from "@prisma/client";
import { renderCommentary } from "../lib/_mentions_tmp.mjs";
const p = new PrismaClient();
const ID = "cmugnw1m8000t4bx9run4w2n8";
const MENTION = { urn: "urn:li:organization:6640573", name: "Uppercut Deluxe" };
const post = await p.linkedInPost.findUnique({ where: { id: ID }, select: { text: true, status: true, postedAt: true } });
if (post.postedAt) { console.log("ALREADY POSTED, doing nothing"); process.exit(0); }
const next = renderCommentary(post.text, [MENTION]);
console.log("--- BEFORE ---\n" + post.text.slice(0, 200));
console.log("\n--- AFTER ---\n" + next.slice(0, 300));
if (process.argv[2] === "--write") {
  await p.linkedInPost.update({ where: { id: ID }, data: { text: next } });
  console.log("\nWRITTEN");
} else {
  console.log("\n(dry run; pass --write to apply)");
}
await p.$disconnect();
