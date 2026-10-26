/**
 * Cap each title's weekly import so the bounces it buys stay under the gate.
 *
 * Measured 22 October: addresses arriving from the prospect pool hard-bounce at
 * 3.7% to 9.8%, while the lists we already hold sit at 0.10% to 0.25%. Nothing
 * verifies the pool since MillionVerifier came out in September, so every
 * import is a known dose of dead addresses. The gate blocks a title that goes
 * over 2% twice running, so the dose has to be small enough that one import
 * cannot get near it.
 *
 * cap = 1.5% of the current list, divided by that title's measured import
 * bounce rate (5% assumed where we have not measured one). JB's own figures for
 * Dental (400) and Gym (700) are used as given.
 */
import { PrismaClient } from "@prisma/client";
import { setWeeklyTarget, getWeeklyTarget, countImportable } from "../lib/prospects.js";
const p = new PrismaClient();
const CAPS = {
  "smart-sme": 2000,                 // 4.30% of 2,000 is 86 on 10,612 = 0.81%
  "fleet-magazine": 950,
  "golf-resort-magazine": 1000,      // 3.70% of 1,000 is 37 on 5,690 = 0.65%
  "barbering-business": 500,
  "airport-business-magazine": 1000,
  "gym-business-news": 700,          // JB, 22 Oct
  "nursery-daily": 350,
  "senior-lifestyle-business": 650,
  "dental-business-news": 400,       // JB, 22 Oct
  "smart-farming-news": 600,
};
const sites = await p.site.findMany({ select: { id:true, slug:true }, orderBy: { createdAt: "asc" } });
console.log("title".padEnd(27) + "was    now    pool left");
for (const s of sites) {
  const cap = CAPS[s.slug];
  if (cap == null) { console.log(`${s.slug.padEnd(27)} no cap defined, left alone`); continue; }
  const before = await getWeeklyTarget(s.id);
  await setWeeklyTarget(s.id, cap);
  const after = await getWeeklyTarget(s.id);
  const left = await countImportable(s.id);
  console.log(s.slug.padEnd(27) + String(before).padStart(5) + String(after).padStart(7) + String(left).padStart(12) + (before !== after ? "   changed" : ""));
}
await p.$disconnect();
