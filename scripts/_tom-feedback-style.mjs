// Tom's feedback on Barbering and Gym, 5 Oct 2026: house-style and standard
// edits, applied to the database (the authority) and mirrored into
// scripts/alignment where the same text exists. Exact-string edits only; each
// reports whether it matched.
//   node --env-file=.env scripts/_tom-feedback-style.mjs [--dry-run]
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry-run");
const NEXT = 'Head that closing section calmly, for example "Next steps" or "What you can do", never "What to do this week".';
const FLOW = "Mix short and longer sentences so the prose flows; never stack clipped one-line statements.";

const BARB_ADD = `
- Headlines in the words a barber actually uses. Name the thing and what it
  means for the shop. No acronyms or official titles the reader would not say
  out loud: "New rules on who counts as self-employed" beats "DBT updates
  employment status guidance".
- Rules, tax and pay stories are explainers. Break them into short subheaded
  sections in plain words, along the lines of what is changing, what it means
  for your shop and what to do next, so a reader skimming the subheads still
  gets the story.
- Comparisons are a staple, because every barber has opinions on their kit:
  clippers, trimmers, scissors, chairs, booking apps, card terminals, events.
  Lay them out as this versus that, with a table, and say who each one suits.`;

const GYM_STD_ADD = `## The owner-who-trains rule

Added 5 Oct 2026 from team feedback. Most owners and managers came up through
PT or coaching and still train, so the training floor is what draws them in.
Cover it through the till, inside the scope rule above: which class formats
and training trends are filling, what they cost to add (space, kit, staff,
qualifications) and what operators charge for them.

At least one piece in five should be a profit builder: a "make more from"
piece on an extra revenue line, such as PT packages, small-group training,
classes, recovery and spa, nutrition coaching sold by qualified staff, or
retail, with real attributed numbers. These are the pieces this reader clicks.

`;

const EDITS = {
  "barbering-business": {
    houseStyleMd: [
      ["  Short sentences.", `  ${FLOW}`],
      ["something they can do this week.", `something practical they can do next. ${NEXT}`],
      ["- British spelling. No em dashes.", `${BARB_ADD.trim()}\n- British spelling. No em dashes.`],
    ],
  },
  "gym-business-news": {
    houseStyleMd: [
      ["are fine. Short sentences.", `are fine. ${FLOW}`],
      ["something they can do this week.", `something practical they can do next. ${NEXT}`],
    ],
    editorialStandardMd: [["## The claims rule", `${GYM_STD_ADD}## The claims rule`]],
  },
  "nursery-daily": {
    houseStyleMd: [
      ["Short sentences.", FLOW],
      ["something to check or do this week.", `something practical to check or do next. ${NEXT}`],
    ],
    editorialStandardMd: [["should do or check this week, it is not finished.", "should do or check next, it is not finished."]],
  },
};
const FILE = { houseStyleMd: "house-style", editorialStandardMd: "editorial-standard" };

const prisma = new PrismaClient();
for (const [slug, fields] of Object.entries(EDITS)) {
  const site = await prisma.site.findUnique({ where: { slug } });
  const data = {};
  for (const [field, edits] of Object.entries(fields)) {
    let db = site[field] || "";
    const fp = `scripts/alignment/${slug}.${FILE[field]}.md`;
    let file = fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : null;
    for (const [from, to] of edits) {
      const inDb = db.includes(from), inFile = file?.includes(from);
      console.log(`${slug} ${field}: "${from.slice(0, 40)}" db=${inDb ? "yes" : "NO"} file=${file == null ? "-" : inFile ? "yes" : "no"}`);
      if (inDb) db = db.replace(from, to);
      if (inFile) file = file.replace(from, to);
    }
    data[field] = db;
    if (!DRY && file != null) fs.writeFileSync(fp, file);
  }
  if (!DRY) await prisma.site.update({ where: { slug }, data });
}
await prisma.$disconnect();
