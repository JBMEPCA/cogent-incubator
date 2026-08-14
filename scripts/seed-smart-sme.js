/**
 * Bring Smart SME in as title #1.
 *
 *   node scripts/seed-smart-sme.js
 *
 * Reads the values that used to be environment variables and writes them where
 * they now belong: the Site row for configuration, encrypted SiteCredential
 * rows for secrets. Safe to re-run — it upserts.
 *
 * This seeds the CONFIGURATION only. Copying Smart SME's live articles, leads,
 * outreach history and agent runs across is a separate job (game-plan §11,
 * phase 3) precisely because it needs the live app paused and a verified
 * backup first, and bundling it here would make a re-runnable seed script into
 * something you can only safely run once.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));

// Encryption is duplicated rather than imported from lib/crypto.js because this
// script runs under plain node, outside Next's module resolution, and a seed
// that cannot run without a bundler is a seed nobody runs.
function encryptJson(obj) {
  const raw = process.env.CREDENTIAL_KEY;
  if (!raw) throw new Error("CREDENTIAL_KEY is not set — cannot write credentials");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CREDENTIAL_KEY must be 32 bytes base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), "utf8")), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

// Exactly as WordPress spells them — this is also how the Editor is asked to
// emit CATEGORY. News and Case Studies are not commissionable: News is dated by
// definition so writing it to hit a quota means inventing events, and a case
// study needs a real, publicly reported company situation. Both still count
// toward the tally so the picture stays honest.
const SECTIONS = [
  { name: "AI & Automation", target: 6, commissionable: true },
  { name: "Finance", target: 6, commissionable: true },
  { name: "Marketing", target: 6, commissionable: true },
  { name: "Operations", target: 6, commissionable: true },
  { name: "News", target: 6, commissionable: false },
  { name: "Case Studies", target: 6, commissionable: false },
];

const AGENTS = [
  ["director", "Director", "Director", "Hold the shape of the publication: keep the newsroom and the reference library in balance, and settle conflicts between agents."],
  ["researcher", "Researcher", "Research", "Find the topics and questions UK SME owners are actually searching for, before competitors cover them."],
  ["seo", "SEO Expert", "Search", "Make sure every live article carries its internal links and links the brands it names, then maximise search visibility without letting optimisation damage the writing."],
  ["editor", "Editor", "Editorial", "Turn commissions into accurate, genuinely useful articles that a professional editor would sign off."],
  ["designer", "Graphic Designer", "Imagery", "Give every article a high-resolution image that genuinely matches it."],
  ["finance", "Finance Manager", "Cost", "Keep the cost per published article low and make every penny of spend visible."],
  ["linkedin", "LinkedIn Manager", "Social", "Turn the site's best stories into consistent LinkedIn posts that sound like a person, not a feed."],
  ["backlink", "Backlink Manager", "Outreach", "Turn every brand we write about into a link back, and know exactly where each request stands."],
  ["newsletter", "Newsletter Manager", "Email", "Put the ten articles most worth a busy owner-manager's time into the weekly email, in the right order."],
];

// Order matters: MX before anything else, because a title that launches with
// mail still pointed at the old host inherits Smart SME's blind spot, where the
// Backlink Manager searches a mailbox that never receives anything and honestly
// reports no replies.
const STEPS = [
  ["domain", "Register the domain and point nameservers", null, true, true],
  ["mx", "Set MX to Google, plus SPF and DKIM", "Blocking: reply detection is inert until this is right.", true, true],
  ["wordpress", "Install WordPress and the theme clone", null, true, false],
  ["plugins", "Install sg-security, siteground-optimizer, Yoast, Site Kit", null, true, false],
  ["categories", "Create the categories exactly as the sections spell them", null, false, false],
  ["wp_user", "Create the Engine user at EDITOR role and an application password", "Not administrator. It must get rest_forbidden on /wp/v2/settings.", true, false],
  ["intake", "Create the /submit-news/ intake page", null, false, false],
  ["search_console", "Add the property to Search Console and GA4, grant the service account", null, true, false],
  ["mailchimp", "Create the audience and authenticate the sending domain", null, true, false],
  ["linkedin", "Create the company page and run the OAuth connect flow", null, true, false],
  ["credentials", "Paste credentials into the app and pass the health check", null, false, false],
  ["seed_content", "Publish 3-5 articles by hand for the internal-linking menu", "The Editor loads live posts as a linking menu; with none, early drafts have nothing to link to.", true, false],
];

function readIfPresent(...parts) {
  try {
    return readFileSync(join(here, ...parts), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const slug = "smart-sme";

  const site = await prisma.site.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: "Smart SME",
      strapline: "The UK's publication for smart SMEs",
      domain: "smartsme.co.uk",
      // Live rather than cold_start: it launched 31 July 2026 and has real
      // Search Console history, so the Researcher's near-miss mining works.
      status: "live",
      launchedAt: new Date("2026-07-31T00:00:00Z"),
      markPrimary: "Smart",
      markAccent: "SME",
      accentHex: "#2e3eee",
      accent2Hex: "#5a6aff",
      bylineMode: "shared_person",
      authorName: process.env.OUTREACH_FROM_NAME || "James Burke",
      authorEmail: "jb@smartsme.co.uk",
      sections: SECTIONS,
      editorialStandardMd: readIfPresent("..", "docs", "editorial-standard.md"),
      sectionTarget: 6,
      wordFloorGuide: 1100,
      wordFloorNews: 300,
      // Left OFF deliberately. The agents should not start spending against a
      // half-migrated database the moment this script finishes; switch it on
      // from the app once the pages read real data.
      engineEnabled: false,
      officeHoursStart: 7,
      officeHoursEnd: 20,
      articlesPerDayTarget: 1,
      newsletterEnabled: false,
      linkedInEnabled: true,
      outreachEnabled: true,
    },
  });

  console.log(`site: ${site.name} (${site.id})`);

  const creds = [
    ["wordpress", { url: process.env.WP_URL, username: process.env.WP_USERNAME, appPassword: process.env.WP_APP_PASSWORD }],
    ["google_analytics", { gscSiteUrl: process.env.GSC_SITE_URL, ga4PropertyId: process.env.GA4_PROPERTY_ID }],
    ["mailchimp", { audienceId: process.env.MAILCHIMP_AUDIENCE_ID, fromEmail: process.env.NEWSLETTER_FROM_EMAIL }],
    ["outreach", {
      fromEmail: process.env.OUTREACH_FROM_EMAIL,
      fromName: process.env.OUTREACH_FROM_NAME,
      replyTo: process.env.OUTREACH_REPLY_TO,
      postalAddress: process.env.OUTREACH_POSTAL_ADDRESS,
    }],
  ];

  for (const [kind, payload] of creds) {
    const filled = Object.fromEntries(Object.entries(payload).filter(([, v]) => v));
    if (!Object.keys(filled).length) {
      console.log(`  ${kind}: skipped, nothing in the environment`);
      continue;
    }
    await prisma.siteCredential.upsert({
      where: { siteId_kind: { siteId: site.id, kind } },
      update: { payloadEnc: encryptJson(filled) },
      create: { siteId: site.id, kind, payloadEnc: encryptJson(filled) },
    });
    console.log(`  ${kind}: stored ${Object.keys(filled).join(", ")}`);
  }

  for (const [key, name, role, goal] of AGENTS) {
    await prisma.agent.upsert({
      where: { siteId_key: { siteId: site.id, key } },
      update: { name, role, goal },
      create: { siteId: site.id, key, name, role, goal },
    });
  }
  console.log(`  agents: ${AGENTS.length} seeded`);

  for (let i = 0; i < STEPS.length; i++) {
    const [key, label, detail, manual, blocking] = STEPS[i];
    await prisma.siteProvisioningStep.upsert({
      where: { siteId_key: { siteId: site.id, key } },
      update: {},
      // Smart SME is already live, so its checklist is history rather than work.
      create: { siteId: site.id, key, label, detail, manual, blocking, sortOrder: i, done: true, doneAt: new Date() },
    });
  }
  console.log(`  provisioning: ${STEPS.length} steps recorded as complete`);

  console.log("\nDone. Open the app and Smart SME should be the only mark in the rail.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
