// Finish the alignment outreach in one run: every interview pre-ask still
// pending, then the press-list requests.
//
// Exists because the four separate commands turned into four things to babysit,
// one of which hung and had to be killed. This runs them in sequence, in the
// right order, with a per-person timeout so nothing can stall the batch, and
// prints one summary at the end. Everything it calls skips people already
// contacted, so it is safe to run again if it is interrupted: it picks up
// exactly where it stopped.
//
//   node --import ./scripts/node-resolve-hook.mjs --env-file=.env scripts/finish-alignment-sends.mjs
//
// Add --dry-run to see who is left and where each would go, sending nothing.

import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

const STEPS = [
  ["interviews", "scripts/seed-alignment-interviews.mjs", ["fleet-magazine"]],
  ["interviews", "scripts/seed-alignment-interviews.mjs", ["barbering-business"]],
  ["interviews", "scripts/seed-alignment-interviews.mjs", ["airport-business-magazine"]],
  ["press lists", "scripts/request-press-lists.mjs", []],
];

function run(script, args) {
  return new Promise((resolve) => {
    const argv = [
      "--import", "./scripts/node-resolve-hook.mjs",
      "--env-file=.env",
      script,
      ...args,
      ...(DRY ? [] : ["--send"]),
      "--pace=8",
      ...(script.includes("interviews") ? ["--timeout=60"] : []),
    ];
    const child = spawn(process.execPath, argv, { stdio: "inherit" });
    child.on("close", (code) => resolve(code));
  });
}

const before = await state();
console.log(`\nStarting: ${before.pending} people still to contact, ${before.agencies} PR agencies still to ask.${DRY ? "  [DRY RUN]" : ""}\n`);

for (const [label, script, args] of STEPS) {
  console.log(`\n=================== ${label}: ${args[0] || "all titles"}`);
  const code = await run(script, args);
  if (code !== 0) console.log(`(exited ${code}, carrying on)`);
}

const after = await state();
console.log(`\n=================== DONE`);
console.log(`Interview pre-asks: ${after.contacted} contacted, ${after.pending} still pending, ${after.exhausted} with no published address.`);
console.log(`PR agencies: ${after.mailed} asked, ${after.agencies} still to ask.`);
if (after.pendingNames.length) console.log(`Still pending: ${after.pendingNames.join(", ")}`);
await prisma.$disconnect();

async function state() {
  const slugs = ["barbering-business", "fleet-magazine", "airport-business-magazine"];
  const t = await prisma.interviewTarget.findMany({ where: { site: { slug: { in: slugs } } }, select: { status: true, personName: true } });
  const a = await prisma.prBrand.findMany({ where: { category: "PR agency" }, select: { notes: true } });
  return {
    pending: t.filter((x) => x.status === "pending").length,
    pendingNames: t.filter((x) => x.status === "pending").map((x) => x.personName),
    contacted: t.filter((x) => ["questioned", "asked", "agreed", "answered", "published", "declined"].includes(x.status)).length,
    exhausted: t.filter((x) => x.status === "exhausted").length,
    agencies: a.filter((x) => !x.notes?.includes("Press-list request sent")).length,
    mailed: a.filter((x) => x.notes?.includes("Press-list request sent")).length,
  };
}
