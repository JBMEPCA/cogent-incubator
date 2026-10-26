// The interview sweep drafts any target with status "answered" and a null
// articleId (lib/interviews.js, the `answered` query). Carol Hatcher's row was
// left in exactly that state, so the next tick would have written a second,
// model-made version of an interview that already exists as WP draft 423.
//
// So record the article we actually wrote and move the row to "drafted".
import fs from "node:fs";
import { prisma, forSite } from "../lib/prisma.js";

const WP_POST = 423;
const DIR = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/814c27be-565a-46c7-86a8-187638b10f61/scratchpad";

const site = await prisma.site.findUnique({ where: { slug: "senior-lifestyle-business" } });
const db = forSite(site.id);

const target = await db.interviewTarget.findFirst({ where: { personName: "Carol Hatcher" } });
if (!target) throw new Error("no target row");

const existing = await db.article.findFirst({ where: { wpPostId: WP_POST } });
const data = {
  siteId: site.id,
  title: "Meet the Operator: Carol Hatcher on opening a new village",
  type: "case_study",
  // "idea", not "review" or "approved": the press desk uses this exact trick so
  // fill-schedule, publish-due and the Designer never touch a piece a human has
  // not signed off. The WP draft is the thing JB reads.
  status: "idea",
  body: fs.readFileSync(`${DIR}/carol-draft-body.html`, "utf8"),
  wpPostId: WP_POST,
  category: "Operators & Economics",
  keyphrase: "retirement village general manager",
  metaDesc:
    "Carol Hatcher runs The Shires in Moseley for a small charitable housing association. She joined the project when the building was one brick high.",
  sourceUrl: "https://shires-moseley.co.uk/",
  qaPassed: true,
};

const article = existing
  ? await db.article.update({ where: { id: existing.id }, data })
  : await db.article.create({ data });
console.log(`article  ${article.id}  status=${article.status}  wp=${article.wpPostId}`);

await db.interviewTarget.update({
  where: { id: target.id },
  data: { articleId: article.id, status: "drafted" },
});

const after = await db.interviewTarget.findFirst({
  where: { personName: "Carol Hatcher" },
  select: { status: true, articleId: true, answeredAt: true, headshotUrl: true, replyBody: true },
});
console.log(`target   status=${after.status}  articleId=${after.articleId}`);
console.log(`         replyBody ${after.replyBody ? after.replyBody.length + " chars" : "EMPTY"}, headshot ${after.headshotUrl || "(not set)"}`);

const wouldDraft = await db.interviewTarget.count({ where: { status: "answered", articleId: null } });
console.log(`\nrows the sweep would still draft on this title: ${wouldDraft}`);
await prisma.$disconnect();
