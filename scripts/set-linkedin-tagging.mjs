/**
 * Switch LinkedIn company tagging on, per title, for bridge-posted titles.
 *
 * Two settings, deliberately separate. The webhook URL is fleet-wide and inert
 * on its own; the tagging flag is per title so a page can be watched before the
 * other nine follow it.
 *
 *   node --env-file=.env scripts/set-linkedin-tagging.mjs
 *   node --env-file=.env scripts/set-linkedin-tagging.mjs --url=https://hook.eu1.make.com/xxxx
 *   node --env-file=.env scripts/set-linkedin-tagging.mjs --check=barbering-business
 *   node --env-file=.env scripts/set-linkedin-tagging.mjs --enable=barbering-business
 *   node --env-file=.env scripts/set-linkedin-tagging.mjs --disable=barbering-business
 *
 * --check resolves the tags for a title's most recent article WITHOUT changing
 * anything, so you can see what would have been tagged before switching on.
 */
import { PrismaClient } from "@prisma/client";
import { mentionsForPost } from "../lib/linkedin.js";

const p = new PrismaClient();
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const siteBy = (slug) => p.site.findFirst({ where: { slug } });

const bridgeOf = async (site) => {
  const row = await p.engineSetting.findFirst({ where: { siteId: site.id, key: "social_bridge" } });
  try { return JSON.parse(row?.value || "{}"); } catch { return {}; }
};
// EngineSetting is keyed on (siteId, key) with no id column, so the row is
// addressed by the composite key rather than fetched and updated by id.
const setBridge = async (site, next) => {
  const value = JSON.stringify(next);
  await p.engineSetting.upsert({
    where: { siteId_key: { siteId: site.id, key: "social_bridge" } },
    update: { value },
    create: { siteId: site.id, key: "social_bridge", value },
  });
};

const url = arg("url");
if (url) {
  await p.globalSetting.upsert({ where: { key: "make_lookup_url" }, update: { value: url }, create: { key: "make_lookup_url", value: url } });
  console.log("make_lookup_url set to", url);
}

const check = arg("check");
if (check) {
  const site = await siteBy(check);
  if (!site) { console.error("no such title:", check); process.exit(1); }
  const article = await p.article.findFirst({
    where: { siteId: site.id, body: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  if (!article) { console.error("no articles for", check); process.exit(1); }
  console.log(`\nresolving tags for: ${article.title}`);
  const found = await mentionsForPost(site, { articleId: article.id }, { accessToken: null });
  console.log(found.length ? found.map((m) => `  TAG  ${m.name}  ${m.urn}`).join("\n") : "  (nothing resolved)");
  console.log("\nNothing was changed. Use --enable to switch tagging on.");
}

for (const [flag, on] of [["enable", true], ["disable", false]]) {
  const slug = arg(flag);
  if (!slug) continue;
  // "all" means every title that already posts to LinkedIn through Make;
  // a title with no bridge has nothing to tag.
  const targets = [];
  if (slug === "all") {
    for (const site of await p.site.findMany({ orderBy: { slug: "asc" } })) {
      if ((await bridgeOf(site)).linkedin) targets.push(site);
    }
  } else {
    const site = await siteBy(slug);
    if (!site) { console.error("no such title:", slug); process.exit(1); }
    targets.push(site);
  }

  for (const site of targets) {
    const next = { ...(await bridgeOf(site)), tagging: on };
    await setBridge(site, next);
    console.log(`${site.slug.padEnd(26)} ->`, JSON.stringify(next));
  }
}

if (!url && !check && !arg("enable") && !arg("disable")) {
  const g = await p.globalSetting.findUnique({ where: { key: "make_lookup_url" } });
  console.log("make_lookup_url:", g?.value || "(unset)");
  for (const s of await p.site.findMany({ select: { id: true, slug: true }, orderBy: { slug: "asc" } })) {
    const b = await bridgeOf(s);
    if (b.linkedin) console.log(`  ${s.slug.padEnd(26)} tagging=${b.tagging === true}`);
  }
}
await p.$disconnect();
