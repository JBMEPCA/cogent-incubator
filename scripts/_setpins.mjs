// JB's running order for Monday 26 October. Pins are WP post ids and the
// briefing fetches any that have fallen outside the candidate window.
import { PrismaClient } from "@prisma/client";
import { forSite } from "../lib/prisma.js";
import { getBriefingPin } from "../lib/briefing.js";
const p = new PrismaClient();
const PINS = {
  "smart-sme": "1819",                 // Greg Jackson, Octopus runs 13,000 staff with no HR
  "gym-business-news": "268",          // Pilates reformer boom, 3 equipment makers scale up
  "nursery-daily": "412",              // Kids Planet buys Yewlands Day Nursery
  "senior-lifestyle-business": "328",  // Michael Dell firm buys Sunrise for $1bn
  "dental-business-news": "278",       // Behind the Mask: Moyle Dental Care
};
for (const [slug, value] of Object.entries(PINS)) {
  const site = await p.site.findUnique({ where: { slug } });
  await forSite(site.id).engineSetting.upsert({
    where: { key: "briefing_pin" },
    create: { key: "briefing_pin", value },
    update: { value },
  });
  console.log(`${slug.padEnd(27)} pinned ${await getBriefingPin(site)}`);
}
await p.$disconnect();
