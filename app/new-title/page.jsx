import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CREDENTIAL_KINDS } from "@/lib/site";
import NewTitleForm from "./NewTitleForm";

export const dynamic = "force-dynamic";

// Provisioning, step one: the title exists in the database and appears in the
// rail. Everything after that — WordPress, Search Console, the mailbox — is a
// checklist on the title's own settings page, because those steps involve
// consoles with no useful API and cannot be completed from a form here.
//
// The title is created with the engine OFF and status `setup`. A title that
// started commissioning articles the moment it was named, against a WordPress
// site that does not exist yet, would burn tokens producing drafts with
// nowhere to go.

const DEFAULT_SECTIONS = [
  { name: "News", target: 6, commissionable: false },
  { name: "Case Studies", target: 6, commissionable: false },
];

const STEPS = [
  ["domain", "Register the domain and point nameservers", null, true, true],
  ["mx", "Set MX to Google, plus SPF and DKIM", "Blocking: outreach reply detection is inert until this is right.", true, true],
  ["wordpress", "Install WordPress and the theme clone", null, true, false],
  ["plugins", "Install security, caching, Yoast and Site Kit", null, true, false],
  // Smart SME lost publishing runs to this and it took an audit to find. sg-security
  // serves a captcha interstitial to the integration account on /wp-json/ and returns
  // 202, not 4xx, so every naive `res.ok` check sails straight past it and the failure
  // surfaces later as a content-type error somewhere unrelated. Whitelist before you
  // trust a green credential light.
  // Phrased as a CHECK, not a change. Written as "exempt the REST API" it read
  // as an instruction to go and disable something, which sent the first reader
  // to SiteGround's Protected URLs tool — that adds HTTP Basic Auth to a path,
  // and applying it to /wp-json/ would have walled off the only interface the
  // engine publishes through. The captcha often is not firing at all; find out
  // before touching a security setting.
  ["sg_captcha", "Verify the REST API is not captcha-blocked, as the Engine user",
    "Authenticate as the Engine account and fetch /wp-json/wp/v2/posts. A captcha interstitial returns 202 with an HTML body, so res.ok looks fine while every publish fails. Only change SiteGround's anti-bot settings if it actually fires. Do NOT use Protected URLs.", true, true],
  ["categories", "Create the categories exactly as the sections spell them", null, false, false],
  ["wp_user", "Create the Engine user at EDITOR role and an application password", "Not administrator. It must get rest_forbidden on /wp/v2/settings.", true, false],
  // The Engine account authenticates; the byline account is who the post is
  // attributed TO. They are deliberately different users, and publishing now
  // resolves the second by display name over /wp/v2/users. If it does not exist
  // the publish still succeeds — it just carries the Engine's byline, which is
  // the wrong name on every article until someone notices.
  ["wp_author", "Create the WordPress user the byline names",
    "Display name must match the title's author name exactly, or 'The <Title> Team' in masthead mode. Publishing falls back to the Engine account's byline if it is missing.", true, false],
  ["intake", "Create the /submit-news/ intake page", null, false, false],
  ["search_console", "Add the property to Search Console and GA4, grant the service account", null, true, false],
  ["mailchimp", "Create the audience and authenticate the sending domain", null, true, false],
  ["linkedin", "Create the company page and run the OAuth connect flow", null, true, false],
  ["credentials", "Paste credentials into the app and pass the health check", null, false, false],
  ["seed_content", "Publish 3-5 articles by hand for the internal-linking menu", "Drafts need existing posts to link to.", true, false],
];

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function createTitle(formData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const slug = slugify(formData.get("slug") || name);
  const sectionNames = String(formData.get("sections") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sections = [
    ...sectionNames.map((n) => ({ name: n, target: 6, commissionable: true })),
    ...DEFAULT_SECTIONS,
  ];

  const site = await prisma.site.create({
    data: {
      slug,
      name,
      strapline: String(formData.get("strapline") || "").trim() || null,
      // The single most load-bearing editorial fact: every agent prompt opens
      // with it, and it is what the Researcher commissions against. A title
      // created without one gets agents that know its name and its sections but
      // not who it is for.
      audience: String(formData.get("audience") || "").trim() || null,
      domain: String(formData.get("domain") || "").trim().replace(/^https?:\/\//, "") || null,
      status: "setup",
      markPrimary: name.split(/\s+/)[0] || name,
      markAccent: String(formData.get("mark") || "").trim().slice(0, 4) || null,
      accentHex: String(formData.get("accent") || "#2e3eee"),
      accent2Hex: String(formData.get("accent2") || "#5a6aff"),
      bylineMode: String(formData.get("bylineMode") || "shared_person"),
      authorName: String(formData.get("authorName") || "").trim() || null,
      authorEmail: String(formData.get("authorEmail") || "").trim() || null,
      sections,
      engineEnabled: false,
      provisioningSteps: {
        create: STEPS.map(([key, label, detail, manual, blocking], i) => ({
          key, label, detail, manual, blocking, sortOrder: i,
        })),
      },
    },
  });

  redirect(`/s/${site.slug}`);
}

export default async function NewTitlePage() {
  let existing = [];
  try {
    existing = await prisma.site.findMany({ select: { slug: true }, orderBy: { createdAt: "asc" } });
  } catch {
    existing = [];
  }

  return (
    <main className="fleet-wrap">
      <header className="fleet-head">
        <div>
          <span className="micro">Cogent Incubator</span>
          <h1>Add a title</h1>
        </div>
        <Link href="/" className="nav-link">Back to all titles</Link>
      </header>

      <NewTitleForm action={createTitle} taken={existing.map((s) => s.slug)} kinds={CREDENTIAL_KINDS} />
    </main>
  );
}
