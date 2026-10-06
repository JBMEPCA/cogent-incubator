// Read or set the press desk's reply mode.
//
//   node --env-file=.env scripts/set-press-link-ask.mjs            # show it
//   node --env-file=.env scripts/set-press-link-ask.mjs send       # set it
//
// linkAskMode() in lib/press-intake.js reads GlobalSetting `press_link_ask`
// and returns "draft" for anything it does not recognise, including a missing
// row. That row had never been written, so from 21 Sep to 2 Oct 2026 every
// "you're live" reply on every title was parked in the press mailbox's Drafts
// folder and nothing was ever sent. 34 had built up when a PR chased us.
//
//   draft - write the reply and leave it in Drafts for a human
//   send  - send it, which is what the desk was built to do
//   off   - no reply at all
//
// Changing this only affects releases handled from now on. Replies already
// parked stay parked.
import { PrismaClient } from "@prisma/client";

const MODES = new Set(["draft", "send", "off"]);
const KEY = "press_link_ask";
const wanted = process.argv[2];

const prisma = new PrismaClient();
try {
  const current = await prisma.globalSetting.findUnique({ where: { key: KEY } });
  const effective = MODES.has(String(current?.value || "").trim().toLowerCase())
    ? current.value
    : `draft (falling back: row is ${current ? JSON.stringify(current.value) : "missing"})`;
  console.log(`current: ${effective}`);

  if (!wanted) {
    console.log("\nPass one of: draft, send, off");
    process.exit(0);
  }
  if (!MODES.has(wanted)) {
    console.error(`\n"${wanted}" is not a mode. Use draft, send or off.`);
    process.exit(1);
  }
  const row = await prisma.globalSetting.upsert({
    where: { key: KEY },
    update: { value: wanted },
    create: { key: KEY, value: wanted },
  });
  console.log(`now:     ${row.value}`);
  console.log("\nRead fresh on every release, so no redeploy is needed.");
  if (wanted === "send") {
    console.log("Replies already sitting in Drafts are NOT flushed by this; they still need sending.");
  }
} finally {
  await prisma.$disconnect();
}
