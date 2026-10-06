// One-off: draft the Cotswold CEO article through the press-release path.
//
// The engine's pr_rewrite prompt never shows the writer the commissioning
// brief (only the gate sees it), so two drafts hallucinated around a release
// the brief carried verbatim. This does what the press@ intake does: hand
// draftArticle the release itself as sourceText with pressRelease: true, so
// the writer gets the sacred-quotes press prompt and the full text.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/_cotswold-press-draft.mjs
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { draftArticle } from "../lib/drafting.js";

const prisma = new PrismaClient();
const ID = "cmup8udfb0001vfbwsuetxnx6";

const site = await prisma.site.findUnique({ where: { slug: "airport-business-magazine" } });
const sourceText = fs.readFileSync(process.env.TEMP + "/cotswold-release.txt", "utf8");
console.log("release:", sourceText.split(/\s+/).length, "words");

const res = await draftArticle(site, ID, undefined, { sourceText, pressRelease: true });
console.log("draft result:", JSON.stringify(res).slice(0, 400));

const a = await prisma.article.findUnique({
  where: { id: ID },
  select: { status: true, qaPassed: true, title: true, qaReport: true },
});
console.log("row:", a.status, "| qaPassed:", a.qaPassed, "|", a.title);
if (!a.qaPassed && a.qaReport) console.log(JSON.stringify(a.qaReport).slice(0, 400));
await prisma.$disconnect();
