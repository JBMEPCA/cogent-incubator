// Read or set how the press desk's link ask behaves, fleet-wide.
//
//   node scripts/press-link-ask-mode.mjs            -> what it is now
//   node scripts/press-link-ask-mode.mjs draft      -> write to Drafts, send nothing (the default)
//   node scripts/press-link-ask-mode.mjs send       -> send it
//   node scripts/press-link-ask-mode.mjs off        -> no reply at all
//
// A GlobalSetting rather than an env var on purpose: this takes effect on the
// next release, not on the next Vercel deploy.
import "./_env.mjs";
import { prisma } from "../lib/prisma.js";

const KEY = "press_link_ask";
const MODES = ["draft", "send", "off"];
const want = (process.argv[2] || "").trim().toLowerCase();

if (!want) {
  const row = await prisma.globalSetting.findUnique({ where: { key: KEY } });
  console.log(`press_link_ask = ${row?.value || "(unset, so: draft)"}`);
} else if (!MODES.includes(want)) {
  console.error(`Not a mode. Use one of: ${MODES.join(", ")}`);
  process.exitCode = 1;
} else {
  await prisma.globalSetting.upsert({ where: { key: KEY }, update: { value: want }, create: { key: KEY, value: want } });
  console.log(`press_link_ask = ${want}`);
  if (want === "send") console.log("Live. The next published release emails its sender the link ask.");
}
await prisma.$disconnect();
